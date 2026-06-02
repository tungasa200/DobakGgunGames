package com.dobakggun.dto.apple;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

/**
 * /app/apple-battle/room/{roomId}/remove WebSocket 메시지 요청 DTO.
 *
 * <p>클라이언트는 합이 10이 되는 셀 좌표 목록을 전송한다.
 * cells: [[row, col], [row, col], ...]
 */
@Getter
@Setter
@NoArgsConstructor
public class AppleRemoveRequest {

    /**
     * 제거할 셀 좌표 목록.
     * 각 원소는 [row, col] 형태의 List<Integer>.
     */
    private List<List<Integer>> cells;
}
