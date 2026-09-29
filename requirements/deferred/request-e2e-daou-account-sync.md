# DAOU Office 계정 동기화 E2E 검증

- Primary repository: `e2e`
- Request type: E2E
- Status: 외부 provider 계약 확정 전 `UNRESOLVED`

## 요청
허용된 stg 테스트 환경에서 DAOU Office 계정 동기화 결과가 관리자 계정 목록에 나타나는지 검증한다.

## 범위
- stg에서 동기화 실행, 후보 계정 검색, 식별 필드와 활성 상태 확인을 연결 검증한다.
- 로컬 stub 동기화 검증은 [계정 동기화 E2E 검증](../request-e2e-account-sync.md)에 맡긴다.
- 실제 DAOU Office 계정·인증 정보는 테스트 코드나 저장소에 포함하지 않는다.

## 완료 기준
- 같은 입력의 재동기화가 계정 중복을 만들지 않는다.
- stg 시나리오는 승인된 fixture와 연결 환경이 있을 때만 실행되고, 없으면 건너뛴다.

## 근거
- `ACC-02` — 「계정 동기화 및 관리자 접근」, `wiki/requirements.md` 9-12행

## UNRESOLVED
실제 stg 테스트 계정, DAOU Office 연동 승인, provider API 세부가 정의되지 않았다. 준비 전에는 실제 동기화 검증을 수행하지 않는다.

## 구현 의존성
- 선행: [DAOU Office 계정 동기화 구현](request-apps-daou-account-sync-implementation.md)
- 선행: [관리자 동기화 계정 목록](../request-admin-synced-account-directory.md)
