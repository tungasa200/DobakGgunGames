package com.dobakggun.service;

import com.dobakggun.dto.auth.*;
import com.dobakggun.entity.EmailVerification;
import com.dobakggun.entity.User;
import com.dobakggun.repository.EmailVerificationRepository;
import com.dobakggun.repository.UserRepository;
import com.dobakggun.util.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final EmailVerificationRepository emailVerificationRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final RedisTokenService redisTokenService;
    private final EmailService emailService;
    private final ProfanityService profanityService;

    @Value("${app.mail.verification-token-expiry}")
    private long verificationTokenExpiry;

    // 이메일 중복 확인
    public boolean isEmailTaken(String email) {
        return userRepository.existsByEmail(email);
    }

    // 5-1. 회원가입
    @Transactional
    public void signup(SignupRequest req) {
        if (userRepository.existsByEmail(req.getEmail())) {
            throw new IllegalArgumentException("이미 사용 중인 이메일입니다");
        }
        if (userRepository.existsByNickname(req.getNickname())) {
            throw new IllegalArgumentException("이미 사용 중인 닉네임입니다");
        }
        validateNickname(req.getNickname());

        User user = User.builder()
                .email(req.getEmail())
                .nickname(req.getNickname())
                .password(passwordEncoder.encode(req.getPassword()))
                .provider(User.Provider.LOCAL)
                .status(User.Status.PENDING)
                .build();
        userRepository.save(user);

        String token = UUID.randomUUID().toString();
        EmailVerification verification = EmailVerification.builder()
                .user(user)
                .token(token)
                .expiresAt(LocalDateTime.now().plusSeconds(verificationTokenExpiry))
                .build();
        emailVerificationRepository.save(verification);

        emailService.sendVerificationEmail(user.getEmail(), token);
    }

    // 5-2. 이메일 인증
    @Transactional
    public void verifyEmail(String token) {
        EmailVerification verification = emailVerificationRepository.findByToken(token)
                .orElseThrow(() -> new IllegalArgumentException("유효하지 않은 인증 토큰입니다"));

        if (verification.isUsed()) {
            throw new IllegalArgumentException("이미 사용된 인증 토큰입니다");
        }
        if (verification.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException("만료된 인증 토큰입니다");
        }

        verification.getUser().setStatus(User.Status.ACTIVE);
        verification.setUsed(true);
    }

    // 5-3. 로그인
    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest req) {
        User user = userRepository.findByEmail(req.getEmail())
                .orElseThrow(() -> new IllegalArgumentException("이메일 또는 비밀번호가 올바르지 않습니다"));

        if (user.getStatus() == User.Status.PENDING) {
            throw new IllegalStateException("이메일 인증이 필요합니다. 메일함을 확인해 주세요");
        }
        if (user.getStatus() == User.Status.BANNED) {
            throw new IllegalStateException("정지된 계정입니다");
        }
        if (!passwordEncoder.matches(req.getPassword(), user.getPassword())) {
            throw new IllegalArgumentException("이메일 또는 비밀번호가 올바르지 않습니다");
        }

        return issueTokens(user);
    }

    // 5-4. 토큰 재발급 (RT Rotation)
    @Transactional(readOnly = true)
    public AuthResponse refresh(TokenRefreshRequest req) {
        String rt = req.getRefreshToken();
        if (!jwtUtil.validateToken(rt)) {
            throw new IllegalArgumentException("유효하지 않은 리프레시 토큰입니다");
        }

        Long userId = jwtUtil.getUserIdFromToken(rt);
        if (!redisTokenService.isRefreshTokenValid(userId, rt)) {
            // 탈취된 RT로 재발급 시도 — 전체 세션 무효화
            redisTokenService.deleteRefreshToken(userId);
            throw new IllegalArgumentException("리프레시 토큰이 만료되었거나 이미 사용되었습니다");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다"));

        redisTokenService.deleteRefreshToken(userId);
        return issueTokens(user);
    }

    // 5-5. 로그아웃
    public void logout(Long userId) {
        redisTokenService.deleteRefreshToken(userId);
    }

    // 5-6. 비밀번호 재설정 요청
    @Transactional(readOnly = true)
    public void requestPasswordReset(PasswordResetRequest req) {
        userRepository.findByEmail(req.getEmail()).ifPresent(user -> {
            String token = UUID.randomUUID().toString();
            redisTokenService.savePasswordResetToken(user.getId(), token);
            emailService.sendPasswordResetEmail(user.getEmail(), token);
        });
        // 존재하지 않는 이메일이어도 동일 응답 (사용자 열거 방지)
    }

    // 5-7. 비밀번호 재설정 완료
    @Transactional
    public void confirmPasswordReset(PasswordResetConfirmRequest req) {
        Long userId = redisTokenService.getUserIdByPasswordResetToken(req.getToken());
        if (userId == null) {
            throw new IllegalArgumentException("유효하지 않거나 만료된 재설정 토큰입니다");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다"));

        user.setPassword(passwordEncoder.encode(req.getNewPassword()));
        redisTokenService.deletePasswordResetToken(req.getToken());
        redisTokenService.deleteRefreshToken(userId); // 전체 세션 무효화
    }

    // 소셜 로그인용 공통 토큰 발급 (OAuth2SuccessHandler에서 호출)
    public AuthResponse issueTokens(User user) {
        String at = jwtUtil.generateAccessToken(user);
        String rt = jwtUtil.generateRefreshToken(user);
        redisTokenService.saveRefreshToken(user.getId(), rt);

        return AuthResponse.builder()
                .accessToken(at)
                .refreshToken(rt)
                .user(AuthResponse.UserInfo.builder()
                        .id(user.getId())
                        .nickname(user.getNickname())
                        .profileImage(user.getProfileImage())
                        .build())
                .build();
    }

    private void validateNickname(String nickname) {
        String[] reservedWords = {"admin", "관리자", "운영자"};
        String lower = nickname.toLowerCase();
        for (String word : reservedWords) {
            if (lower.contains(word)) {
                throw new IllegalArgumentException("사용할 수 없는 닉네임입니다");
            }
        }
        if (profanityService.containsProfanity(nickname)) {
            throw new IllegalArgumentException("사용할 수 없는 닉네임입니다");
        }
    }
}
