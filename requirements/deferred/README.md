# 보류된 요청

stg 이상 환경의 DAOU Office 연동 요청이다. 하네스는 `requirements/` 바로 아래의 `request-*.md`만 읽으므로 이 폴더의 요청은 실행·검증 대상이 아니다.

외부 provider 세부(API, 인증 방식, 테스트 계정)가 정해지면 다음 순서로 되돌린다.

1. 각 파일의 `UNRESOLVED`를 확정된 내용으로 바꾼다.
2. 파일을 `requirements/`로 옮기고 `../request-…` 링크를 `request-…`로, 상위 파일의 `deferred/request-…` 링크를 `request-…`로 고친다.
3. `pnpm harness validate --fix`로 `근거`의 heading과 행 범위를 현재 `wiki/requirements.md`에 맞춘다. 이 폴더의 파일도 함께 고쳐진다.
4. `scripts/harness/test/backlog.test.mjs`의 요청 수와 `ACC-02` 제외를 되돌리고 `pnpm harness validate`, `pnpm test:harness`를 실행한다.
