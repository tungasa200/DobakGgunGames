package com.dobakggun.dto.yacht;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class YachtRoomStatePayload {

    private String roomId;
    private String status;
    /** D6 또는 D8. 클라이언트가 점수판 키 셋과 주사위 모델을 결정하는 데 사용. */
    private String diceType;
    private Long hostUserId;
    private int maxPlayers;
    private List<YachtParticipantDto> participants;
}
