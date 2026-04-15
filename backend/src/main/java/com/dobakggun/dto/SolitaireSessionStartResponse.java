package com.dobakggun.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

/**
 * 솔리테어 세션 시작 응답.
 * deck: 서버가 생성한 52장 카드 순서. 예) "A♠", "10♥", "K♦"
 * 클라이언트는 이 순서를 사용해 초기 패를 구성하고 클라이언트 셔플을 제거.
 */
@Getter
@Builder
public class SolitaireSessionStartResponse {
    private String       sessionId;
    private long         startedAt;  // Unix ms
    private long         expiresAt;  // Unix ms
    private List<String> deck;       // 52 card strings
}
