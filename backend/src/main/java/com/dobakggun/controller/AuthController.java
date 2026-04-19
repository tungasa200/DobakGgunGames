package com.dobakggun.controller;

import com.dobakggun.dto.auth.*;
import com.dobakggun.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    // 이메일 중복 확인
    @GetMapping("/check-email")
    public ResponseEntity<?> checkEmail(@RequestParam String email) {
        boolean taken = authService.isEmailTaken(email);
        return ResponseEntity.ok(Map.of("taken", taken));
    }

    // 닉네임 중복 확인
    @GetMapping("/check-nickname")
    public ResponseEntity<?> checkNickname(@RequestParam String nickname) {
        boolean taken = authService.isNicknameTaken(nickname);
        return ResponseEntity.ok(Map.of("taken", taken));
    }

    // 이메일 OTP 발송
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");

    @PostMapping("/send-email-code")
    public ResponseEntity<?> sendEmailCode(@RequestBody Map<String, String> body) {
        String email = body.getOrDefault("email", "").trim();
        if (email.isEmpty() || !EMAIL_PATTERN.matcher(email).matches()) {
            throw new IllegalArgumentException("올바른 이메일 형식이 아닙니다");
        }
        authService.sendEmailOtp(email);
        return ResponseEntity.ok(Map.of("message", "인증 코드를 발송했습니다"));
    }

    // 이메일 OTP 확인 (소비 없음)
    @PostMapping("/verify-email-code")
    public ResponseEntity<?> verifyEmailCode(@RequestBody Map<String, String> body) {
        String email = body.getOrDefault("email", "").trim();
        String code  = body.getOrDefault("code", "").trim();
        boolean verified = authService.checkEmailOtp(email, code);
        if (!verified) {
            throw new IllegalArgumentException("인증 코드가 올바르지 않거나 만료되었습니다");
        }
        return ResponseEntity.ok(Map.of("verified", true));
    }

    // 5-1. 회원가입
    @PostMapping("/signup")
    public ResponseEntity<?> signup(@Valid @RequestBody SignupRequest req) {
        authService.signup(req);
        return ResponseEntity.ok(Map.of("message", "가입이 완료되었습니다."));
    }

    // 5-2. 이메일 인증
    @GetMapping("/verify")
    public ResponseEntity<?> verifyEmail(@RequestParam String token) {
        authService.verifyEmail(token);
        return ResponseEntity.ok(Map.of("message", "이메일 인증이 완료되었습니다."));
    }

    // 5-3. 로그인
    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest req) {
        return ResponseEntity.ok(authService.login(req));
    }

    // 5-4. 토큰 재발급
    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh(@Valid @RequestBody TokenRefreshRequest req) {
        return ResponseEntity.ok(authService.refresh(req));
    }

    // 5-5. 로그아웃
    @PostMapping("/logout")
    public ResponseEntity<?> logout(@AuthenticationPrincipal Long userId) {
        if (userId != null) {
            authService.logout(userId);
        }
        return ResponseEntity.ok(Map.of("message", "로그아웃 되었습니다."));
    }

    // 5-6. 비밀번호 재설정 요청
    @PostMapping("/password-reset")
    public ResponseEntity<?> requestPasswordReset(@Valid @RequestBody PasswordResetRequest req) {
        authService.requestPasswordReset(req);
        return ResponseEntity.ok(Map.of("message", "비밀번호 재설정 이메일을 발송했습니다."));
    }

    // 5-7. 비밀번호 재설정 완료
    @PostMapping("/password-reset/confirm")
    public ResponseEntity<?> confirmPasswordReset(@Valid @RequestBody PasswordResetConfirmRequest req) {
        authService.confirmPasswordReset(req);
        return ResponseEntity.ok(Map.of("message", "비밀번호가 변경되었습니다. 다시 로그인해 주세요."));
    }
}
