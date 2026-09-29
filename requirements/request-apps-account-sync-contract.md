# 계정 동기화 API 계약

- Primary repository: `apps`
- Request type: API contract

## 요청
권한 관리자가 계정 디렉터리를 동기화하고 마지막 동기화 결과를 확인할 수 있도록 계정 디렉터리 경계와 동기화 API 계약을 정의한다.

## 범위
- 계정 디렉터리 인터페이스를 정의하고 로컬 stub 구현과 향후 DAOU Office 구현이 같은 경계를 쓰게 한다.
- `POST /api/admin/accounts/sync`와 `GET /api/admin/accounts/sync-runs/latest`의 입력, `SyncRun` 출력, 권한, 오류를 정의한다.
- 반복 실행 upsert, 디렉터리에서 비활성화되었거나 사라진 계정의 비활성 전환과 세션 폐기 규칙을 정의한다.
- 동시 실행 금지(`409 SYNC_IN_PROGRESS`)와 실패 시 `FAILED` 이력 기록을 정의한다.
- DAOU Office 연동 세부(인증, endpoint, 필드 매핑)는 [DAOU Office 계정 동기화 계약](deferred/request-apps-daou-account-sync-contract.md)에 맡긴다.

## 완료 기준
- 두 API의 method, path, 입력, 출력 필드, 권한, 오류 코드가 `wiki/api-spec.md`와 일치하게 문서화된다.
- `SyncRun`의 각 필드가 `account_sync_run` 컬럼과 대응된다.
- 로컬에서는 DAOU Office 호출 없이 stub 디렉터리만 사용한다는 경계가 명시된다.

## 근거
- `ACC-01` — 「계정 동기화 및 관리자 접근」, `wiki/requirements.md` 9-11행
- `ACC-11` — 「계정 동기화 및 관리자 접근」, `wiki/requirements.md` 9-21행
- `ACC-12` — 「계정 동기화 및 관리자 접근」, `wiki/requirements.md` 9-22행

## UNRESOLVED
없음

## 구현 의존성
- 선행 없음
- 후속: [계정 동기화 server 구현](request-apps-account-sync.md)
- 후속: [계정 역할 관리 API 계약](request-apps-role-management-contract.md)
- 후속: [DAOU Office 계정 동기화 계약](deferred/request-apps-daou-account-sync-contract.md)
