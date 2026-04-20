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

import java.util.Map;

@Service
@RequiredArgsConstructor
public class AdminRankingService {

    private final AppleRankingRepository appleRepo;
    private final BaseballRankingRepository baseballRepo;
    private final MinesweeperRankingRepository minesweeperRepo;
    private final SolitaireRankingRepository solitaireRepo;
    private final BlockfallRankingRepository blockfallRepo;

    public Page<? extends Ranking> getList(String game, Pageable pageable) {
        return switch (game.toLowerCase()) {
            case "apple"       -> appleRepo.findAll(pageable);
            case "baseball"    -> baseballRepo.findAll(pageable);
            case "minesweeper" -> minesweeperRepo.findAll(pageable);
            case "solitaire"   -> solitaireRepo.findAll(pageable);
            case "blockfall"   -> blockfallRepo.findAll(pageable);
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
