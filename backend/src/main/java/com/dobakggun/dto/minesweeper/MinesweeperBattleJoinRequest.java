package com.dobakggun.dto.minesweeper;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * POST /api/minesweeper-battle/join 요청 DTO.
 * 로그인 유저는 JWT 에서 nickname 자동 추출 — body 의 nickname 무시.
 * 게스트: guestToken 없으면 신규 발급.
 */
@Getter
@Setter
@NoArgsConstructor
public class MinesweeperBattleJoinRequest {

    /** 게스트 토큰 (guest_{UUID v4} 형식). 게스트 재진입 시 사용. */
    private String guestToken;

    /** 게스트 닉네임 (누락 시 손님-{4자리} 자동 발급). 로그인 유저는 무시. */
    private String nickname;

    /** 게임 난이도 — "BEGINNER" | "INTERMEDIATE". 누락 시 "BEGINNER". */
    private String difficulty;
}
