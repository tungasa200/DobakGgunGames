-- 야추 봇 유저 시드 (Railway에서 한 번만 실행)
-- yacht.bot.user-id=9999 과 일치해야 함
INSERT IGNORE INTO users (id, email, nickname, password, role, status, provider, created_at, updated_at)
VALUES (9999, 'bot@dobakggun.internal', 'AI봇', NULL, 'USER', 'ACTIVE', NULL, NOW(), NOW());
