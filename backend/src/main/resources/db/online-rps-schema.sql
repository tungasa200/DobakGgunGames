-- Online RPS 스키마 참조용 DDL
-- 실제 적용은 spring.jpa.hibernate.ddl-auto=update 가 수행합니다.
-- 이 파일은 문서/수동 점검용입니다.

CREATE TABLE IF NOT EXISTS rps_room (
    id             BIGINT       NOT NULL AUTO_INCREMENT,
    room_id        VARCHAR(8)   NOT NULL UNIQUE COMMENT '외부 노출 방 식별자 (8자 영소문자+숫자)',
    name           VARCHAR(30)  NOT NULL COMMENT '방 이름 (서버 자동 생성)',
    status         VARCHAR(16)  NOT NULL DEFAULT 'WAITING' COMMENT 'WAITING / PLAYING / FINISHED',
    max_players    INT          NOT NULL DEFAULT 4,
    current_players INT         NOT NULL DEFAULT 0,
    created_by     BIGINT       NOT NULL COMMENT 'FK → users(id)',
    created_at     DATETIME(3)  NOT NULL,
    closed_at      DATETIME(3)  NULL,
    PRIMARY KEY (id),
    INDEX idx_rps_room_status_created (status, created_at),
    INDEX idx_rps_room_room_id (room_id),
    CONSTRAINT fk_rps_room_created_by FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rps_round_result (
    id          BIGINT      NOT NULL AUTO_INCREMENT,
    room_id     BIGINT      NOT NULL COMMENT 'FK → rps_room(id)',
    round_num   INT         NOT NULL,
    player_id   BIGINT      NOT NULL COMMENT 'FK → users(id)',
    choice      VARCHAR(16) NOT NULL COMMENT 'ROCK / PAPER / SCISSORS',
    auto_picked BOOLEAN     NOT NULL DEFAULT FALSE,
    result      VARCHAR(8)  NOT NULL COMMENT 'WIN / LOSS / DRAW',
    played_at   DATETIME(3) NOT NULL,
    PRIMARY KEY (id),
    INDEX idx_rps_round_result_room_round (room_id, round_num),
    INDEX idx_rps_round_result_player_played (player_id, played_at),
    CONSTRAINT fk_rps_round_result_room   FOREIGN KEY (room_id)   REFERENCES rps_room (id),
    CONSTRAINT fk_rps_round_result_player FOREIGN KEY (player_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
