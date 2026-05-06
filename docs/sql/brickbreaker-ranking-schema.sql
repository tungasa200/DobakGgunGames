CREATE TABLE brickbreaker_ranking (
    id         BIGINT      NOT NULL AUTO_INCREMENT,
    level      VARCHAR(16) NOT NULL DEFAULT 'normal',
    name       VARCHAR(32) NOT NULL,
    score      INT         NOT NULL,
    game_level INT         NOT NULL COMMENT '클리어한 스테이지 (1~10)',
    ip_hash    VARCHAR(64) NULL,
    user_id    BIGINT      NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY idx_bb_level_stage_score (level, game_level, score, created_at),
    KEY idx_bb_level_created     (level, created_at),
    KEY idx_bb_user              (user_id),
    CONSTRAINT chk_bb_score CHECK (score >= 0 AND score <= 99999999),
    CONSTRAINT chk_bb_stage CHECK (game_level >= 1 AND game_level <= 10)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
