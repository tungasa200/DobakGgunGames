package com.dobakggun.entity.board;

import com.dobakggun.entity.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "board_posts", indexes = {
        @Index(name = "idx_board_posts_created_at", columnList = "created_at DESC"),
        @Index(name = "idx_board_posts_type_created", columnList = "post_type, created_at DESC"),
        @Index(name = "idx_board_posts_author", columnList = "author_id")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class BoardPost {

    public enum PostType { TOURNAMENT, NOTICE, FREE }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "post_type", nullable = false, length = 20)
    private PostType postType;

    @Column(nullable = false, length = 100)
    private String title;

    @Lob
    @Column(name = "content_html", columnDefinition = "MEDIUMTEXT")
    private String contentHtml;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "author_id", nullable = false)
    private User author;

    // TOURNAMENT 전용 필드 (nullable)
    @Column(name = "tournament_date")
    private LocalDate tournamentDate;

    @Column(name = "game_key", length = 30)
    private String gameKey;

    @Column(name = "difficulty_key", length = 20)
    private String difficultyKey;

    @Column(name = "winner", length = 50)
    private String winner;

    @Column(name = "runner_up", length = 50)
    private String runnerUp;

    @Column(name = "ranking", length = 2000)
    private String ranking;

    @Column(name = "participant_count")
    private Integer participantCount;

    @Column(name = "participants", length = 1000)
    private String participants;

    @Column(name = "prize", length = 500)
    private String prize;

    @Column(name = "sponsor", length = 200)
    private String sponsor;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
