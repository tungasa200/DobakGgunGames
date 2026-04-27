package com.dobakggun.dto.battle;

import lombok.Builder;
import lombok.Getter;

/** QUEUE_POSITION payload — 개인 채널로 전송 */
@Getter
@Builder
public class QueuePositionPayload {
    private int position;
    private int totalInQueue;
}
