package com.dobakggun.dto.user;

import com.dobakggun.entity.User;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class UserProfileResponse {
    private Long id;
    private String email;
    private String nickname;
    private String profileImage;
    private String role;
    private String provider;

    public static UserProfileResponse from(User user) {
        return UserProfileResponse.builder()
                .id(user.getId())
                .email(user.getEmail())
                .nickname(user.getNickname())
                .profileImage(user.getProfileImage())
                .role(user.getRole().name())
                .provider(user.getProvider() != null ? user.getProvider().name() : null)
                .build();
    }
}
