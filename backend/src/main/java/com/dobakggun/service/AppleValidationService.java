package com.dobakggun.service;

import com.dobakggun.dto.RankingRequest;
import com.dobakggun.entity.GameSession;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AppleValidationService {

    // 사과게임 고정 제한 시간 120초 + 여유 5초
    private static final long MAX_GAME_MS = 125_000L;
    // 연속 이상 탐지 기준: 200ms 미만 간격이 이 횟수 이상 연속이면 거부
    private static final int RAPID_FIRE_THRESHOLD = 5;
    private static final int RAPID_FIRE_MIN_GAP_MS = 200;

    public void validate(GameSession session, RankingRequest req) {
        List<RankingRequest.AppleEvent> events = req.getEvents();
        Integer score = req.getScore();

        if (events == null || events.isEmpty() || score == null) return;

        // 1. 모든 이벤트의 cells 수 합산 == score
        int totalCells = events.stream()
            .mapToInt(e -> e.getCells() == null ? 0 : e.getCells().size())
            .sum();
        if (totalCells != score) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "이벤트 셀 수 합산이 점수와 일치하지 않습니다.");
        }

        // 2. 이벤트 타임스탬프 범위 검증
        Instant startedAt = session.getStartedAt();
        for (RankingRequest.AppleEvent event : events) {
            if (event.getT() < 0 || event.getT() > MAX_GAME_MS) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "이벤트 타임스탬프가 유효 범위를 벗어났습니다.");
            }
        }

        // 3. 단일 이벤트 최소 2개 셀 (1+9=10 등 2개도 합이 10 가능)
        for (RankingRequest.AppleEvent event : events) {
            if (event.getCells() != null && event.getCells().size() < 2) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "유효하지 않은 이벤트 데이터입니다.");
            }
        }

        // 4. 연속 rapid-fire 탐지
        int rapidCount = 0;
        for (int i = 1; i < events.size(); i++) {
            long gap = events.get(i).getT() - events.get(i - 1).getT();
            if (gap < RAPID_FIRE_MIN_GAP_MS) {
                rapidCount++;
                if (rapidCount >= RAPID_FIRE_THRESHOLD) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "비정상적인 입력 패턴이 감지되었습니다.");
                }
            } else {
                rapidCount = 0;
            }
        }
    }
}
