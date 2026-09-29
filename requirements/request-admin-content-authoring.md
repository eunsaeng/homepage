# 관리자 콘텐츠 작성 화면

- Primary repository: `admin`
- Request type: client

## 요청
페이지 목록·상세 화면과, 콘텐츠 편집자가 페이지를 작성하고 초안을 수정·삭제하는 화면을 구현한다.

## 범위
- 페이지 목록에 상태 필터와 제목·slug 검색, 페이지 이동을 제공한다.
- 새 페이지의 slug, 제목, Markdown 본문을 입력해 초안으로 저장한다.
- 상세 화면에서 현재 초안과 공개 중인 내용을 나란히 구분해 표시한다.
- 기존 초안과 게시 페이지의 수정 초안을 저장한다.
- 한 번도 게시되지 않은 페이지에만 삭제 버튼을 보여준다.
- 저장 중·성공·검증 오류·slug 충돌 상태를 표시하고, 권한 판단과 저장은 API에 맡긴다.

## 완료 기준
- 저장 후 재조회한 초안이 편집 내용과 일치한다.
- 게시 페이지의 초안을 수정해도 상세 화면에서 공개본과 분리해 볼 수 있다.
- 필터·검색 결과가 API 응답과 일치한다.
- 콘텐츠 편집 권한이 없는 계정은 저장·삭제를 실행할 수 없다.

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
- 계약: [콘텐츠 초안 API 계약](request-apps-content-authoring-contract.md)
- 선행: [콘텐츠 초안 server 구현](request-apps-content-authoring.md)
- 선행: [관리자 로컬 로그인 화면](request-admin-local-account-login.md)
- 후속: [콘텐츠 초안 E2E 검증](request-e2e-content-authoring.md)
