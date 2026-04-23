package com.dobakggun.dto.board;

import com.dobakggun.entity.board.BoardPost;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDate;

@Getter
@Builder
public class TournamentDataResponse {

    private LocalDate tournamentDate;
    private String gameKey;
    private String difficultyKey;
    private String winner;
    private String runnerUp;
    private String ranking;
    private Integer participantCount;
    private String participants;
    private String prize;
    private String sponsor;

    public static TournamentDataResponse from(BoardPost post) {
        return TournamentDataResponse.builder()
                .tournamentDate(post.getTournamentDate())
                .gameKey(post.getGameKey())
                .difficultyKey(post.getDifficultyKey())
                .winner(post.getWinner())
                .runnerUp(post.getRunnerUp())
                .ranking(post.getRanking())
                .participantCount(post.getParticipantCount())
                .participants(post.getParticipants())
                .prize(post.getPrize())
                .sponsor(post.getSponsor())
                .build();
    }
}
