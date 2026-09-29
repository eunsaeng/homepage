# 공개 콘텐츠 조회 server 구현

- Primary repository: `apps`
- Request type: server

## 요청
공개 페이지와 공개 메뉴 API가 게시된 revision만 반환하고, 그 외 주소는 404로 응답하도록 구현한다.

## 범위
- `status='PUBLISHED'`인 페이지를 `published_slug`로 찾아 공개 revision을 반환한다.
- 공개 메뉴는 게시 상태 페이지에 연결된 항목만 `position` 순서로 반환한다.
- 인증 없이 호출할 수 있게 하고, CORS는 `localhost:3000`, `localhost:3001`만 허용한다.

## 완료 기준
- 게시 페이지 주소 조회가 현재 공개 revision을 반환한다.
- 없는 slug, 초안뿐인 페이지, 비게시 페이지, 형식이 틀린 slug가 모두 404다.
- 초안 저장이나 미리보기만으로는 공개 결과가 바뀌지 않는다.
- 비게시 직후 페이지와 메뉴 양쪽의 공개 응답에서 빠진다.

## 근거
- `CMS-01` — 「콘텐츠 작성 및 게시」, `wiki/requirements.md` 25-27행
- `WEB-01` — 「공개 홈페이지」, `wiki/requirements.md` 41-43행
- `WEB-02` — 「공개 홈페이지」, `wiki/requirements.md` 41-44행
- `WEB-05` — 「공개 홈페이지」, `wiki/requirements.md` 41-47행

## UNRESOLVED
없음

## 구현 의존성
- 계약: [공개 콘텐츠 조회 API 계약](request-apps-public-content-contract.md)
- 선행: [게시 lifecycle server 구현](request-apps-publishing.md)
- 선행: [관리자 메뉴 편집 server 구현](request-apps-navigation-management.md)
- 후속: [공개 홈페이지 콘텐츠 소비](request-web-published-content.md)
- 후속: [공개 사이트 acceptance E2E](request-e2e-public-site.md)
