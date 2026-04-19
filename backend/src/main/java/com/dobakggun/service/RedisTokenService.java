package com.dobakggun.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
public class RedisTokenService {

    private static final String REFRESH_TOKEN_PREFIX = "refresh_token:";
    private static final String PASSWORD_RESET_PREFIX = "pw_reset:";
    private static final String EMAIL_OTP_PREFIX = "email_otp:";

    private final StringRedisTemplate redisTemplate;

    @Value("${app.jwt.refresh-token-expiry}")
    private long refreshTokenExpiry;

    // Refresh Token

    public void saveRefreshToken(Long userId, String refreshToken) {
        redisTemplate.opsForValue().set(
                REFRESH_TOKEN_PREFIX + userId,
                refreshToken,
                refreshTokenExpiry,
                TimeUnit.SECONDS
        );
    }

    public String getRefreshToken(Long userId) {
        return redisTemplate.opsForValue().get(REFRESH_TOKEN_PREFIX + userId);
    }

    public void deleteRefreshToken(Long userId) {
        redisTemplate.delete(REFRESH_TOKEN_PREFIX + userId);
    }

    public boolean isRefreshTokenValid(Long userId, String token) {
        String stored = getRefreshToken(userId);
        return stored != null && stored.equals(token);
    }

    // Password Reset Token (TTL 30분)

    public void savePasswordResetToken(Long userId, String token) {
        redisTemplate.opsForValue().set(
                PASSWORD_RESET_PREFIX + token,
                String.valueOf(userId),
                30,
                TimeUnit.MINUTES
        );
    }

    public Long getUserIdByPasswordResetToken(String token) {
        String value = redisTemplate.opsForValue().get(PASSWORD_RESET_PREFIX + token);
        return value != null ? Long.valueOf(value) : null;
    }

    public void deletePasswordResetToken(String token) {
        redisTemplate.delete(PASSWORD_RESET_PREFIX + token);
    }

    // Email OTP (TTL 10분)

    public void saveEmailOtp(String email, String code) {
        redisTemplate.opsForValue().set(
                EMAIL_OTP_PREFIX + email, code, 10, TimeUnit.MINUTES
        );
    }

    public String getEmailOtp(String email) {
        return redisTemplate.opsForValue().get(EMAIL_OTP_PREFIX + email);
    }

    public void deleteEmailOtp(String email) {
        redisTemplate.delete(EMAIL_OTP_PREFIX + email);
    }
}
