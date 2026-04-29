package com.dobakggun.dto.yacht;

import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.List;

@Getter
@NoArgsConstructor
public class YachtRollRequest {

    /** 고정할 주사위 인덱스 배열 (0~4). 첫 굴림이면 빈 배열. */
    private List<Integer> keptIndices;
}
