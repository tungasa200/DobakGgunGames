package com.dobakggun.dto.battle;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 클라이언트 → 서버 COMBO_ATTACK 메시지.
 * 발행 경로: /app/blockfall-battle/room/{roomId}/combo-attack
 */
@Getter
@Setter
@NoArgsConstructor
public class ComboAttackMessage {
    private String type;
    private int combo;
    /** null 이면 서버가 랜덤 선택 */
    private String targetPlayerId;
}
