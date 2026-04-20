package com.dobakggun.service;

import com.dobakggun.entity.Contact;
import com.dobakggun.entity.User;
import com.dobakggun.repository.ContactRepository;
import com.dobakggun.repository.GameSessionRepository;
import com.dobakggun.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

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
