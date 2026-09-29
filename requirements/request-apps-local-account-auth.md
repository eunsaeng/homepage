# 로컬 stub 계정 인증 구현

- Primary repository: `apps`
- Request type: server

## 요청
로컬 stub 계정 디렉터리와 세션 인증을 구현해 역할이 있는 stub 계정으로 관리자 API를 사용할 수 있게 한다.

## 범위
- `local` 프로필에서만 `StubAccountDirectory`를 등록한다. 역할별 테스트 계정, 역할 없는 계정, 비활성 계정을 코드로 제공하고 Flyway seed에는 넣지 않는다.
- `local` 프로필 시작 시 stub 계정을 upsert하고, 권한 관리자 fixture 계정에 `ROLE_MANAGER`가 없으면 부여한다.
- 로그인·세션 조회·로그아웃과 `admin_session`(토큰 해시, 만료, 폐기 사유)을 구현한다.
- Spring Security(WebFlux)로 요청마다 세션, 계정 활성 상태, 역할 보유 여부를 확인하고 엔드포인트별 필요 역할을 선언할 수 있는 기반을 만든다.
- `local` 외 프로필에서 stub bean이 등록되지 않게 하고, stub 설정이 켜져 있으면 시작을 실패시킨다.

## 완료 기준
- 시작을 반복해도 stub 계정이 중복되지 않는다.
- 미등록·비활성·무역할 계정은 `403 LOGIN_DENIED`로 로그인이 거부된다.
- 유효 세션, 로그아웃, 만료, 폐기 사유별 응답(401·403)을 통합 테스트로 검증한다.
- `local` 외 프로필로 기동한 테스트에서 stub 인증 API가 `404`이고 stub 설정 시 기동이 실패한다.

## 근거
- `ACC-05` — 「계정 동기화 및 관리자 접근」, `wiki/requirements.md` 9-15행
- `ACC-07` — 「계정 동기화 및 관리자 접근」, `wiki/requirements.md` 9-17행
- `ACC-08` — 「계정 동기화 및 관리자 접근」, `wiki/requirements.md` 9-18행
- `ACC-13` — 「계정 동기화 및 관리자 접근」, `wiki/requirements.md` 9-23행

## UNRESOLVED
없음

## 구현 의존성
- 계약: [로컬 계정 로그인 API 계약](request-apps-local-account-contract.md)
- 후속: [계정 동기화 server 구현](request-apps-account-sync.md)
- 후속: [관리자 로컬 로그인 화면](request-admin-local-account-login.md)
- 후속: [로컬 로그인 E2E 검증](request-e2e-local-account-login.md)
