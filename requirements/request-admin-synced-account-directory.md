# 관리자 동기화 계정 목록

- Primary repository: `admin`
- Request type: client

## 요청
권한 관리자가 계정 동기화를 실행하고, 마지막 동기화 결과와 동기화된 계정의 활성 상태·역할을 검색해 확인할 수 있는 화면을 구현한다.

## 범위
- 동기화 실행 버튼과 마지막 동기화 결과(시각, 상태, 생성·갱신·비활성 건수)를 표시한다.
- 이름·계정 ID·이메일 검색, 활성 상태 필터, 목록 페이지 이동을 제공한다.
- 계정별 활성 상태와 부여된 역할을 표시한다.
- 동기화 중 재실행(`SYNC_IN_PROGRESS`)과 실패 결과를 구분해 표시한다.
- 계정 원본과 동기화는 API에 맡기고 DAOU Office를 브라우저에서 직접 호출하지 않는다.

## 완료 기준
- 빈 목록, 로딩, 검색 결과, 오류, 비활성 계정, 동기화 이력 없음 상태를 구분한다.
- 동기화 후 목록과 마지막 동기화 결과가 다시 조회되어 갱신된다.
- 로컬 stub 계정으로 UI를 검증할 수 있다.
- 역할 편집은 [관리자 역할 부여·회수 화면](request-admin-role-management.md)에 맡긴다.

## 근거
- `ACC-01` — 「계정 동기화 및 관리자 접근」, `wiki/requirements.md` 9-11행
- `ACC-09` — 「계정 동기화 및 관리자 접근」, `wiki/requirements.md` 9-19행
- `ACC-10` — 「계정 동기화 및 관리자 접근」, `wiki/requirements.md` 9-20행
- `ACC-12` — 「계정 동기화 및 관리자 접근」, `wiki/requirements.md` 9-22행

## UNRESOLVED
없음

## 구현 의존성
- 계약: [계정 동기화 API 계약](request-apps-account-sync-contract.md)
- 계약: [계정 역할 관리 API 계약](request-apps-role-management-contract.md)
- 선행: [계정 동기화 server 구현](request-apps-account-sync.md)
- 선행: [계정 역할·권한 server 구현](request-apps-role-enforcement.md)
- 선행: [관리자 로컬 로그인 화면](request-admin-local-account-login.md)
- 후속: [관리자 역할 부여·회수 화면](request-admin-role-management.md)
- 후속: [계정 동기화 E2E 검증](request-e2e-account-sync.md)
