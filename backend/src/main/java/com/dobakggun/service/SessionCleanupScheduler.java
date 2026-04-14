package com.dobakggun.service;

import com.dobakggun.repository.GameSessionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Slf4j
@Component
@RequiredArgsConstructor
public class SessionCleanupScheduler {

    // 만료 기준: 최대 세션 유효시간(7200초) + 여유(3600초) = 3시간 이상 지난 세션 삭제
    private static final long DELETE_AFTER_SECONDS = 10_800L;

    private final GameSessionRepository sessionRepo;

    // 매 10분마다 만료 처리
    @Scheduled(fixedDelay = 600_000)
    @Transactional
    public void expireOldSessions() {
        Instant expireBefore = Instant.now().minusSeconds(7200);
        int updated = sessionRepo.expireOldSessions(expireBefore);
        if (updated > 0) {
            log.info("Expired {} stale active sessions", updated);
        }
    }

    // 매 1시간마다 오래된 세션 삭제
    @Scheduled(fixedDelay = 3_600_000)
    @Transactional
    public void deleteOldSessions() {
        Instant deleteBefore = Instant.now().minusSeconds(DELETE_AFTER_SECONDS);
        int deleted = sessionRepo.deleteOldSessions(deleteBefore);
        if (deleted > 0) {
            log.info("Deleted {} old sessions", deleted);
        }
    }
}
