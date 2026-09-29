# 계정 동기화 server 구현

- Primary repository: `apps`
- Request type: server

## 요청
계정 디렉터리에서 계정을 upsert하는 동기화를 구현하고, 실행 이력과 마지막 동기화 결과 조회 API를 제공한다.

## 범위
- 로컬 인증 구현의 시작 시 stub upsert를 동기화 서비스로 옮겨, 시작 시 자동 동기화도 `account_sync_run` 이력(`triggeredBy=null`)을 남기게 한다.
- `POST /api/admin/accounts/sync`는 `ROLE_MANAGER`만 실행하고 생성·갱신·비활성 건수를 집계한다.
- 디렉터리에서 비활성화되었거나 사라진 계정은 삭제하지 않고 `active=false`로 바꾸며, 같은 트랜잭션에서 해당 계정의 세션을 `ACCOUNT_DEACTIVATED`로 폐기한다.
- 실행 중 동기화에 부분 UNIQUE 인덱스를 두어 동시 실행을 `409 SYNC_IN_PROGRESS`로 거부한다.
- `GET /api/admin/accounts/sync-runs/latest`로 가장 최근 실행 결과를 반환한다.

## 완료 기준
- 같은 디렉터리로 반복 실행해도 계정이 중복되지 않고 두 번째 실행의 생성 건수가 0이다.
- stub 디렉터리의 비활성 계정은 동기화 후 `active=false`이고 로그인과 기존 세션이 거부된다.
- 성공·실패·동시 실행 이력이 통합 테스트로 검증된다.
- 계정 디렉터리 인터페이스를 테스트 대역으로 대체할 수 있다.

## 근거
- `ACC-01` — 「계정 동기화 및 관리자 접근」, `wiki/requirements.md` 9-11행
- `ACC-11` — 「계정 동기화 및 관리자 접근」, `wiki/requirements.md` 9-21행
- `ACC-12` — 「계정 동기화 및 관리자 접근」, `wiki/requirements.md` 9-22행

## UNRESOLVED
없음

## 구현 의존성
- 계약: [계정 동기화 API 계약](request-apps-account-sync-contract.md)
- 선행: [로컬 stub 계정 인증 구현](request-apps-local-account-auth.md)
- 후속: [관리자 동기화 계정 목록](request-admin-synced-account-directory.md)
- 후속: [계정 동기화 E2E 검증](request-e2e-account-sync.md)
