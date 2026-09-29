# 콘텐츠 초안 server 구현

- Primary repository: `apps`
- Request type: server

## 요청
페이지 생성, 초안 저장, 목록·상세 조회, 미게시 페이지 삭제를 revision 기반으로 구현한다.

## 범위
- `content_page`, `content_revision` 스키마와 draft·published 포인터(같은 페이지 revision만 가리키는 지연 복합 FK)를 Flyway migration으로 만든다.
- 초안 저장마다 새 revision을 만들고 draft 포인터, `content_page.slug`·`title`·수정자·수정 시각을 갱신한다. 공개 포인터와 `published_slug`는 유지한다.
- slug 저장 전 작업·공개 slug를 함께 확인하고 같은 slug의 동시 저장을 advisory lock으로 직렬화한다.
- 목록은 상태 필터와 제목·slug 부분 일치 검색(`pg_trgm`)을 지원한다.
- 삭제는 `last_published_at IS NULL`인 페이지만 revision과 함께 삭제한다.
- 쓰기는 `CONTENT_EDITOR`, 조회는 `CONTENT_EDITOR` 또는 `PUBLISHER`에게 허용한다.

## 완료 기준
- 초안 저장 후 재조회한 revision 순번·작성자·시각이 일치한다.
- 게시 페이지의 초안을 저장해도 공개 조회 결과는 이전 공개 revision을 유지한다.
- slug 충돌, 잘못된 입력, 없는 페이지, 게시 이력 페이지 삭제를 테스트한다.
- 상태 필터와 검색 결과가 통합 테스트로 검증된다.

## 근거
- `CMS-02` — 「콘텐츠 작성 및 게시」, `wiki/requirements.md` 25-28행
- `CMS-03` — 「콘텐츠 작성 및 게시」, `wiki/requirements.md` 25-29행
- `CMS-07` — 「콘텐츠 작성 및 게시」, `wiki/requirements.md` 25-33행
- `CMS-09` — 「콘텐츠 작성 및 게시」, `wiki/requirements.md` 25-35행
- `CMS-10` — 「콘텐츠 작성 및 게시」, `wiki/requirements.md` 25-36행
- `CMS-11` — 「콘텐츠 작성 및 게시」, `wiki/requirements.md` 25-37행
- `CMS-12` — 「콘텐츠 작성 및 게시」, `wiki/requirements.md` 25-38행

## UNRESOLVED
없음

## 구현 의존성
- 계약: [콘텐츠 초안 API 계약](request-apps-content-authoring-contract.md)
- 선행: [계정 역할·권한 server 구현](request-apps-role-enforcement.md)
- 후속: [관리자 콘텐츠 작성 화면](request-admin-content-authoring.md)
- 후속: [콘텐츠 초안 E2E 검증](request-e2e-content-authoring.md)
