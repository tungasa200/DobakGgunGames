package com.dobakggun.service;

import com.dobakggun.dto.yacht.YachtRankingResponse;
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

    private final YachtRecordRepository yachtRecordRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<YachtRankingResponse.RankingEntry> getTopRankings() {
        List<YachtRecord> records = yachtRecordRepository
                .findTopRankings(PageRequest.of(0, 10));

        return IntStream.range(0, records.size())
                .mapToObj(i -> {
                    YachtRecord r = records.get(i);
                    return YachtRankingResponse.RankingEntry.builder()
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

    @Transactional
    public void updateRecord(Long userId, boolean isWinner) {
        if (userId == null) return;
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            log.warn("YachtRankingService.updateRecord: userId={} not found", userId);
            return;
        }

        YachtRecord record = yachtRecordRepository.findByUserId(userId)
                .orElseGet(() -> YachtRecord.builder()
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

        yachtRecordRepository.save(record);
        log.debug("YachtRankingService.updateRecord: userId={} isWinner={} totalGames={}",
                userId, isWinner, record.getTotalGames());
    }
}
