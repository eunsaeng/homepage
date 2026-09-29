# 공개 홈페이지 콘텐츠 소비

- Primary repository: `web`
- Request type: client

## 요청
방문자가 공개 홈페이지의 메뉴 또는 주소로 게시된 페이지를 읽고, 없는 주소에서는 찾을 수 없음 안내를 보는 화면을 구현한다.

## 범위
- 공개 메뉴 API 결과를 사이트 메뉴에 표시하고 선택하면 해당 페이지로 이동한다.
- slug 주소에서 게시된 제목과 Markdown 본문을 서버에서 렌더링해 검색 엔진이 읽을 수 있게 한다.
- API가 404를 반환하면 HTTP 404 상태의 찾을 수 없음 화면을 보여준다.
- API 주소는 환경 변수로 받고 로컬 기본값은 `http://localhost:8080`이다.
- 관리자 세션이나 미리보기 API를 쓰지 않는다.

## 완료 기준
- 메뉴에서 선택한 항목과 페이지 URL·내용이 일치한다.
- 직접 URL 접근과 새로고침에서 같은 게시 콘텐츠가 표시된다.
- 없는 주소와 비게시 주소가 HTTP 404와 안내 화면으로 처리된다.

## 근거
- `CMS-01` — 「콘텐츠 작성 및 게시」, `wiki/requirements.md` 25-27행
- `WEB-01` — 「공개 홈페이지」, `wiki/requirements.md` 41-43행
- `WEB-02` — 「공개 홈페이지」, `wiki/requirements.md` 41-44행
- `WEB-05` — 「공개 홈페이지」, `wiki/requirements.md` 41-47행

## UNRESOLVED
없음

## 구현 의존성
- 계약: [공개 콘텐츠 조회 API 계약](request-apps-public-content-contract.md)
- 선행: [공개 콘텐츠 조회 server 구현](request-apps-public-content.md)
- 후속: [공개 사이트 acceptance E2E](request-e2e-public-site.md)
