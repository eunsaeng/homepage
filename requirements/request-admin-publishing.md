# 관리자 게시 workflow

- Primary repository: `admin`
- Request type: client

## 요청
콘텐츠 편집자가 초안을 미리보고, 게시 담당자가 게시 대기 초안을 찾아 게시·재게시·비게시할 수 있는 관리자 workflow를 구현한다.

## 범위
- 저장된 초안을 미리보기 화면에서 공개 화면과 구분해 Markdown으로 렌더링한다.
- 게시 담당자에게 게시, 재게시, 비게시 버튼을 제공한다. 게시 요청에는 화면에 표시한 초안의 `revisionId`를 보낸다.
- 페이지 목록에 "수정 초안 있음" 필터를 제공한다.
- `REVISION_MISMATCH`이면 최신 초안을 다시 불러오도록 안내한다.
- 게시 권한이 없는 사용자에게는 게시 버튼을 보이지 않으며, API도 권한을 다시 검사한다.

## 완료 기준
- 미리보기는 게시 여부를 바꾸지 않는다.
- 게시·재게시·비게시 후 상태를 다시 조회해 화면에 반영한다.
- 수정 초안 필터 결과가 API 응답과 일치한다.

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
- 선행: [게시 lifecycle server 구현](request-apps-publishing.md)
- 선행: [관리자 콘텐츠 작성 화면](request-admin-content-authoring.md)
- 후속: [게시 lifecycle E2E 검증](request-e2e-publishing.md)
