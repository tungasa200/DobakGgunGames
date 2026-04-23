package com.dobakggun.dto.board;

import com.dobakggun.entity.board.BoardPost;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class CreatePostRequest {

    @NotNull(message = "글 양식을 선택해주세요")
    private BoardPost.PostType postType;

    @NotNull(message = "제목을 입력해주세요")
    @Size(min = 1, max = 100, message = "제목은 1~100자여야 합니다")
    private String title;

    private String contentHtml;

    private TournamentDataRequest tournamentData;
}
