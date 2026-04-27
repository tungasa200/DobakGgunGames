package com.dobakggun.dto.battle;

import lombok.Builder;
import lombok.Getter;

/** READY_STATE payload — 결과 화면 준비 상태 브로드캐스트 */
@Getter
@Builder
public class ReadyStatePayload {
    private int readyCount;
    private int totalCount;
}
