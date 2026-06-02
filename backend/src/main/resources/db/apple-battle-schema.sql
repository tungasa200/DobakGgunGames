-- 사과게임 배틀 스키마
-- Railway 대시보드 > Query 탭에서 수동 실행 필요

CREATE TABLE IF NOT EXISTS apple_battle_room (
    id              BIGINT      NOT NULL AUTO_INCREMENT,
    room_id         VARCHAR(8)  NOT NULL,
    status          VARCHAR(16) NOT NULL DEFAULT 'WAITING',
    max_players     INT         NOT NULL DEFAULT 2,
    current_players INT         NOT NULL DEFAULT 0,
    created_at      DATETIME(6) NOT NULL,
    started_at      DATETIME(6),
    finished_at     DATETIME(6),
    closed_at       DATETIME(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_apple_battle_room_id (room_id),
    INDEX idx_apple_battle_room_status_created (status, created_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE IF NOT EXISTS apple_battle_record (
    id             BIGINT      NOT NULL AUTO_INCREMENT,
    user_id        BIGINT      NOT NULL,
    win_count      INT         NOT NULL DEFAULT 0,
    lose_count     INT         NOT NULL DEFAULT 0,
    total_games    INT         NOT NULL DEFAULT 0,
    last_played_at DATETIME(6) NOT NULL,
    created_at     DATETIME(6) NOT NULL,
    updated_at     DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_apple_battle_record_user (user_id),
    INDEX idx_apple_battle_record_wins (win_count DESC, last_played_at DESC),
    CONSTRAINT fk_apple_battle_record_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
