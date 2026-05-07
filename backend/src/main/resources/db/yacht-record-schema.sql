-- yacht_record: 야추 멀티플레이 승수 기반 랭킹 테이블
-- Railway MySQL에서 수동 실행 필요
CREATE TABLE IF NOT EXISTS yacht_record (
    id             BIGINT       NOT NULL AUTO_INCREMENT,
    user_id        BIGINT       NOT NULL,
    win_count      INT          NOT NULL DEFAULT 0,
    lose_count     INT          NOT NULL DEFAULT 0,
    total_games    INT          NOT NULL DEFAULT 0,
    last_played_at DATETIME     NOT NULL,
    created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_yacht_record_user (user_id),
    INDEX idx_yacht_record_wins (win_count DESC, last_played_at DESC),
    CONSTRAINT fk_yacht_record_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
