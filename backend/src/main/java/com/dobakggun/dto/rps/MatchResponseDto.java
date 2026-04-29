package com.dobakggun.dto.rps;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class MatchResponseDto {

    private String roomId;
    private String status;
    private int playerCount;
    private int maxPlayers;
    private boolean created;

    /** 비로그인 게스트에게만 발급. 로그인 사용자는 null (JSON에서 제외됨). */
    private String guestToken;
}
