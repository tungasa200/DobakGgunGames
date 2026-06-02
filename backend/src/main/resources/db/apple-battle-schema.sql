-- 사과게임 배틀 스키마
-- Railway 대시보드 > Query 탭에서 수동 실행 필요

CREATE TABLE IF NOT EXISTS apple_battle_record (
    id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id      BIGINT NOT NULL,
    win_count    INT    NOT NULL DEFAULT 0,
    lose_count   INT    NOT NULL DEFAULT 0,
    total_games  INT    NOT NULL DEFAULT 0,
    last_played_at DATETIME NOT NULL,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT uq_apple_battle_record_user UNIQUE (user_id),
    CONSTRAINT fk_apple_battle_record_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    INDEX idx_apple_battle_record_wins (win_count DESC, last_played_at DESC)
);
