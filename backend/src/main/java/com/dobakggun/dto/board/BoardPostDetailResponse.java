package com.dobakggun.dto.board;

import com.dobakggun.entity.board.BoardPost;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;
import java.util.List;

@Getter
@Builder
public class BoardPostDetailResponse {

    private Long id;
    private String postType;
    private String title;
    private String contentHtml;
    private BoardAuthorResponse author;
    private TournamentDataResponse tournamentData;
    private List<BoardCommentResponse> comments;
    private long commentTotalCount;
    private boolean commentHasNext;
    private String commentNextCursor;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static BoardPostDetailResponse of(
            BoardPost post,
            List<BoardCommentResponse> comments,
            long commentTotalCount,
            boolean commentHasNext,
            String commentNextCursor) {

        TournamentDataResponse tournamentData = null;
        if (post.getPostType() == BoardPost.PostType.TOURNAMENT) {
            tournamentData = TournamentDataResponse.from(post);
        }

        return BoardPostDetailResponse.builder()
                .id(post.getId())
                .postType(post.getPostType().name())
                .title(post.getTitle())
                .contentHtml(post.getContentHtml())
                .author(BoardAuthorResponse.from(post.getAuthor()))
                .tournamentData(tournamentData)
                .comments(comments)
                .commentTotalCount(commentTotalCount)
                .commentHasNext(commentHasNext)
                .commentNextCursor(commentNextCursor)
                .createdAt(post.getCreatedAt())
                .updatedAt(post.getUpdatedAt())
                .build();
    }
}
