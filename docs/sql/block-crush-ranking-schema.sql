CREATE TABLE block_crush_ranking (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    level         VARCHAR(20)  NOT NULL DEFAULT 'classic',
    name          VARCHAR(50)  NOT NULL,
    score         INT          NOT NULL,
    lines_cleared INT          NOT NULL,
    ip_hash       VARCHAR(64)  NOT NULL,
    user_id       BIGINT       NULL,
    created_at    DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_bcr_level_score   (level, score, created_at),
    KEY idx_bcr_level_created (level, created_at),
    KEY idx_bcr_user          (user_id),
    CONSTRAINT chk_bcr_score  CHECK (score >= 0 AND score <= 9999999),
    CONSTRAINT chk_bcr_lines  CHECK (lines_cleared >= 0 AND lines_cleared <= 100000),
    CONSTRAINT chk_bcr_level  CHECK (level = 'classic')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
