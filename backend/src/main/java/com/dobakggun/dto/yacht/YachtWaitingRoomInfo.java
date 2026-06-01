package com.dobakggun.dto.yacht;

import lombok.Builder;
import lombok.Getter;

/**
 * GET /api/yacht/rooms/waiting 응답 항목 DTO.
 */
@Getter
@Builder
public class YachtWaitingRoomInfo {
    private String roomId;
    private int currentPlayers;
    private int maxPlayers;
    /** 방장 닉네임 (User 조회). 방장 탈퇴 등으로 찾지 못하면 null. */
    private String hostNickname;
    /** "D6" 또는 "D8" */
    private String diceType;
    /** ISO 8601 (LocalDateTime.toString()) */
    private String createdAt;
}
