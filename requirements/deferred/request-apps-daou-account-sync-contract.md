# DAOU Office 계정 동기화 계약

- Primary repository: `apps`
- Request type: API/provider contract
- Status: `UNRESOLVED` 외부 연동 세부

## 요청
stg 이상 환경에서 DAOU Office 계정을 관리자 후보로 동기화하기 위해, [계정 동기화 API 계약](../request-apps-account-sync-contract.md)의 계정 디렉터리 경계에 들어갈 DAOU Office provider 계약을 확정한다.

## 범위
- DAOU Office 사용자 필드를 `account`(`identity_provider='DAOU_OFFICE'`, 외부 ID, 표시명, 이메일, 활성 상태)에 매핑하는 규칙을 정의한다.
- DAOU Office에서 비활성화되었거나 조회되지 않는 사용자의 판단 기준을 정의한다.
- provider 활성 프로필 조건(stg 이상)과 비밀 정보 주입 방식을 정의한다.
- 동기화 API의 입출력은 계정 동기화 API 계약을 그대로 사용하고 새로 만들지 않는다.
- 인증 정보, endpoint, pagination, rate limit 등 외부 연동 세부를 임의로 추정하지 않는다.

## 완료 기준
- 필드 매핑, 비활성 판단, 오류·재시도 규칙이 문서화된다.
- 로컬에서는 실제 DAOU Office 호출 없이 stub provider만 사용한다는 경계가 유지된다.
- 확인되지 않은 외부 provider 세부는 `UNRESOLVED`로 유지하고 결정 책임자를 지정한다.

## 근거
- `ACC-02` — 「계정 동기화 및 관리자 접근」, `wiki/requirements.md` 9-12행
- `ACC-11` — 「계정 동기화 및 관리자 접근」, `wiki/requirements.md` 9-21행

## UNRESOLVED
DAOU Office의 사용 가능한 API, 인증 방식, 계정 필드와 운영 허용 조건은 근거 요구사항에 없다. 해당 정보를 확인하기 전 실제 연동 계약과 검증 데이터는 확정하지 않는다.

## 구현 의존성
- 선행: [계정 동기화 API 계약](../request-apps-account-sync-contract.md)
- 후속: [DAOU Office 계정 동기화 구현](request-apps-daou-account-sync-implementation.md)
