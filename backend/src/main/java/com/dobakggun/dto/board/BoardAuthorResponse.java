package com.dobakggun.dto.board;

import com.dobakggun.entity.User;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class BoardAuthorResponse {

    private Long id;
    private String nickname;
    private String profileImage;
    private String role;

    public static BoardAuthorResponse from(User user) {
        return BoardAuthorResponse.builder()
                .id(user.getId())
                .nickname(user.getNickname())
                .profileImage(user.getProfileImage())
                .role(user.getRole().name())
                .build();
    }
}
