# 공개 사이트 acceptance E2E

- Primary repository: `e2e`
- Request type: E2E

## 요청
방문자가 공개 메뉴나 URL로 게시된 콘텐츠를 읽을 수 있고, 공개되지 않은 주소에서는 찾을 수 없음 안내를 보는지 검증한다.

## 범위
- 공개 메뉴 항목 선택부터 페이지 표시까지 검증한다.
- 게시 slug 직접 접근, 새로고침, 본문 표시를 검증한다.
- 초안만 있는 페이지, 비게시 페이지, 없는 주소가 404 안내 화면을 보여주는지 검증한다.

## 완료 기준
- 브라우저의 메뉴, URL, API 응답의 slug와 제목·본문이 일치한다.
- 공개되지 않은 콘텐츠가 직접 URL 또는 메뉴로 노출되지 않는다.
- 로컬 API와 로컬 DB로 반복 실행된다.

## 근거
- `CMS-01` — 「콘텐츠 작성 및 게시」, `wiki/requirements.md` 25-27행
- `WEB-01` — 「공개 홈페이지」, `wiki/requirements.md` 41-43행
- `WEB-02` — 「공개 홈페이지」, `wiki/requirements.md` 41-44행
- `WEB-05` — 「공개 홈페이지」, `wiki/requirements.md` 41-47행

## UNRESOLVED
없음

## 구현 의존성
- 선행: [공개 콘텐츠 조회 server 구현](request-apps-public-content.md)
- 선행: [공개 홈페이지 콘텐츠 소비](request-web-published-content.md)
- 선행: [게시 lifecycle server 구현](request-apps-publishing.md)
