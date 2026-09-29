# 관리자 메뉴 편집 API 계약

- Primary repository: `apps`
- Request type: API contract

## 요청
콘텐츠 편집자가 게시 페이지를 공개 메뉴에 추가·제거하고 항목 순서를 한 칸씩 옮길 수 있도록 API 계약을 정의한다.

## 범위
- `GET /api/admin/navigation/items`, `POST /api/admin/navigation/items`, `POST /api/admin/navigation/items/{itemId}/move`, `DELETE /api/admin/navigation/items/{itemId}`의 입력·출력·권한·오류와 공통 형식 `NavigationItem`을 정의한다.
- 추가 입력은 `pageId`, `label`뿐이며 항상 메뉴 끝(마지막 `position` + 1)에 추가한다. 위치 지정 입력은 두지 않는다.
- 이동은 `direction`(`UP`·`DOWN`)으로 인접 항목과 순서를 맞바꾸고, 끝 위치에서 더 이동하면 `NAVIGATION_CONFLICT`로 거부한다.
- 삭제는 뒤 항목의 순서를 한 칸씩 당기며, 페이지 콘텐츠는 삭제하지 않는다.
- 게시되지 않은 페이지 추가와 이미 메뉴에 있는 페이지 추가를 `NAVIGATION_CONFLICT`로 거부한다.

## 완료 기준
- 네 API의 method, path, 입력, 출력, 권한, 오류가 `wiki/api-spec.md`와 일치하게 문서화된다.
- `position`이 0부터 빈틈없이 이어진다는 규칙이 명시된다.

## 근거
- `WEB-03` — 「공개 홈페이지」, `wiki/requirements.md` 41-45행
- `WEB-04` — 「공개 홈페이지」, `wiki/requirements.md` 41-46행
- `WEB-06` — 「공개 홈페이지」, `wiki/requirements.md` 41-48행

## UNRESOLVED
없음

## 구현 의존성
- 선행: [공개 콘텐츠 조회 API 계약](request-apps-public-content-contract.md)
- 후속: [관리자 메뉴 편집 server 구현](request-apps-navigation-management.md)
- 후속: [관리자 메뉴 편집 화면](request-admin-navigation-management.md)
