# 콘텐츠 초안 API 계약

- Primary repository: `apps`
- Request type: API contract

## 요청
콘텐츠 편집자가 페이지를 만들고 초안을 저장·삭제하며, 편집자와 게시 담당자가 페이지를 목록에서 찾고 상세에서 초안과 공개본을 비교할 수 있도록 API 계약을 정의한다.

## 범위
- `POST /api/admin/pages`, `PUT /api/admin/pages/{pageId}/draft`, `GET /api/admin/pages`, `GET /api/admin/pages/{pageId}`, `DELETE /api/admin/pages/{pageId}`의 입력·출력·권한·오류를 정의한다.
- 공통 형식 `PageSummary`, `PageDetail`, `DraftRevision`, `PublishedRevision`을 정의한다.
- 페이지 목록의 `status`·`query`(제목·slug)·페이지 입력과 `updatedAt` 내림차순 정렬을 정의한다.
- 초안 저장은 항상 새 revision을 만들고 공개 revision과 공개 slug를 바꾸지 않는다.
- slug 형식과 작업·공개 slug 전체 유일성(`SLUG_CONFLICT`), 필드 길이(`VALIDATION_FAILED`)를 정의한다.
- 삭제는 한 번도 게시되지 않은 페이지만 허용하고, 게시 이력이 있으면 `STATE_CONFLICT`로 거부한다. 게시 페이지의 수정 초안 폐기는 요구사항 미결 사항이므로 계약에 넣지 않는다.

## 완료 기준
- 다섯 API의 method, path, 입력, 출력, 권한, 오류가 `wiki/api-spec.md`와 일치하게 문서화된다.
- revision ID와 순번으로 초안과 공개본을 구별할 수 있다.

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
- 선행: [계정 역할 관리 API 계약](request-apps-role-management-contract.md)
- 후속: [콘텐츠 초안 server 구현](request-apps-content-authoring.md)
- 후속: [관리자 콘텐츠 작성 화면](request-admin-content-authoring.md)
