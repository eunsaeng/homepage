# 게시 lifecycle E2E 검증

- Primary repository: `e2e`
- Request type: E2E

## 요청
초안 저장부터 미리보기, 게시, 수정 초안 재게시, 비게시까지의 lifecycle을 관리자 화면과 공개 홈페이지를 연결해 검증한다.

## 범위
- 미리보기는 공개되지 않고 공개본에 영향을 주지 않는지 검증한다.
- 게시 담당자의 최초 게시와 수정 초안 재게시를 검증한다.
- 수정 초안 필터에 게시 대기 페이지만 나타나는지 검증한다.
- 비게시 후 URL 직접 조회와 공개 메뉴에서 페이지가 사라지는지 검증한다.
- 편집자는 게시할 수 없고 게시 담당자는 게시할 수 있는지 검증한다.

## 완료 기준
- 공개 페이지에서 현재 공개 revision만 보인다.
- 모든 상태 변경 후 관리자 화면 상태와 공개 홈페이지 상태가 일치한다.
- 로컬 계정 fixture와 로컬 DB로 반복 실행된다.

## 근거
- `CMS-04` — 「콘텐츠 작성 및 게시」, `wiki/requirements.md` 25-30행
- `CMS-05` — 「콘텐츠 작성 및 게시」, `wiki/requirements.md` 25-31행
- `CMS-06` — 「콘텐츠 작성 및 게시」, `wiki/requirements.md` 25-32행
- `CMS-08` — 「콘텐츠 작성 및 게시」, `wiki/requirements.md` 25-34행
- `CMS-13` — 「콘텐츠 작성 및 게시」, `wiki/requirements.md` 25-39행

## UNRESOLVED
없음

## 구현 의존성
- 선행: [게시 lifecycle server 구현](request-apps-publishing.md)
- 선행: [관리자 게시 workflow](request-admin-publishing.md)
- 선행: [공개 홈페이지 콘텐츠 소비](request-web-published-content.md)
