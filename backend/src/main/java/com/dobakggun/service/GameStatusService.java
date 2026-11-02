package com.dobakggun.service;

import com.dobakggun.entity.GameStatus;
import com.dobakggun.exception.GameDisabledException;
import com.dobakggun.repository.GameStatusRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class GameStatusService {

    public static final List<String> DEFAULT_GAMES = List.of(
            "minesweeper", "baseball", "blockfall", "apple", "solitaire", "sudoku",
            "online-rps", "blockfall-battle", "apple-battle", "minesweeper-battle",
            "yacht", "brickbreaker", "block-crush", "blockfall-insane"
    );

    private final GameStatusRepository repo;

    @PostConstruct
    public void initDefaults() {
        for (String key : DEFAULT_GAMES) {
            if (!repo.existsById(key)) {
                repo.save(new GameStatus(key, true));
            }
        }
    }

    public List<GameStatus> listAll() {
        return repo.findAll();
    }

    /** 행이 없는 키는 꺼진 게임이 아니다. 없는 게임의 판단은 각 시작 처리에 맡긴다. */
    public boolean isDisabled(String gameKey) {
        return repo.findById(gameKey).map(gs -> !gs.isActive()).orElse(false);
    }

    /** 매칭 서비스는 재접속 판단 뒤에 부른다. 먼저 부르면 방에 있는 사용자의 재접속까지 막힌다. */
    public void requireEnabled(String gameKey) {
        if (isDisabled(gameKey)) {
            throw new GameDisabledException(gameKey);
        }
    }

    @Transactional
    public GameStatus setActive(String gameKey, boolean active) {
        GameStatus gs = repo.findById(gameKey)
                .orElseThrow(() -> new IllegalArgumentException("Unknown game: " + gameKey));
        gs.setActive(active);
        return repo.save(gs);
    }
}
