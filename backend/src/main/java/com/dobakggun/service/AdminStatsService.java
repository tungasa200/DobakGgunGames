package com.dobakggun.service;

import com.dobakggun.entity.Contact;
import com.dobakggun.entity.User;
import com.dobakggun.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminStatsService {

    private final UserRepository userRepository;
    private final ContactRepository contactRepository;
    private final GameSessionRepository gameSessionRepository;
    private final IpBanRepository ipBanRepository;
    private final PatchNoteRepository patchNoteRepository;
    private final GameStatusRepository gameStatusRepository;
    private final MinesweeperRankingRepository minesweeperRankingRepository;
    private final SolitaireRankingRepository solitaireRankingRepository;
    private final AppleRankingRepository appleRankingRepository;
    private final BaseballRankingRepository baseballRankingRepository;
    private final BlockfallRankingRepository blockfallRankingRepository;
    private final SudokuRankingRepository sudokuRankingRepository;

    public Map<String, Object> getSummary() {
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("totalUsers", userRepository.count());
        summary.put("activeUsers", userRepository.countByStatus(User.Status.ACTIVE));
        summary.put("pendingUsers", userRepository.countByStatus(User.Status.PENDING));
        summary.put("bannedUsers", userRepository.countByStatus(User.Status.BANNED));
        summary.put("totalSessions", gameSessionRepository.count());
        summary.put("unreadContacts", contactRepository.countByStatus(Contact.Status.UNREAD));
        summary.put("totalContacts", contactRepository.count());
        summary.put("ipBanCount", ipBanRepository.count());
        summary.put("patchNoteCount", patchNoteRepository.count());
        summary.put("activeGames", gameStatusRepository.countByActiveTrue());
        summary.put("totalGames", gameStatusRepository.count());
        return summary;
    }

    public List<Map<String, Object>> getSessionTrend(int days) {
        Instant since = Instant.now().minus(days, ChronoUnit.DAYS);
        List<Object[]> rows = gameSessionRepository.countByDaySince(since);
        return rows.stream().map(row -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("date", row[0].toString());
            m.put("count", row[1]);
            return m;
        }).toList();
    }

    public List<Map<String, Object>> getWeeklySessionTrend() {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        LocalDate monday = today.with(DayOfWeek.MONDAY);
        LocalDate nextMonday = monday.plusWeeks(1);
        Instant weekStart = monday.atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant weekEnd = nextMonday.atStartOfDay(ZoneOffset.UTC).toInstant();

        List<Object[]> rows = gameSessionRepository.countByDayInWeek(weekStart, weekEnd);
        Map<LocalDate, Long> countMap = rows.stream()
                .collect(Collectors.toMap(
                        row -> LocalDate.parse(row[0].toString()),
                        row -> ((Number) row[1]).longValue()
                ));

        List<Map<String, Object>> result = new ArrayList<>();
        for (LocalDate d = monday; d.isBefore(nextMonday); d = d.plusDays(1)) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("date", d.toString());
            m.put("count", countMap.getOrDefault(d, 0L));
            result.add(m);
        }
        return result;
    }

    public List<Map<String, Object>> getGameCounts() {
        List<Object[]> rows = gameSessionRepository.countByGame();
        return rows.stream().map(row -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("game", row[0]);
            m.put("count", row[1]);
            return m;
        }).toList();
    }

    public List<Map<String, Object>> getRankingCounts() {
        List<Map<String, Object>> result = new ArrayList<>();
        result.add(Map.of("game", "minesweeper", "count", minesweeperRankingRepository.count()));
        result.add(Map.of("game", "solitaire",   "count", solitaireRankingRepository.count()));
        result.add(Map.of("game", "apple",        "count", appleRankingRepository.count()));
        result.add(Map.of("game", "baseball",     "count", baseballRankingRepository.count()));
        result.add(Map.of("game", "blockfall",    "count", blockfallRankingRepository.count()));
        result.add(Map.of("game", "sudoku",       "count", sudokuRankingRepository.count()));
        return result;
    }

    public List<Map<String, Object>> getWeeklyRankingCounts() {
        LocalDate today = LocalDate.now();
        LocalDate monday = today.with(DayOfWeek.MONDAY);
        LocalDateTime weekStart = monday.atStartOfDay();
        LocalDateTime weekEnd = monday.plusWeeks(1).atStartOfDay();

        Map<LocalDate, Long> countMap = new LinkedHashMap<>();
        for (LocalDate d = monday; d.isBefore(monday.plusWeeks(1)); d = d.plusDays(1)) {
            countMap.put(d, 0L);
        }

        mergeRankingDayCounts(countMap, minesweeperRankingRepository.countByDayInWeek(weekStart, weekEnd));
        mergeRankingDayCounts(countMap, solitaireRankingRepository.countByDayInWeek(weekStart, weekEnd));
        mergeRankingDayCounts(countMap, appleRankingRepository.countByDayInWeek(weekStart, weekEnd));
        mergeRankingDayCounts(countMap, baseballRankingRepository.countByDayInWeek(weekStart, weekEnd));
        mergeRankingDayCounts(countMap, blockfallRankingRepository.countByDayInWeek(weekStart, weekEnd));
        mergeRankingDayCounts(countMap, sudokuRankingRepository.countByDayInWeek(weekStart, weekEnd));

        return countMap.entrySet().stream().map(e -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("date", e.getKey().toString());
            m.put("count", e.getValue());
            return m;
        }).toList();
    }

    private void mergeRankingDayCounts(Map<LocalDate, Long> map, List<Object[]> rows) {
        for (Object[] row : rows) {
            LocalDate date = LocalDate.parse(row[0].toString());
            long count = ((Number) row[1]).longValue();
            map.merge(date, count, (a, b) -> a + b);
        }
    }
}
