package com.dobakggun.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "contacts", indexes = {
        @Index(name = "idx_contact_user_id", columnList = "user_id"),
        @Index(name = "idx_contact_status", columnList = "status")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Contact {

    public enum Status { UNREAD, READ, REPLIED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // 로그인 유저 ID (비로그인 문의 대비 nullable)
    @Column(name = "user_id")
    private Long userId;

    @Column(length = 50)
    private String userNickname;

    // 답변 발송 대상 이메일
    @Column(nullable = false, length = 255)
    private String email;

    @Column(nullable = false, length = 50)
    private String category;

    @Column(nullable = false, length = 100)
    private String subject;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String body;

    // R2 파일 키 목록 (JSON 배열 문자열)
    @Column(columnDefinition = "TEXT")
    private String fileKeys;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    @Builder.Default
    private Status status = Status.UNREAD;

    // 어드민 답변 내용
    @Column(columnDefinition = "TEXT")
    private String reply;

    private LocalDateTime repliedAt;

    // 답변한 어드민 userId
    private Long repliedBy;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
