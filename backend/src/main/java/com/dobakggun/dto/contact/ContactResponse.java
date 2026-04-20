package com.dobakggun.dto.contact;

import com.dobakggun.entity.Contact;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class ContactResponse {

    private Long id;
    private Long userId;
    private String userNickname;
    private String category;
    private String subject;
    private String body;
    private String fileKeys;
    private String status;
    private String reply;
    private LocalDateTime repliedAt;
    private LocalDateTime createdAt;

    public static ContactResponse from(Contact c) {
        return ContactResponse.builder()
                .id(c.getId())
                .userId(c.getUserId())
                .userNickname(c.getUserNickname())
                .category(c.getCategory())
                .subject(c.getSubject())
                .body(c.getBody())
                .fileKeys(c.getFileKeys())
                .status(c.getStatus().name())
                .reply(c.getReply())
                .repliedAt(c.getRepliedAt())
                .createdAt(c.getCreatedAt())
                .build();
    }
}
