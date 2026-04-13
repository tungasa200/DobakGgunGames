package com.dobakggun.service;

import com.dobakggun.dto.RankingRequest;
import com.dobakggun.dto.RankingResponse;
import com.dobakggun.entity.*;
import com.dobakggun.repository.*;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.DayOfWeek;
import java.time.LocalDateTime;
import java.time.temporal.TemporalAdjusters;
import java.util.HexFormat;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class RankingService {

    private static final Set<String> VALID_GAMES = Set.of("minesweeper", "baseball", "tetris", "solitaire", "apple");
    private static final int RATE_LIMIT_PER_MINUTE = 3;

    private final MinesweeperRankingRepository minesweeperRepo;
    private final BaseballRankingRepository baseballRepo;
    private final TetrisRankingRepository tetrisRepo;
    private final SolitaireRankingRepository solitaireRepo;
    private final AppleRankingRepository appleRepo;
    private final HmacService hmacService;

    public List<RankingResponse> getWeeklyRankings(String game, String level) {
        validateGame(game);
        LocalDateTime weekStart = LocalDateTime.now()
                .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
                .toLocalDate().atStartOfDay();
        List<? extends Ranking> rankings = queryWeekly(game, level, weekStart);
        return rankings.stream().map(RankingResponse::new).toList();
    }

    public RankingResponse getAlltimeBest(String game, String level) {
        validateGame(game);
        Ranking best = queryAlltimeBest(game, level);
        return best == null ? null : new RankingResponse(best);
    }

    public RankingResponse submit(String game, RankingRequest req, HttpServletRequest httpReq) {
        validateGame(game);
        validateLevel(game, req.getLevel());

        String ipHash = hashIp(getClientIp(httpReq));

        // Rate limit
        LocalDateTime oneMinuteAgo = LocalDateTime.now().minusMinutes(1);
        long recentCount = countByIpHash(game, ipHash, oneMinuteAgo);
        if (recentCount >= RATE_LIMIT_PER_MINUTE) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "잠시 후 다시 시도해주세요.");
        }

        // HMAC 검증
        String value = extractValue(game, req);
        if (req.getTimestamp() == null || !hmacService.verify(game, req.getLevel(), value, req.getTimestamp(), req.getToken())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "유효하지 않은 요청입니다.");
        }

        // 점수 범위 검증
        validateScoreBounds(game, req);

        Ranking saved = saveRanking(game, req, ipHash);
        return new RankingResponse(saved);
    }

    private List<? extends Ranking> queryWeekly(String game, String level, LocalDateTime weekStart) {
        return switch (game) {
            case "minesweeper" -> minesweeperRepo.findWeekly(level, weekStart);
            case "baseball"    -> baseballRepo.findWeekly(level, weekStart);
            case "tetris"      -> tetrisRepo.findWeekly(level, weekStart);
            case "solitaire"   -> solitaireRepo.findWeekly(level, weekStart);
            case "apple"       -> appleRepo.findWeekly(level, weekStart);
            default -> List.of();
        };
    }

    private Ranking queryAlltimeBest(String game, String level) {
        return switch (game) {
            case "minesweeper" -> minesweeperRepo.findAlltimeBest(level);
            case "baseball"    -> baseballRepo.findAlltimeBest(level);
            case "tetris"      -> tetrisRepo.findAlltimeBest(level);
            case "solitaire"   -> solitaireRepo.findAlltimeBest(level);
            case "apple"       -> appleRepo.findAlltimeBest(level);
            default -> null;
        };
    }

    private long countByIpHash(String game, String ipHash, LocalDateTime after) {
        return switch (game) {
            case "minesweeper" -> minesweeperRepo.countByIpHashAndCreatedAtAfter(ipHash, after);
            case "baseball"    -> baseballRepo.countByIpHashAndCreatedAtAfter(ipHash, after);
            case "tetris"      -> tetrisRepo.countByIpHashAndCreatedAtAfter(ipHash, after);
            case "solitaire"   -> solitaireRepo.countByIpHashAndCreatedAtAfter(ipHash, after);
            case "apple"       -> appleRepo.countByIpHashAndCreatedAtAfter(ipHash, after);
            default -> 0L;
        };
    }

    private Ranking saveRanking(String game, RankingRequest req, String ipHash) {
        return switch (game) {
            case "minesweeper" -> minesweeperRepo.save(MinesweeperRanking.builder()
                    .level(req.getLevel()).name(req.getName().trim())
                    .time(req.getTime()).ipHash(ipHash).build());
            case "baseball" -> baseballRepo.save(BaseballRanking.builder()
                    .level(req.getLevel()).name(req.getName().trim())
                    .attempts(req.getAttempts()).time(req.getTime()).ipHash(ipHash).build());
            case "tetris" -> tetrisRepo.save(TetrisRanking.builder()
                    .level(req.getLevel()).name(req.getName().trim())
                    .score(req.getScore()).gameLevel(req.getGameLevel()).ipHash(ipHash).build());
            case "solitaire" -> solitaireRepo.save(SolitaireRanking.builder()
                    .level(req.getLevel()).name(req.getName().trim())
                    .time(req.getTime()).moves(req.getMoves()).ipHash(ipHash).build());
            case "apple" -> appleRepo.save(AppleRanking.builder()
                    .level(req.getLevel()).name(req.getName().trim())
                    .score(req.getScore()).ipHash(ipHash).build());
            default -> throw new ResponseStatusException(HttpStatus.NOT_FOUND, "존재하지 않는 게임입니다.");
        };
    }

    private String extractValue(String game, RankingRequest req) {
        return switch (game) {
            case "minesweeper", "solitaire" -> String.valueOf(req.getTime());
            case "baseball"                 -> String.valueOf(req.getAttempts());
            case "tetris", "apple"          -> String.valueOf(req.getScore());
            default -> "";
        };
    }

    private void validateScoreBounds(String game, RankingRequest req) {
        boolean invalid = switch (game) {
            case "minesweeper" -> req.getTime() == null || req.getTime() < 0.4 || req.getTime() > 3600;
            case "baseball"    -> req.getAttempts() == null || req.getAttempts() < 1 || req.getAttempts() > 999;
            case "tetris"      -> req.getScore() == null || req.getScore() < 0 || req.getScore() > 9_999_999;
            case "solitaire"   -> req.getTime() == null || req.getTime() < 1 || req.getMoves() == null || req.getMoves() < 1;
            case "apple"       -> req.getScore() == null || req.getScore() < 0 || req.getScore() > 1200;
            default -> true;
        };
        if (invalid) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "유효하지 않은 점수입니다.");
        }
    }

    private void validateGame(String game) {
        if (!VALID_GAMES.contains(game)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "존재하지 않는 게임입니다.");
        }
    }

    private void validateLevel(String game, String level) {
        Set<String> valid = switch (game) {
            case "minesweeper" -> Set.of("beginner", "intermediate", "expert");
            case "baseball"    -> Set.of("easy", "normal", "hard");
            case "tetris"      -> Set.of("easy", "normal", "hard");
            case "solitaire"   -> Set.of("draw1", "draw3");
            case "apple"       -> Set.of("normal");
            default -> Set.of();
        };
        if (!valid.contains(level)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "유효하지 않은 레벨입니다.");
        }
    }

    private String getClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isBlank()) {
            return xForwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private String hashIp(String ip) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest((ip + "dobakggun_salt").getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            return "unknown";
        }
    }
}
