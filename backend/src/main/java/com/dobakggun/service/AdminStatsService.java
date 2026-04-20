package com.dobakggun.service;

import com.dobakggun.entity.Contact;
import com.dobakggun.entity.User;
import com.dobakggun.repository.ContactRepository;
import com.dobakggun.repository.GameSessionRepository;
import com.dobakggun.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
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

    public Map<String, Object> getSummary() {
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("totalUsers", userRepository.count());
        summary.put("activeUsers", userRepository.countByStatus(User.Status.ACTIVE));
        summary.put("pendingUsers", userRepository.countByStatus(User.Status.PENDING));
        summary.put("bannedUsers", userRepository.countByStatus(User.Status.BANNED));
        summary.put("totalSessions", gameSessionRepository.count());
        summary.put("unreadContacts", contactRepository.countByStatus(Contact.Status.UNREAD));
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
}
