package com.dobakggun.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;

@Service
public class HmacService {

    private static final long TIMESTAMP_TOLERANCE_SECONDS = 30;

    @Value("${app.hmac.secret}")
    private String secret;

    /**
     * 클라이언트 전송 토큰 검증.
     * 토큰 형식: HMAC-SHA256(secret, "game:level:value:timestamp")
     */
    public boolean verify(String game, String level, String value, long timestamp, String token) {
        long now = System.currentTimeMillis() / 1000;
        if (Math.abs(now - timestamp) > TIMESTAMP_TOLERANCE_SECONDS) {
            return false;
        }
        String payload = game + ":" + level + ":" + value + ":" + timestamp;
        String expected = compute(payload);
        return expected.equalsIgnoreCase(token);
    }

    public String compute(String payload) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] hash = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            throw new RuntimeException("HMAC 계산 실패", e);
        }
    }
}
