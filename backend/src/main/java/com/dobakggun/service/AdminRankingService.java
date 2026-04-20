package com.dobakggun.service;

import com.dobakggun.entity.*;
import com.dobakggun.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AdminRankingService {

    private final AppleRankingRepository appleRepo;
    private final BaseballRankingRepository baseballRepo;
    private final MinesweeperRankingRepository minesweeperRepo;
    private final SolitaireRankingRepository solitaireRepo;
    private final BlockfallRankingRepository blockfallRepo;

    public Page<? extends Ranking> getList(String game, String level, LocalDate from, LocalDate to, Pageable pageable) {
        LocalDateTime fromDt = from != null ? from.atStartOfDay() : null;
        LocalDateTime toDt   = to   != null ? to.plusDays(1).atStartOfDay() : null;
        return switch (game.toLowerCase()) {
            case "apple"       -> appleRepo.findFiltered(level, fromDt, toDt, pageable);
            case "baseball"    -> baseballRepo.findFiltered(level, fromDt, toDt, pageable);
            case "minesweeper" -> minesweeperRepo.findFiltered(level, fromDt, toDt, pageable);
            case "solitaire"   -> solitaireRepo.findFiltered(level, fromDt, toDt, pageable);
            case "blockfall"   -> blockfallRepo.findFiltered(level, fromDt, toDt, pageable);
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "알 수 없는 게임: " + game);
        };
    }

    @Transactional
    public void deleteOne(String game, Long id) {
        switch (game.toLowerCase()) {
            case "apple"       -> deleteOrThrow(appleRepo, id);
            case "baseball"    -> deleteOrThrow(baseballRepo, id);
            case "minesweeper" -> deleteOrThrow(minesweeperRepo, id);
            case "solitaire"   -> deleteOrThrow(solitaireRepo, id);
            case "blockfall"   -> deleteOrThrow(blockfallRepo, id);
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "알 수 없는 게임: " + game);
        }
    }

    @Transactional
    public void deleteAll(String game) {
        switch (game.toLowerCase()) {
            case "apple"       -> appleRepo.deleteAll();
            case "baseball"    -> baseballRepo.deleteAll();
            case "minesweeper" -> minesweeperRepo.deleteAll();
            case "solitaire"   -> solitaireRepo.deleteAll();
            case "blockfall"   -> blockfallRepo.deleteAll();
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "알 수 없는 게임: " + game);
        }
    }

    public Map<String, Object> getLeaderboard(String game) {
        List<String> levels = getLevels(game);

        LocalDate today = LocalDate.now();
        LocalDate lastMonday  = today.with(DayOfWeek.MONDAY).minusWeeks(1);
        LocalDateTime weekStart = lastMonday.atStartOfDay();
        LocalDateTime weekEnd   = lastMonday.plusWeeks(1).atStartOfDay();

        Map<String, List<? extends Ranking>> weekly  = new LinkedHashMap<>();
        Map<String, Object>                  alltime = new LinkedHashMap<>();

        for (String level : levels) {
            weekly.put(level, getPreviousWeekTop3(game, level, weekStart, weekEnd));
            alltime.put(level, getAlltimeBest(game, level)); // may be null
        }

        return Map.of("weekly", weekly, "alltime", alltime, "levels", levels);
    }

    // ── private helpers ───────────────────────────────────────

    private List<String> getLevels(String game) {
        return switch (game.toLowerCase()) {
            case "minesweeper" -> List.of("beginner", "intermediate", "expert");
            case "baseball"    -> List.of("easy", "normal", "hard");
            case "solitaire"   -> List.of("draw1", "draw3");
            case "apple"       -> List.of("normal");
            case "blockfall"   -> List.of("normal");
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "알 수 없는 게임: " + game);
        };
    }

    private List<? extends Ranking> getPreviousWeekTop3(String game, String level,
                                                        LocalDateTime weekStart, LocalDateTime weekEnd) {
        return switch (game.toLowerCase()) {
            case "apple"       -> appleRepo.findPreviousWeekTop3(level, weekStart, weekEnd);
            case "baseball"    -> baseballRepo.findPreviousWeekTop3(level, weekStart, weekEnd);
            case "minesweeper" -> minesweeperRepo.findPreviousWeekTop3(level, weekStart, weekEnd);
            case "solitaire"   -> solitaireRepo.findPreviousWeekTop3(level, weekStart, weekEnd);
            case "blockfall"   -> blockfallRepo.findPreviousWeekTop3(level, weekStart, weekEnd);
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "알 수 없는 게임: " + game);
        };
    }

    private Ranking getAlltimeBest(String game, String level) {
        return switch (game.toLowerCase()) {
            case "apple"       -> appleRepo.findAlltimeBest(level);
            case "baseball"    -> baseballRepo.findAlltimeBest(level);
            case "minesweeper" -> minesweeperRepo.findAlltimeBest(level);
            case "solitaire"   -> solitaireRepo.findAlltimeBest(level);
            case "blockfall"   -> blockfallRepo.findAlltimeBest(level);
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "알 수 없는 게임: " + game);
        };
    }

    public Map<String, Long> getCounts() {
        return Map.of(
                "apple",       appleRepo.count(),
                "baseball",    baseballRepo.count(),
                "minesweeper", minesweeperRepo.count(),
                "solitaire",   solitaireRepo.count(),
                "blockfall",   blockfallRepo.count()
        );
    }

    private <T extends Ranking> void deleteOrThrow(RankingRepository<T> repo, Long id) {
        if (!repo.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "랭킹 레코드를 찾을 수 없습니다");
        }
        repo.deleteById(id);
    }
}
