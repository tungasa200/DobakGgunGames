package com.dobakggun.security;

import lombok.Getter;

import java.security.Principal;

/**
 * 블록폴 배틀 전용 Principal.
 * 로그인 유저: userId != null, guestId == null, isGuest == false
 * 게스트:      userId == null, guestId = "guest_{uuid}", isGuest == true
 */
@Getter
public class BattlePrincipal implements Principal {

    private final Long userId;
    private final String guestId;
    private final String nickname;
    private final boolean isGuest;

    /** 로그인 유저 생성자 */
    public BattlePrincipal(Long userId, String nickname) {
        this.userId = userId;
        this.guestId = null;
        this.nickname = nickname;
        this.isGuest = false;
    }

    /** 게스트 생성자 */
    public BattlePrincipal(String guestId, String nickname) {
        this.userId = null;
        this.guestId = guestId;
        this.nickname = nickname;
        this.isGuest = true;
    }

    /**
     * Principal.getName() — 로그인 유저는 userId string, 게스트는 guestId.
     * SimpMessagingTemplate.convertAndSendToUser(name, ...) 에서 사용.
     */
    @Override
    public String getName() {
        return isGuest ? guestId : String.valueOf(userId);
    }

    /** 통합 playerId — BOARD_UPDATE 등에서 발신자 식별 */
    public String getPlayerId() {
        return getName();
    }
}
