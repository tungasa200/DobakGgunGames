package com.dobakggun.dto.minesweeper;

import lombok.Builder;
import lombok.Getter;

import java.util.List;
import java.util.Map;

/**
 * MATCH_READY WebSocket 페이로드.
 * 2번째 플레이어 입장 즉시 각 플레이어 개인 큐 (/user/queue/minesweeper-battle/state)로 발송.
 * opponentNickname 은 수신자 관점의 상대 닉네임 — 개별 발송으로 다르게 세팅.
 */
@Getter
@Builder
public class MatchReadyPayload {

    private String roomId;

    /** 지정 첫 클릭 셀 좌표 (난이도에 따라 다름) */
    private Map<String, Integer> designatedCell;

    /** 방에 있는 모든 플레이어 정보 (공용) */
    private List<PlayerEntry> players;

    /** 수신자 기준 상대 닉네임 */
    private String opponentNickname;

    /** FIRST_CLICK 타임아웃 (ms) = 30000 */
    private long firstClickTimeoutMs;

    /** 보드 크기 및 난이도 정보 */
    private int rows;
    private int cols;
    private int totalSafeCells;
    private String difficulty;

    @Getter
    @Builder
    public static class PlayerEntry {
        private String playerId;
        private String nickname;
        private boolean isGuest;
    }
}
