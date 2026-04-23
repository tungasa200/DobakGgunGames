package com.dobakggun.dto.board;

import com.dobakggun.entity.board.BoardComment;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class BoardCommentResponse {

    private Long id;
    private Long postId;
    private BoardAuthorResponse author;
    private String content;
    private LocalDateTime createdAt;

    public static BoardCommentResponse from(BoardComment comment) {
        return BoardCommentResponse.builder()
                .id(comment.getId())
                .postId(comment.getPost().getId())
                .author(BoardAuthorResponse.from(comment.getAuthor()))
                .content(comment.getContent())
                .createdAt(comment.getCreatedAt())
                .build();
    }
}
