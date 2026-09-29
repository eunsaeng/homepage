# 로컬 관리자 로그인 E2E 검증

- Primary repository: `e2e`
- Request type: E2E

## 요청
로컬 stub 계정 로그인부터 보호된 관리자 화면 진입과 로그아웃까지의 사용자 흐름을 검증한다.

## 범위
- 역할이 있는 테스트 계정의 로그인 성공을 검증한다.
- 역할 없는 계정과 비활성 계정의 로그인 거부를 검증한다.
- 새로고침 후 세션 복원을 검증한다.
- 로그아웃 뒤 보호된 화면과 관리자 API 접근이 차단되는지 검증한다.

## 완료 기준
- 로그인 성공 후 관리자 화면에 계정 정보가 표시된다.
- 로그인 거부와 로그아웃 뒤 보호된 화면/API 접근이 차단된다.
- 테스트는 고정된 로컬 stub fixture를 사용하고 DAOU Office에 연결하지 않는다.

## 근거
- `ACC-05` — 「계정 동기화 및 관리자 접근」, `wiki/requirements.md` 9-15행
- `ACC-07` — 「계정 동기화 및 관리자 접근」, `wiki/requirements.md` 9-17행
- `ACC-08` — 「계정 동기화 및 관리자 접근」, `wiki/requirements.md` 9-18행

## UNRESOLVED
없음

## 구현 의존성
- 선행: [로컬 stub 계정 인증 구현](request-apps-local-account-auth.md)
- 선행: [관리자 로컬 로그인 화면](request-admin-local-account-login.md)
