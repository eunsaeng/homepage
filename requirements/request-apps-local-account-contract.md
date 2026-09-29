# 로컬 계정 로그인 API 계약

- Primary repository: `apps`
- Request type: API contract

## 요청
`local` 프로필에서 stub 계정을 선택해 세션을 시작하고 종료하는 API 계약을 정의한다.

## 범위
- `GET /api/admin/auth/local-accounts`, `POST /api/admin/auth/local-login`, `GET /api/admin/auth/session`, `POST /api/admin/auth/logout`의 입력·출력·오류를 정의한다.
- 동기화되어 있고 활성 상태이며 역할이 하나 이상인 계정만 로그인할 수 있고, 그 외는 `403 LOGIN_DENIED`로 거부한다.
- 세션 쿠키(`local_session`, HttpOnly, `SameSite=Lax`, 8시간)와 `expiresAt` 응답을 정의한다.
- 세션 없음·만료·로그아웃은 `401 UNAUTHORIZED`, 계정 비활성화·역할 전부 회수로 폐기된 세션은 `403 FORBIDDEN`으로 구분한다.
- stub 인증 API는 `local` 외 프로필에서 등록되지 않아 `404 NOT_FOUND`가 됨을 명시한다.
- DAOU Office 인증은 포함하지 않는다.

## 완료 기준
- 네 API의 method, path, 입력, 출력, 오류가 `wiki/api-spec.md`와 일치하게 문서화된다.
- 로그인 성공은 세션 쿠키를 발급하고 로그아웃은 쿠키를 만료시킨다.
- 계정 미등록·비활성·무역할 로그인 거부와 폐기 사유별 응답 상태가 정의된다.

## 근거
- `ACC-05` — 「계정 동기화 및 관리자 접근」, `wiki/requirements.md` 9-15행
- `ACC-07` — 「계정 동기화 및 관리자 접근」, `wiki/requirements.md` 9-17행
- `ACC-08` — 「계정 동기화 및 관리자 접근」, `wiki/requirements.md` 9-18행
- `ACC-13` — 「계정 동기화 및 관리자 접근」, `wiki/requirements.md` 9-23행

## UNRESOLVED
없음

## 구현 의존성
- 선행 없음
- 후속: [로컬 stub 계정 인증 구현](request-apps-local-account-auth.md)
