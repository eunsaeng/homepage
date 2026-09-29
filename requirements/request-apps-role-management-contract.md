# 계정 역할 관리 API 계약

- Primary repository: `apps`
- Request type: API contract

## 요청
권한 관리자가 동기화 계정을 검색하고 역할을 하나씩 부여·회수할 수 있도록 계정 목록과 역할 부여·회수 API 계약을 정의하고, 관리자 API 전체의 역할별 허용 규칙을 정한다.

## 범위
- `GET /api/admin/accounts`의 검색어·활성 필터·페이지 입력과 `Account` 목록 응답을 정의한다.
- `PUT /api/admin/accounts/{accountId}/roles/{roleCode}`(부여)와 `DELETE`(회수)의 입력·응답(`account`, `rolesUpdatedAt`)을 정의하고, 이미 부여된 역할 부여와 없는 역할 회수는 변경 없이 성공하게 한다.
- 비활성 계정 부여 거부(`STATE_CONFLICT`), 마지막 활성 권한 관리자의 `ROLE_MANAGER` 회수 거부(`LAST_ROLE_MANAGER`)를 정의한다.
- 마지막 역할 회수 시 세션 폐기와 이후 요청의 `403` 응답을 정의한다.
- 관리자 API별 필요 역할(`ROLE_MANAGER`, `CONTENT_EDITOR`, `PUBLISHER`) 표를 정의한다.

## 완료 기준
- 세 API의 method, path, 입력, 출력, 오류가 `wiki/api-spec.md`와 일치하게 문서화된다.
- 역할이 없는 관리자 요청은 UI와 관계없이 API가 `403 FORBIDDEN`으로 거부한다고 명시된다.
- 역할 회수가 즉시 이후 API 요청에 반영된다고 명시된다.

## 근거
- `ACC-03` — 「계정 동기화 및 관리자 접근」, `wiki/requirements.md` 9-13행
- `ACC-04` — 「계정 동기화 및 관리자 접근」, `wiki/requirements.md` 9-14행
- `ACC-06` — 「계정 동기화 및 관리자 접근」, `wiki/requirements.md` 9-16행
- `ACC-09` — 「계정 동기화 및 관리자 접근」, `wiki/requirements.md` 9-19행
- `ACC-10` — 「계정 동기화 및 관리자 접근」, `wiki/requirements.md` 9-20행

## UNRESOLVED
없음

## 구현 의존성
- 선행: [계정 동기화 API 계약](request-apps-account-sync-contract.md)
- 선행: [로컬 계정 로그인 API 계약](request-apps-local-account-contract.md)
- 후속: [계정 역할·권한 server 구현](request-apps-role-enforcement.md)
- 후속: [관리자 역할 부여·회수 화면](request-admin-role-management.md)
