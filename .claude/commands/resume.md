docs/progress/ 아래 모든 파일을 읽고,
git log --oneline -n 5로 최근 커밋을 확인한 뒤,
.claude/agents/의 5-role 팀(planner, designer, developer-frontend, developer-backend, qa-tester)을 스폰해서
미완 작업을 이어받아줘.

각 팀원은 자기 역할의 progress 파일을 먼저 읽고,
"다음 세션에서" 섹션을 우선 실행할 것.

파일 소유권 규칙 (CLAUDE.md 참조)을 반드시 따를 것.
특히 developer-frontend는 frontend/만, developer-backend는 backend/만 수정.
두 팀원이 같은 파일을 편집하지 않도록 주의.

Excel 모드 작업이 진행 중이었다면 PRD의 "모드 적용 범위" 필드 재확인.
