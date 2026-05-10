package com.dobakggun.service;

import com.dobakggun.dto.yacht.YachtRankingResponse;
import com.dobakggun.entity.yacht.YachtDiceType;
import com.dobakggun.entity.yacht.YachtRecord;
import com.dobakggun.entity.User;
import com.dobakggun.repository.YachtRecordRepository;
import com.dobakggun.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.IntStream;

@Slf4j
@Service
@RequiredArgsConstructor
public class YachtRankingService {

    private static final int TOP_N = 10;

    private final YachtRecordRepository yachtRecordRepository;
    private final UserRepository userRepository;

    /**
     * GET /api/yacht/rankings — D6 / D8 분리 응답.
     */
    @Transactional(readOnly = true)
    public YachtRankingResponse getTopRankings() {
        return YachtRankingResponse.builder()
                .d6(fetchRankings(YachtDiceType.D6))
                .d8(fetchRankings(YachtDiceType.D8))
                .build();
    }

    private List<YachtRankingResponse.RankingEntry> fetchRankings(YachtDiceType diceType) {
        List<YachtRecord> records = yachtRecordRepository
                .findTopRankingsByDiceType(diceType, PageRequest.of(0, TOP_N));

        return IntStream.range(0, records.size())
                .mapToObj(i -> {
                    YachtRecord r = records.get(i);
                    return YachtRankingResponse.RankingEntry.builder()
                            .rank(i + 1)
                            .userId(r.getUser().getId())
                            .nickname(r.getUser().getNickname())
                            .winCount(r.getWinCount())
                            .totalScore(r.getWinCount()) // 기존 스키마에 totalScore 컬럼 없음 — winCount로 대체
                            .playedCount(r.getTotalGames())
                            .build();
                })
                .toList();
    }

    /**
     * 게임 종료 후 전적 업데이트. diceType 분기로 모드별 레코드 갱신.
     */
    @Transactional
    public void updateRecord(Long userId, boolean isWinner, YachtDiceType diceType) {
        if (userId == null) return;
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            log.warn("YachtRankingService.updateRecord: userId={} not found", userId);
            return;
        }

        YachtRecord record = yachtRecordRepository
                .findByUserIdAndDiceType(userId, diceType)
                .orElseGet(() -> YachtRecord.builder()
                        .user(user)
                        .diceType(diceType)
                        .lastPlayedAt(LocalDateTime.now())
                        .build());

        record.setTotalGames(record.getTotalGames() + 1);
        record.setLastPlayedAt(LocalDateTime.now());
        if (isWinner) {
            record.setWinCount(record.getWinCount() + 1);
        } else {
            record.setLoseCount(record.getLoseCount() + 1);
        }

        yachtRecordRepository.save(record);
        log.debug("YachtRankingService.updateRecord: userId={} diceType={} isWinner={} totalGames={}",
                userId, diceType, isWinner, record.getTotalGames());
    }
}
