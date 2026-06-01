-- 지뢰찾기 배틀 전적 테이블 신규 생성 (blockfall battle_record 에서 분리)
CREATE TABLE IF NOT EXISTS minesweeper_battle_record (
    id         BIGINT NOT NULL AUTO_INCREMENT,
    user_id    BIGINT NOT NULL,
    win_count  INT    NOT NULL DEFAULT 0,
    lose_count INT    NOT NULL DEFAULT 0,
    total_games INT   NOT NULL DEFAULT 0,
    last_played_at DATETIME(6) NOT NULL,
    created_at     DATETIME(6) NOT NULL,
    updated_at     DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_ms_battle_record_user (user_id),
    INDEX idx_ms_battle_record_wins (win_count DESC, last_played_at DESC),
    CONSTRAINT fk_ms_battle_record_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- 지뢰찾기 배틀 방 테이블 신규 생성 (blockfall battle_room 에서 분리)
CREATE TABLE IF NOT EXISTS minesweeper_battle_room (
    id              BIGINT      NOT NULL AUTO_INCREMENT,
    room_id         VARCHAR(8)  NOT NULL,
    status          VARCHAR(16) NOT NULL DEFAULT 'WAITING',
    max_players     INT         NOT NULL DEFAULT 2,
    current_players INT         NOT NULL DEFAULT 0,
    queue_count     INT         NOT NULL DEFAULT 0,
    created_at      DATETIME(6) NOT NULL,
    started_at      DATETIME(6),
    finished_at     DATETIME(6),
    closed_at       DATETIME(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_ms_battle_room_id (room_id),
    INDEX idx_ms_battle_room_status_created (status, created_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- 기존 battle_record 에서 minesweeper 전적 이전
INSERT INTO minesweeper_battle_record (user_id, win_count, lose_count, total_games, last_played_at, created_at, updated_at)
SELECT user_id, win_count, lose_count, total_games, last_played_at, created_at, updated_at
FROM battle_record
WHERE game_key = 'minesweeper';

-- 이전 완료 후 battle_record 에서 minesweeper 데이터 삭제
DELETE FROM battle_record WHERE game_key = 'minesweeper';

-- battle_record 에서 game_key 관련 인덱스 제거
ALTER TABLE battle_record DROP INDEX IF EXISTS idx_battle_record_game_wins;

-- battle_record 에서 game_key 컬럼 제거
ALTER TABLE battle_record DROP COLUMN IF EXISTS game_key;

-- battle_record 에 user_id UNIQUE 제약 추가 (blockfall 전용이 됐으므로)
-- 이미 존재할 경우 오류가 나므로 먼저 확인 후 실행할 것
-- ALTER TABLE battle_record ADD UNIQUE KEY uq_battle_record_user (user_id);
