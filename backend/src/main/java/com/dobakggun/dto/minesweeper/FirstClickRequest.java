package com.dobakggun.dto.minesweeper;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * FIRST_CLICK 클라이언트 → 서버 요청.
 * 서버는 r==4 && c==4 인지 검증 후 불일치 시 INVALID_FIRST_CLICK 에러 반환.
 */
@Getter
@Setter
@NoArgsConstructor
public class FirstClickRequest {
    private int r;
    private int c;
}
