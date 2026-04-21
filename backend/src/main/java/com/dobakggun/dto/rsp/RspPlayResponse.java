package com.dobakggun.dto.rsp;

import com.dobakggun.entity.AdminRspPlay;
import com.dobakggun.entity.RspChoice;
import com.dobakggun.entity.RspResult;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class RspPlayResponse {

    private Long id;
    private RspChoice userChoice;
    private RspChoice computerChoice;
    private RspResult result;
    private LocalDateTime playedAt;
    private RspStatsResponse stats;

    public static RspPlayResponse of(AdminRspPlay play, RspStatsResponse stats) {
        return RspPlayResponse.builder()
                .id(play.getId())
                .userChoice(play.getUserChoice())
                .computerChoice(play.getComputerChoice())
                .result(play.getResult())
                .playedAt(play.getPlayedAt())
                .stats(stats)
                .build();
    }
}
