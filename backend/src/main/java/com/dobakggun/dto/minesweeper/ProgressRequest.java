package com.dobakggun.dto.minesweeper;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * PROGRESS_UPDATE 클라이언트 → 서버 요청.
 * 클라이언트가 200ms throttle 로 전송.
 */
@Getter
@Setter
@NoArgsConstructor
public class ProgressRequest {
    private int revealedCount;
}
