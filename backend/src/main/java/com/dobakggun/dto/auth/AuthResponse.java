package com.dobakggun.dto.auth;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
@AllArgsConstructor
public class AuthResponse {

    private String accessToken;
    private String refreshToken;
    private UserInfo user;

    @Getter
    @Builder
    @AllArgsConstructor
    public static class UserInfo {
        private Long id;
        private String nickname;
        private String profileImage;
        private String role;
    }
}
