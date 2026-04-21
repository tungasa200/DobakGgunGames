package com.dobakggun.service;

import com.dobakggun.entity.GameStatus;
import com.dobakggun.repository.GameStatusRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class GameStatusService {

    private static final List<String> DEFAULT_GAMES = List.of(
            "minesweeper", "baseball", "blockfall", "apple", "solitaire", "sudoku"
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

    @Transactional
    public GameStatus setActive(String gameKey, boolean active) {
        GameStatus gs = repo.findById(gameKey)
                .orElseThrow(() -> new IllegalArgumentException("Unknown game: " + gameKey));
        gs.setActive(active);
        return repo.save(gs);
    }
}
