package com.dobakggun.service;

import com.dobakggun.dto.RankingRequest;
import com.dobakggun.entity.GameSession;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class AppleValidationService {

    private final ObjectMapper objectMapper;

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

        // 5. Phase 3 — 서버 보드가 있을 때 좌표 및 합 완전 검증
        int[][] board = extractBoard(session.getExtra());
        if (board != null) {
            validateWithBoard(events, board);
        }
    }

    /**
     * 서버 보드 기반 이벤트 완전 검증.
     * 각 이벤트의 좌표가 보드 범위 내에 있고, 해당 셀들의 합이 10인지 검증.
     */
    private void validateWithBoard(List<RankingRequest.AppleEvent> events, int[][] board) {
        int rows = board.length;
        int cols = rows > 0 ? board[0].length : 0;

        for (RankingRequest.AppleEvent event : events) {
            List<List<Integer>> cells = event.getCells();
            if (cells == null) continue;

            int sum = 0;
            for (List<Integer> coord : cells) {
                if (coord == null || coord.size() < 2) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "이벤트 좌표 형식이 잘못되었습니다.");
                }
                int r = coord.get(0), c = coord.get(1);
                if (r < 0 || r >= rows || c < 0 || c >= cols) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "이벤트 좌표가 보드 범위를 벗어났습니다.");
                }
                sum += board[r][c];
            }
            if (sum != 10) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "이벤트 셀의 합이 10이 아닙니다.");
            }
        }
    }

    @SuppressWarnings("unchecked")
    private int[][] extractBoard(String extra) {
        if (extra == null) return null;
        try {
            Map<String, Object> map = objectMapper.readValue(extra, new TypeReference<>() {});
            Object boardObj = map.get("board");
            if (!(boardObj instanceof List)) return null;
            List<List<Integer>> raw = (List<List<Integer>>) boardObj;
            int rows = raw.size();
            if (rows == 0) return null;
            int cols = raw.get(0).size();
            int[][] board = new int[rows][cols];
            for (int r = 0; r < rows; r++)
                for (int c = 0; c < cols; c++)
                    board[r][c] = ((Number) raw.get(r).get(c)).intValue();
            return board;
        } catch (Exception e) {
            log.warn("Apple board extraction failed: {}", e.getMessage());
            return null;
        }
    }
}
