package com.dobakggun.dto.admin;

import com.dobakggun.entity.User;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class AdminUserResponse {

    private Long id;
    private String email;
    private String nickname;
    private String profileImage;
    private String role;
    private String status;
    private String provider;
    private LocalDateTime createdAt;

    public static AdminUserResponse from(User u) {
        return AdminUserResponse.builder()
                .id(u.getId())
                .email(u.getEmail())
                .nickname(u.getNickname())
                .profileImage(u.getProfileImage())
                .role(u.getRole().name())
                .status(u.getStatus().name())
                .provider(u.getProvider() != null ? u.getProvider().name() : "LOCAL")
                .createdAt(u.getCreatedAt())
                .build();
    }
}
