-- Blockfall Battle 스키마
-- PRD: docs/specs/blockfall-battle-prd.md §12
-- 적용: Railway MySQL 콘솔에서 직접 실행 (또는 spring.jpa.hibernate.ddl-auto=update 자동 처리)

CREATE TABLE IF NOT EXISTS battle_room (
    id              BIGINT       NOT NULL AUTO_INCREMENT,
    room_id         VARCHAR(8)   NOT NULL,
    status          VARCHAR(16)  NOT NULL,
    max_players     INT          NOT NULL DEFAULT 4,
    current_players INT          NOT NULL DEFAULT 0,
    queue_count     INT          NOT NULL DEFAULT 0,
    created_at      DATETIME(3)  NOT NULL,
    started_at      DATETIME(3)  NULL,
    finished_at     DATETIME(3)  NULL,
    closed_at       DATETIME(3)  NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_battle_room_room_id (room_id),
    KEY idx_battle_room_status_created (status, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS battle_record (
    id              BIGINT       NOT NULL AUTO_INCREMENT,
    user_id         BIGINT       NOT NULL,
    win_count       INT          NOT NULL DEFAULT 0,
    lose_count      INT          NOT NULL DEFAULT 0,
    total_games     INT          NOT NULL DEFAULT 0,
    last_played_at  DATETIME(3)  NOT NULL,
    created_at      DATETIME(3)  NOT NULL,
    updated_at      DATETIME(3)  NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_battle_record_user_id (user_id),
    KEY idx_battle_record_wins (win_count DESC, last_played_at DESC),
    CONSTRAINT fk_battle_record_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
