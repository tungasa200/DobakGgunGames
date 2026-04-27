package com.dobakggun.service;

import com.dobakggun.dto.battle.BattleRankingResponse;
import com.dobakggun.entity.battle.BattleRecord;
import com.dobakggun.entity.User;
import com.dobakggun.repository.BattleRecordRepository;
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
public class BattleRankingService {

    private final BattleRecordRepository battleRecordRepository;
    private final UserRepository userRepository;

    /**
     * 역대 승수 TOP 10 조회.
     * PRD §9.1 — win_count DESC, last_played_at DESC
     */
    @Transactional(readOnly = true)
    public List<BattleRankingResponse.RankingEntry> getTopRankings() {
        List<BattleRecord> records = battleRecordRepository
                .findTopRankings(PageRequest.of(0, 10));

        return IntStream.range(0, records.size())
                .mapToObj(i -> {
                    BattleRecord r = records.get(i);
                    return BattleRankingResponse.RankingEntry.builder()
                            .rank(i + 1)
                            .userId(r.getUser().getId())
                            .nickname(r.getUser().getNickname())
                            .winCount(r.getWinCount())
                            .totalGames(r.getTotalGames())
                            .lastPlayedAt(r.getLastPlayedAt())
                            .build();
                })
                .toList();
    }

    /**
     * 로그인 유저 전적 UPSERT.
     * PRD §8.4 — 1위(isWinner=true) → win++, 나머지 → lose++, 모두 total++, lastPlayedAt 갱신
     */
    @Transactional
    public void updateRecord(Long userId, boolean isWinner) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            log.warn("BattleRankingService.updateRecord: userId={} not found", userId);
            return;
        }

        BattleRecord record = battleRecordRepository.findByUserId(userId)
                .orElseGet(() -> BattleRecord.builder()
                        .user(user)
                        .lastPlayedAt(LocalDateTime.now())
                        .build());

        record.setTotalGames(record.getTotalGames() + 1);
        record.setLastPlayedAt(LocalDateTime.now());
        if (isWinner) {
            record.setWinCount(record.getWinCount() + 1);
        } else {
            record.setLoseCount(record.getLoseCount() + 1);
        }

        battleRecordRepository.save(record);
        log.debug("BattleRankingService.updateRecord: userId={} isWinner={} totalGames={}",
                userId, isWinner, record.getTotalGames());
    }
}
