package com.dobakggun.dto.battle;

import lombok.Builder;
import lombok.Getter;

/** GARBAGE_ATTACK payload */
@Getter
@Builder
public class GarbageAttackPayload {
    private String targetPlayerId;
    private int lines;
    private String fromPlayerId;
}
