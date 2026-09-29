# 계정 동기화 E2E 검증

- Primary repository: `e2e`
- Request type: E2E

## 요청
로컬 stub 디렉터리로 계정 동기화를 실행하고, 결과가 관리자 계정 목록·검색과 로그인 가능 여부에 반영되는지 검증한다.

## 범위
- 권한 관리자가 관리자 화면에서 동기화를 실행하고 마지막 동기화 결과(시각, 생성·갱신·비활성 건수)를 확인한다.
- 동기화된 계정이 계정 목록에 활성 상태·역할과 함께 표시되는지 확인한다.
- 이름, 계정 ID, 이메일 일부로 검색해 해당 계정만 표시되는지 확인한다.
- stub 디렉터리의 비활성 계정이 목록에 비활성으로 표시되고 로그인이 거부되는지 확인한다.
- 동기화를 반복 실행해도 계정 수가 늘지 않는지 확인한다.

## 완료 기준
- 화면의 동기화 결과와 `GET /api/admin/accounts/sync-runs/latest` 응답이 일치한다.
- 시나리오는 DAOU Office 연결 없이 로컬 API와 로컬 DB로 반복 실행된다.

## 근거
- `ACC-01` — 「계정 동기화 및 관리자 접근」, `wiki/requirements.md` 9-11행
- `ACC-09` — 「계정 동기화 및 관리자 접근」, `wiki/requirements.md` 9-19행
- `ACC-10` — 「계정 동기화 및 관리자 접근」, `wiki/requirements.md` 9-20행
- `ACC-11` — 「계정 동기화 및 관리자 접근」, `wiki/requirements.md` 9-21행
- `ACC-12` — 「계정 동기화 및 관리자 접근」, `wiki/requirements.md` 9-22행

## UNRESOLVED
없음

## 구현 의존성
- 선행: [계정 동기화 server 구현](request-apps-account-sync.md)
- 선행: [관리자 동기화 계정 목록](request-admin-synced-account-directory.md)
