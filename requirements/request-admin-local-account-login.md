# 관리자 로컬 계정 로그인 화면

- Primary repository: `admin`
- Request type: client

## 요청
관리자가 로컬 stub 계정을 선택해 로그인하고, 세션을 유지하거나 로그아웃할 수 있는 화면 흐름과 관리자 화면의 인증 틀을 구현한다.

## 범위
- `GET /api/admin/auth/local-accounts` 목록에서 계정을 선택해 로그인한다.
- 앱을 새로 열거나 새로고침하면 세션 조회 API로 로그인 상태와 역할을 복원한다.
- 로그아웃 버튼으로 세션을 종료하고 로그인 화면으로 돌아간다.
- `401`은 다시 로그인 안내, `403`·`LOGIN_DENIED`는 접근 불가 안내로 구분해 표시한다.
- 역할에 따라 메뉴를 보여주되 권한 판단은 API에 맡긴다.

## 완료 기준
- 로그인 전, 성공, 거부, 세션 만료, 로그아웃 상태를 확인할 수 있다.
- 역할이 없거나 비활성인 계정은 성공 상태로 표시되지 않는다.
- API 오류 코드가 사용자에게 구분 가능한 메시지로 표시된다.

## 근거
- `ACC-05` — 「계정 동기화 및 관리자 접근」, `wiki/requirements.md` 9-15행
- `ACC-07` — 「계정 동기화 및 관리자 접근」, `wiki/requirements.md` 9-17행
- `ACC-08` — 「계정 동기화 및 관리자 접근」, `wiki/requirements.md` 9-18행

## UNRESOLVED
없음

## 구현 의존성
- 계약: [로컬 계정 로그인 API 계약](request-apps-local-account-contract.md)
- 선행: [로컬 stub 계정 인증 구현](request-apps-local-account-auth.md)
- 후속: [로컬 로그인 E2E 검증](request-e2e-local-account-login.md)
