-- 참조용 SQL (적용 방식: JPA ddl-auto=update 자동 생성)
-- 이 파일은 스키마 변경 투명성을 위한 참조 문서입니다.
-- Railway 프로덕션에 직접 실행하지 마십시오.
-- 실제 DDL은 JPA ddl-auto=update가 애플리케이션 기동 시 처리합니다.

CREATE TABLE IF NOT EXISTS board_posts (
    id                BIGINT AUTO_INCREMENT PRIMARY KEY,
    post_type         VARCHAR(20)    NOT NULL COMMENT 'TOURNAMENT / NOTICE / FREE',
    title             VARCHAR(100)   NOT NULL,
    content_html      MEDIUMTEXT     NULL COMMENT 'sanitize된 HTML (TOURNAMENT nullable)',
    author_id         BIGINT         NOT NULL,
    tournament_date   DATE           NULL,
    game_key          VARCHAR(30)    NULL,
    difficulty_key    VARCHAR(20)    NULL,
    winner            VARCHAR(50)    NULL,
    runner_up         VARCHAR(50)    NULL,
    ranking           VARCHAR(2000)  NULL,
    participant_count INT            NULL,
    participants      VARCHAR(1000)  NULL,
    prize             VARCHAR(500)   NULL,
    sponsor           VARCHAR(200)   NULL,
    created_at        DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_board_posts_author
        FOREIGN KEY (author_id) REFERENCES users(id),
    INDEX idx_board_posts_created_at    (created_at DESC),
    INDEX idx_board_posts_type_created  (post_type, created_at DESC),
    INDEX idx_board_posts_author        (author_id)
);

CREATE TABLE IF NOT EXISTS board_comments (
    id          BIGINT        AUTO_INCREMENT PRIMARY KEY,
    post_id     BIGINT        NOT NULL,
    author_id   BIGINT        NOT NULL,
    content     VARCHAR(1000) NOT NULL,
    created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_board_comments_post
        FOREIGN KEY (post_id) REFERENCES board_posts(id) ON DELETE CASCADE,
    CONSTRAINT fk_board_comments_author
        FOREIGN KEY (author_id) REFERENCES users(id),
    INDEX idx_board_comments_post_created (post_id, created_at ASC)
);
