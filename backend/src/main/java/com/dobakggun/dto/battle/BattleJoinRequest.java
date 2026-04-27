package com.dobakggun.dto.battle;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class BattleJoinRequest {
    /** 게스트 재방문 시 기존 토큰 재사용. 첫 방문 또는 로그인 유저는 null. */
    private String guestToken;
}
