package com.dobakggun.dto.rps;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class RpsEnvelopeDto {

    private String type;
    private String timestamp;
    private Object payload;
}
