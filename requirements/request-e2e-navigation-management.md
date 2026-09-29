# 메뉴 lifecycle E2E 검증

- Primary repository: `e2e`
- Request type: E2E

## 요청
관리자가 메뉴 항목을 추가·이동·제거했을 때 공개 홈페이지 메뉴에 그대로 반영되는지 검증한다.

## 범위
- 게시 페이지를 메뉴에 추가하고 공개 홈페이지 메뉴의 링크로 페이지를 여는 흐름을 검증한다.
- 항목을 위아래로 옮긴 뒤 공개 메뉴의 순서가 바뀌는지 검증한다.
- 항목 제거 후 공개 메뉴에서 링크가 사라지고 페이지 주소는 계속 열리는지 검증한다.
- 비게시 페이지의 추가가 거부되는지 검증한다.

## 완료 기준
- 관리자 화면, 관리자 API, 공개 메뉴 API, 방문자 브라우저 결과가 일치한다.
- 메뉴 항목 제거가 페이지 삭제로 이어지지 않는다.
- 권한 없는 사용자의 메뉴 변경 요청이 거부된다.

## 근거
- `WEB-03` — 「공개 홈페이지」, `wiki/requirements.md` 41-45행
- `WEB-04` — 「공개 홈페이지」, `wiki/requirements.md` 41-46행
- `WEB-06` — 「공개 홈페이지」, `wiki/requirements.md` 41-48행

## UNRESOLVED
없음

## 구현 의존성
- 선행: [관리자 메뉴 편집 server 구현](request-apps-navigation-management.md)
- 선행: [관리자 메뉴 편집 화면](request-admin-navigation-management.md)
- 선행: [공개 홈페이지 콘텐츠 소비](request-web-published-content.md)
