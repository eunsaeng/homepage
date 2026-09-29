# 관리자 메뉴 편집 server 구현

- Primary repository: `apps`
- Request type: server

## 요청
콘텐츠 편집자가 게시 페이지를 메뉴에 추가·제거하고 순서를 옮길 수 있도록 관리자 메뉴 API를 구현한다.

## 범위
- `navigation_item` 스키마를 만들고 `page_id` UNIQUE, `position` UNIQUE(지연 검사)를 둔다.
- 메뉴 변경은 테이블을 잠근 뒤 처리해 추가(끝에 추가), 이동(인접 항목과 교환), 삭제(뒤 항목 당김)의 순서 계산이 겹치지 않게 한다.
- 게시 상태가 아닌 페이지는 추가하지 못하게 한다. 이후 비게시되어도 항목은 남고 공개 메뉴에서만 빠진다.
- 조회는 `CONTENT_EDITOR` 또는 `PUBLISHER`, 변경은 `CONTENT_EDITOR`에게 허용한다.

## 완료 기준
- 추가, 중복 추가, 비게시 페이지 추가, 이동(맨 앞 `UP`·맨 끝 `DOWN` 포함), 삭제 후 순서 당김, 없는 항목 오류를 검증한다.
- 모든 변경 뒤 `position`이 0부터 빈틈없이 이어진다.
- 메뉴 항목 삭제가 페이지와 revision을 지우지 않는다.

## 근거
- `WEB-03` — 「공개 홈페이지」, `wiki/requirements.md` 41-45행
- `WEB-04` — 「공개 홈페이지」, `wiki/requirements.md` 41-46행
- `WEB-06` — 「공개 홈페이지」, `wiki/requirements.md` 41-48행

## UNRESOLVED
없음

## 구현 의존성
- 계약: [관리자 메뉴 편집 API 계약](request-apps-navigation-contract.md)
- 선행: [게시 lifecycle server 구현](request-apps-publishing.md)
- 후속: [관리자 메뉴 편집 화면](request-admin-navigation-management.md)
- 후속: [메뉴 lifecycle E2E 검증](request-e2e-navigation-management.md)
