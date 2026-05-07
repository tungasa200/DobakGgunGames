package com.dobakggun.dto.yacht;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class YachtKickVotePayload {
    private Long targetUserId;
    private String targetNickname;
    private int voteCount;
    private int requiredCount;
    /** null=진행 중, true=통과(퇴출), false=미통과 */
    private Boolean passed;
}
