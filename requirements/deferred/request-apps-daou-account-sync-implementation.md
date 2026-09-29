# DAOU Office 계정 동기화 구현

- Primary repository: `apps`
- Request type: server

## 요청
확정된 DAOU Office provider 계약에 따라 계정 디렉터리 인터페이스의 DAOU Office 구현을 추가해 stg 이상에서 계정을 동기화한다.

## 범위
- DAOU Office 사용자를 계정 디렉터리 인터페이스의 결과로 변환하는 provider adapter를 구현한다.
- upsert, 비활성 전환, 실행 이력은 [계정 동기화 server 구현](../request-apps-account-sync.md)의 동기화 서비스를 그대로 사용한다.
- 로컬은 stub provider를 유지하고, DAOU Office provider는 허용된 stg 이상 프로필에서만 등록한다.
- 인증 비밀은 소스·로그·테스트 fixture에 기록하지 않는다.

## 완료 기준
- provider adapter 단위 테스트가 있고, 동기화 서비스와 결합한 결과가 계약에 맞는다.
- 일부 실패와 원본 계정 비활성화가 동기화 이력과 계정 상태에 올바르게 반영된다.
- 실제 stg 연결 검증은 승인된 테스트 계정·연결 정보가 준비된 경우에만 수행한다.

## 근거
- `ACC-02` — 「계정 동기화 및 관리자 접근」, `wiki/requirements.md` 9-12행
- `ACC-11` — 「계정 동기화 및 관리자 접근」, `wiki/requirements.md` 9-21행

## UNRESOLVED
provider API와 인증 세부가 확인되기 전 구현·실계정 검증은 차단 상태다. 이를 임의의 endpoint나 자격 증명 방식으로 대체하지 않는다.

## 구현 의존성
- 계약: [DAOU Office 계정 동기화 계약](request-apps-daou-account-sync-contract.md)
- 선행: [계정 동기화 server 구현](../request-apps-account-sync.md)
- 후속: [DAOU Office 동기화 E2E 검증](request-e2e-daou-account-sync.md)
