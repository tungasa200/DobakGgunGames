-- ============================================================
-- yacht_record D8 모드 마이그레이션
-- 목적: dice_type 컬럼 추가 + UNIQUE 제약 변경 (user_id → user_id + dice_type)
-- 작성일: 2026-05-10
-- 담당: developer-backend
--
-- [Railway 프로덕션 DB에 수동 실행 필요]
-- 실행 순서: 1 → 2 → 3 → 4 → 5
-- 로컬 dev DB는 ddl-auto=update로 자동 반영됨 (수동 실행 불필요).
-- ============================================================

-- 1. dice_type 컬럼 추가
--    DEFAULT 'D6'으로 설정하면 기존 행이 자동으로 D6로 백필됨.
ALTER TABLE yacht_record
  ADD COLUMN dice_type VARCHAR(4) NOT NULL DEFAULT 'D6'
  AFTER user_id;

-- 2. 기존 데이터 백필 확인 (DEFAULT로 이미 처리되지만 명시적으로 확인)
UPDATE yacht_record
  SET dice_type = 'D6'
  WHERE dice_type IS NULL OR dice_type = '';

-- 3. 기존 UNIQUE(user_id) 인덱스/제약 제거
--    (yacht_record 테이블의 기존 unique 제약명 확인 후 아래 중 하나 실행)
--    방법 A: JoinColumn unique=true로 생성된 경우 (Hibernate 자동 이름)
ALTER TABLE yacht_record DROP INDEX UKqv2wkvrhx8xxlhu4knwkicqkq;
--    방법 B: 명시적 이름 uq_yacht_record_user 인 경우
--    ALTER TABLE yacht_record DROP INDEX uq_yacht_record_user;
--
--    주의: SHOW INDEX FROM yacht_record; 로 현재 인덱스 이름을 먼저 확인하세요.
--    두 구문 중 실제 존재하는 이름의 것만 실행하면 됩니다.

-- 4. 새 UNIQUE 제약 추가 (user_id + dice_type 조합 유니크)
ALTER TABLE yacht_record
  ADD CONSTRAINT uq_yacht_record_user_dice_type
  UNIQUE (user_id, dice_type);

-- 5. 모드별 랭킹 조회 최적화 인덱스 추가
CREATE INDEX idx_yacht_record_dice_type_user
  ON yacht_record (dice_type, user_id);

-- ============================================================
-- 실행 후 검증 쿼리:
--   SHOW COLUMNS FROM yacht_record;
--   SHOW INDEX FROM yacht_record;
--   SELECT dice_type, COUNT(*) FROM yacht_record GROUP BY dice_type;
-- ============================================================
