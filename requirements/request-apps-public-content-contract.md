# 공개 콘텐츠 조회 API 계약

- Primary repository: `apps`
- Request type: API contract

## 요청
방문자가 게시된 페이지 주소로 접속하고 공개 메뉴로 탐색하며, 없거나 공개되지 않은 주소에서는 찾을 수 없음 응답을 받도록 공개 조회 API 계약을 정의한다.

## 범위
- `GET /api/public/pages/{slug}`와 `GET /api/public/navigation`의 입력·출력·오류를 정의한다.
- 공개 페이지는 `published_slug`로 조회하고 공개 revision만 반환한다.
- 없는 slug, 초안뿐인 페이지, 비게시 페이지, 형식이 틀린 slug를 모두 같은 `404 NOT_FOUND`로 응답해 존재 여부를 드러내지 않는다.
- 공개 메뉴는 게시 상태 페이지의 항목만 `position` 순서로 반환한다.
- 공개 응답에 초안, 작성자 등 관리자 데이터를 넣지 않는다.

## 완료 기준
- 두 API의 path, 출력 필드, 404 조건이 `wiki/api-spec.md`와 일치하게 문서화된다.
- 미리보기 API와 공개 API의 접근 경계가 명확하다.

## 근거
- `CMS-01` — 「콘텐츠 작성 및 게시」, `wiki/requirements.md` 25-27행
- `WEB-01` — 「공개 홈페이지」, `wiki/requirements.md` 41-43행
- `WEB-02` — 「공개 홈페이지」, `wiki/requirements.md` 41-44행
- `WEB-05` — 「공개 홈페이지」, `wiki/requirements.md` 41-47행

## UNRESOLVED
없음

## 구현 의존성
- 선행: [미리보기·게시 API 계약](request-apps-publishing-contract.md)
- 후속: [공개 콘텐츠 조회 server 구현](request-apps-public-content.md)
- 후속: [관리자 메뉴 편집 API 계약](request-apps-navigation-contract.md)
- 후속: [공개 홈페이지 콘텐츠 소비](request-web-published-content.md)
