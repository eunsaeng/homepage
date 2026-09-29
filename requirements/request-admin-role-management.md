# 관리자 역할 부여·회수 화면

- Primary repository: `admin`
- Request type: client

## 요청
권한 관리자가 계정 목록에서 계정 하나를 골라 역할을 한 번의 클릭으로 하나씩 부여하거나 회수하는 화면을 구현한다.

## 범위
- 계정별로 권한 관리자, 콘텐츠 편집자, 게시 담당자 역할의 부여·회수 버튼을 제공한다.
- 각 버튼은 역할 하나에 대한 `PUT` 또는 `DELETE` 요청을 보내고, 응답의 `account`로 화면을 갱신한다.
- 비활성 계정 부여 거부와 마지막 권한 관리자 회수 거부를 구분해 안내한다.
- 역할 변경 권한이 없는 사용자에게는 편집 UI를 보이지 않으며, API도 권한을 다시 검사한다.

## 완료 기준
- 역할 부여, 단일 회수, 마지막 역할 회수 결과를 확인할 수 있다.
- 성공·실패와 계정 비활성 상태를 구분해 표시한다.
- 변경 결과는 재조회 후에도 API 응답과 일치한다.

## 근거
- `ACC-03` — 「계정 동기화 및 관리자 접근」, `wiki/requirements.md` 9-13행
- `ACC-04` — 「계정 동기화 및 관리자 접근」, `wiki/requirements.md` 9-14행

## UNRESOLVED
없음

## 구현 의존성
- 계약: [계정 역할 관리 API 계약](request-apps-role-management-contract.md)
- 선행: [관리자 동기화 계정 목록](request-admin-synced-account-directory.md)
- 선행: [계정 역할·권한 server 구현](request-apps-role-enforcement.md)
- 후속: [역할별 권한 E2E 검증](request-e2e-role-permissions.md)
