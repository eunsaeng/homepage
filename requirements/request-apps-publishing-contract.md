# 미리보기·게시 API 계약

- Primary repository: `apps`
- Request type: API contract

## 요청
초안 미리보기, 게시·재게시, 비게시 API 계약과, 게시 담당자가 게시 대기 중인 수정 초안을 찾는 목록 조건을 정의한다.

## 범위
- `GET /api/admin/pages/{pageId}/draft/preview`, `POST /api/admin/pages/{pageId}/publish`, `POST /api/admin/pages/{pageId}/unpublish`의 입력·출력·권한·오류를 정의한다.
- 게시 요청은 화면에서 확인한 `revisionId`를 받고, 현재 초안과 다르면 `REVISION_MISMATCH`, 초안이 없으면 `STATE_CONFLICT`로 거부한다.
- 첫 게시, 수정 초안 재게시, 비게시 페이지 재게시가 모두 같은 게시 API를 쓰며, 비게시 페이지를 다시 게시하려면 초안이 있어야 한다.
- 비게시는 공개 페이지·공개 메뉴에서 제외하고 메뉴 항목과 revision은 보존한다.
- `GET /api/admin/pages`의 `hasDraft=true` 조건으로 게시되지 않은 수정 초안이 있는 페이지만 조회하는 규칙을 정의한다.

## 완료 기준
- 세 API와 `hasDraft` 조건이 `wiki/api-spec.md`와 일치하게 문서화된다.
- 미리보기와 초안 저장이 공개 응답을 바꾸지 않는다고 명시된다.
- 공개 여부가 공개 페이지와 공개 메뉴 응답에 같이 적용된다고 명시된다.

## 근거
- `CMS-04` — 「콘텐츠 작성 및 게시」, `wiki/requirements.md` 25-30행
- `CMS-05` — 「콘텐츠 작성 및 게시」, `wiki/requirements.md` 25-31행
- `CMS-06` — 「콘텐츠 작성 및 게시」, `wiki/requirements.md` 25-32행
- `CMS-08` — 「콘텐츠 작성 및 게시」, `wiki/requirements.md` 25-34행
- `CMS-13` — 「콘텐츠 작성 및 게시」, `wiki/requirements.md` 25-39행

## UNRESOLVED
없음

## 구현 의존성
- 선행: [콘텐츠 초안 API 계약](request-apps-content-authoring-contract.md)
- 후속: [게시 lifecycle server 구현](request-apps-publishing.md)
- 후속: [관리자 게시 workflow](request-admin-publishing.md)
