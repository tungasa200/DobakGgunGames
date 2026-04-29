package com.dobakggun.dto.yacht;

import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class YachtScoreRequest {

    /** 족보 키. ONES/TWOS/.../YACHT 중 하나. */
    private String scoreKey;
}
