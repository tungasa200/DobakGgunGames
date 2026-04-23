package com.dobakggun.dto.board;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Getter
@NoArgsConstructor
public class TournamentDataRequest {

    private LocalDate tournamentDate;

    private String gameKey;

    private String difficultyKey;

    @Size(min = 1, max = 50, message = "우승자는 1~50자여야 합니다")
    private String winner;

    @Size(max = 50, message = "준우승자는 50자 이하여야 합니다")
    private String runnerUp;

    @Size(max = 2000, message = "순위 정보는 2000자 이하여야 합니다")
    private String ranking;

    @Min(value = 1, message = "참가 인원은 1명 이상이어야 합니다")
    @Max(value = 999, message = "참가 인원은 999명 이하여야 합니다")
    private Integer participantCount;

    @Size(max = 1000, message = "참가자 명단은 1000자 이하여야 합니다")
    private String participants;

    @Size(max = 500, message = "상품 정보는 500자 이하여야 합니다")
    private String prize;

    @Size(max = 200, message = "스폰서 정보는 200자 이하여야 합니다")
    private String sponsor;
}
