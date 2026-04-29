-- RPS 게스트 지원 마이그레이션
-- 목적: rps_room.created_by 컬럼을 NULL 허용으로 변경 (비로그인 게스트 방 생성 지원)
-- 실행 대상: Railway 프로덕션 DB (수동 실행 필요)
-- 실행 전 백업 권장

ALTER TABLE rps_room MODIFY COLUMN created_by BIGINT NULL;
