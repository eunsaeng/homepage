# 게시 lifecycle server 구현

- Primary repository: `apps`
- Request type: server

## 요청
초안 미리보기, 게시·재게시, 비게시와 수정 초안 필터를 revision 포인터 기반 트랜잭션으로 구현한다.

## 범위
- 미리보기는 `CONTENT_EDITOR` 또는 `PUBLISHER`에게 현재 초안만 반환하고 상태를 바꾸지 않는다.
- 게시는 `PUBLISHER`만 실행하며, 페이지 행을 잠근 뒤 `revisionId`를 확인하고 공개 포인터 전환, draft 포인터 해제, `published_slug`·`last_published_at` 설정, `unpublished_at` 해제를 한 트랜잭션으로 처리한다.
- 비게시는 공개 포인터를 비우고 `UNPUBLISHED`, `unpublished_at`을 설정한다.
- 페이지 목록에 `hasDraft` 필터를 추가한다.

## 완료 기준
- 미리보기 후 공개 API 결과가 바뀌지 않는다.
- 게시·재게시 후 공개 API가 새 revision을 반환한다.
- 비게시 후 공개 주소 조회가 404가 되고 공개 메뉴에서도 빠진다.
- 초안 없음, 오래된 revision, 이미 비게시 상태의 충돌 응답을 검증한다.
- `hasDraft=true` 조회가 수정 초안이 있는 페이지만 반환한다.

## 근거
- `CMS-04` — 「콘텐츠 작성 및 게시」, `wiki/requirements.md` 25-30행
- `CMS-05` — 「콘텐츠 작성 및 게시」, `wiki/requirements.md` 25-31행
- `CMS-06` — 「콘텐츠 작성 및 게시」, `wiki/requirements.md` 25-32행
- `CMS-08` — 「콘텐츠 작성 및 게시」, `wiki/requirements.md` 25-34행
- `CMS-13` — 「콘텐츠 작성 및 게시」, `wiki/requirements.md` 25-39행

## UNRESOLVED
없음

## 구현 의존성
- 계약: [미리보기·게시 API 계약](request-apps-publishing-contract.md)
- 선행: [콘텐츠 초안 server 구현](request-apps-content-authoring.md)
- 후속: [관리자 게시 workflow](request-admin-publishing.md)
- 후속: [게시 lifecycle E2E 검증](request-e2e-publishing.md)
