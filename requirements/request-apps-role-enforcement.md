# 계정 역할·권한 server 구현

- Primary repository: `apps`
- Request type: server

## 요청
계정 검색과 역할 부여·회수 API를 구현하고, 모든 관리자 API에 역할별 권한 검사를 적용하는 규칙을 완성한다.

## 범위
- 권한 관리자만 계정을 검색하고 역할을 하나씩 부여·회수할 수 있게 한다.
- `ROLE_MANAGER` 회수는 역할 행을 잠근 뒤 마지막 활성 권한 관리자인지 확인한다.
- 마지막 역할 회수 시 같은 트랜잭션에서 세션을 `ROLES_REVOKED`로 폐기한다.
- 로컬 인증 구현의 역할 검사 기반 위에 관리자 API별 필요 역할을 선언하고, 여러 역할을 가진 계정은 가진 역할의 동작만 수행하게 한다.
- 계정 검색은 `pg_trgm` 인덱스를 이용한 대소문자 무시 부분 일치로 구현한다.

## 완료 기준
- 역할 부여, 중복 부여, 단일 회수, 전체 회수, 마지막 권한 관리자 회수, 없는 계정·역할 코드, 비활성 계정 부여를 테스트한다.
- 역할을 모두 잃은 계정의 기존 세션은 다음 요청부터 `403`이다.
- UI 없이 API 직접 호출로 역할별 권한 경계를 검증한다.

## 근거
- `ACC-03` — 「계정 동기화 및 관리자 접근」, `wiki/requirements.md` 9-13행
- `ACC-04` — 「계정 동기화 및 관리자 접근」, `wiki/requirements.md` 9-14행
- `ACC-06` — 「계정 동기화 및 관리자 접근」, `wiki/requirements.md` 9-16행
- `ACC-09` — 「계정 동기화 및 관리자 접근」, `wiki/requirements.md` 9-19행
- `ACC-10` — 「계정 동기화 및 관리자 접근」, `wiki/requirements.md` 9-20행

## UNRESOLVED
없음

## 구현 의존성
- 계약: [계정 역할 관리 API 계약](request-apps-role-management-contract.md)
- 선행: [로컬 stub 계정 인증 구현](request-apps-local-account-auth.md)
- 후속: [관리자 동기화 계정 목록](request-admin-synced-account-directory.md)
- 후속: [관리자 역할 부여·회수 화면](request-admin-role-management.md)
- 후속: [역할별 권한 E2E 검증](request-e2e-role-permissions.md)
