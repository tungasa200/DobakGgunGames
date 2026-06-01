package com.dobakggun.dto;

import lombok.Builder;
import lombok.Getter;

/**
 * GET /api/minesweeper-battle/rooms/waiting
 * GET /api/blockfall-battle/rooms/waiting
 * 공통 대기방 목록 응답 항목 DTO.
 */
@Getter
@Builder
public class WaitingRoomInfo {
    private String roomId;
    private int currentPlayers;
    private int maxPlayers;
    /** 방장/첫 번째 플레이어 닉네임. 찾을 수 없으면 null. */
    private String hostNickname;
    /** ISO 8601. 인메모리 전용 방이거나 createdAt 미지원 시 null. */
    private String createdAt;
}
