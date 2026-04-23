package com.dobakggun.dto.board;

import com.dobakggun.entity.board.BoardPost;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class BoardPostSummaryResponse {

    private Long id;
    private String postType;
    private String title;
    private BoardAuthorResponse author;
    private long commentCount;
    private boolean hasImages;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static BoardPostSummaryResponse of(BoardPost post, long commentCount) {
        boolean hasImages = post.getContentHtml() != null
                && post.getContentHtml().contains("<img");
        return BoardPostSummaryResponse.builder()
                .id(post.getId())
                .postType(post.getPostType().name())
                .title(post.getTitle())
                .author(BoardAuthorResponse.from(post.getAuthor()))
                .commentCount(commentCount)
                .hasImages(hasImages)
                .createdAt(post.getCreatedAt())
                .updatedAt(post.getUpdatedAt())
                .build();
    }
}
