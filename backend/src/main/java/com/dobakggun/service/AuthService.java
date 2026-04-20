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

import java.security.SecureRandom;
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

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    // 이메일 중복 확인 (PENDING은 재가입 허용이므로 taken=false 반환)
    public boolean isEmailTaken(String email) {
        return userRepository.findByEmail(email)
                .map(u -> u.getStatus() != User.Status.PENDING)
                .orElse(false);
    }

    // 닉네임 중복 확인
    public boolean isNicknameTaken(String nickname) {
        return userRepository.existsByNickname(nickname);
    }

    // 이메일 OTP 발송
    public void sendEmailOtp(String email) {
        // ACTIVE/BANNED 계정이면 발송 거부
        userRepository.findByEmail(email).ifPresent(existing -> {
            if (existing.getStatus() == User.Status.BANNED) {
                throw new IllegalArgumentException("정지된 계정입니다");
            }
            if (existing.getStatus() == User.Status.ACTIVE) {
                throw new IllegalArgumentException("이미 사용 중인 이메일입니다");
            }
            // PENDING이면 이전 PENDING 레코드 삭제 후 재발송 허용
            emailVerificationRepository.deleteByUser(existing);
            userRepository.delete(existing);
            userRepository.flush();
        });

        String code = String.format("%06d", SECURE_RANDOM.nextInt(1_000_000));
        emailService.sendEmailOtp(email, code);      // 발송 성공 후에
        redisTokenService.saveEmailOtp(email, code); // Redis 저장
    }

    // 이메일 OTP 확인 (소비하지 않음 — 실제 소비는 signup에서)
    public boolean checkEmailOtp(String email, String code) {
        String stored = redisTokenService.getEmailOtp(email);
        return stored != null && stored.equals(code);
    }

    // 5-1. 회원가입 (OTP 인증 필수 → 가입 즉시 ACTIVE)
    @Transactional
    public void signup(SignupRequest req) {
        // OTP 검증
        String storedOtp = redisTokenService.getEmailOtp(req.getEmail());
        if (storedOtp == null) {
            throw new IllegalArgumentException("이메일 인증 코드가 만료되었습니다. 다시 인증해 주세요");
        }
        if (!storedOtp.equals(req.getEmailCode())) {
            throw new IllegalArgumentException("인증 코드가 올바르지 않습니다");
        }

        // 이메일 중복 검사 (OTP 발송 후 다른 사람이 먼저 가입한 경우 대비)
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
                .status(User.Status.ACTIVE) // OTP 인증 완료 → 즉시 ACTIVE
                .build();
        userRepository.save(user);

        redisTokenService.deleteEmailOtp(req.getEmail()); // OTP 소비
    }

    // 5-2. 이메일 인증 (기존 PENDING 계정용 레거시 링크 처리)
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
                        .role(user.getRole().name())
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
