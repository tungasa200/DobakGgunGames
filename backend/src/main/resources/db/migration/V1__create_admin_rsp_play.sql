-- 참조용 SQL (적용 방식: JPA ddl-auto=update 자동 생성)
-- 이 파일은 스키마 변경 투명성을 위한 참조 문서입니다.
-- Railway 프로덕션에 직접 실행하지 마십시오.
-- 실제 DDL은 JPA ddl-auto=update가 애플리케이션 기동 시 처리합니다.

CREATE TABLE IF NOT EXISTS admin_rsp_play (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    admin_user_id   BIGINT NOT NULL,
    user_choice     ENUM('ROCK','SCISSORS','PAPER') NOT NULL,
    computer_choice ENUM('ROCK','SCISSORS','PAPER') NOT NULL,
    result          ENUM('WIN','LOSS','DRAW') NOT NULL,
    played_at       DATETIME(6) NOT NULL,
    CONSTRAINT fk_admin_rsp_play_user
        FOREIGN KEY (admin_user_id) REFERENCES users(id)
        ON DELETE CASCADE,
    INDEX idx_admin_rsp_play_user_played (admin_user_id, played_at DESC)
);
