-- 구(舊) admin_rsp_play 테이블 정리용 SQL
-- 실행 전: 새 Online RPS 배포 완료 및 운영 확인 후에 실행 권장 (롤백 대비).
-- 실행 위치: Railway MySQL 콘솔에서 사용자가 직접 실행.
-- ddl-auto=update 는 엔티티 삭제 시 테이블을 DROP 하지 않으므로 수동 실행 필요.

DROP TABLE IF EXISTS admin_rsp_play;
