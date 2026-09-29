# 콘텐츠 초안 E2E 검증

- Primary repository: `e2e`
- Request type: E2E

## 요청
콘텐츠 편집자가 새 초안을 저장하고 다시 찾아 수정·삭제하며, 게시 페이지의 공개 revision이 보존되는지 검증한다.

## 범위
- 새 페이지 초안 저장 후 목록 필터와 검색으로 찾아 상세를 여는 흐름을 검증한다.
- 기존 초안 수정 후 최신 revision 표시를 검증한다.
- 게시된 페이지를 수정 저장해도 공개 홈페이지에는 기존 공개 revision이 남고, 상세 화면에서 초안과 공개본이 구분되는지 검증한다.
- 미게시 페이지 삭제와 게시 이력 페이지의 삭제 불가를 검증한다.

## 완료 기준
- 화면 결과와 API 응답이 같은 revision을 가리킨다.
- 공개본과 초안이 서로 다른 revision으로 관찰된다.
- 로컬 계정 fixture와 로컬 DB로 반복 실행된다.

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
- 선행: [콘텐츠 초안 server 구현](request-apps-content-authoring.md)
- 선행: [관리자 콘텐츠 작성 화면](request-admin-content-authoring.md)
- 선행: [게시 lifecycle server 구현](request-apps-publishing.md)
