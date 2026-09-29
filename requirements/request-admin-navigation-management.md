# 관리자 메뉴 편집 화면

- Primary repository: `admin`
- Request type: client

## 요청
콘텐츠 편집자가 게시 페이지를 홈페이지 메뉴에 추가하고, 항목을 제거하거나 한 칸씩 위아래로 옮길 수 있는 화면을 구현한다.

## 범위
- 메뉴 항목을 순서대로 표시하고 항목별 label, 연결 페이지, 게시 여부를 보여준다.
- 게시 페이지를 선택하고 label을 입력해 메뉴 끝에 추가한다.
- 항목마다 위로·아래로 버튼을 두고, 맨 앞 항목의 위로와 맨 끝 항목의 아래로는 비활성화한다.
- 항목 제거는 메뉴에서만 빼고 페이지는 보존한다.
- 충돌·오류 결과를 API 응답과 맞춰 표시한다.

## 완료 기준
- 추가·이동·삭제 후 다시 조회한 메뉴가 화면과 일치한다.
- 비게시 페이지는 추가 대상에서 빠지거나 API 오류로 명확히 거부된다.
- 콘텐츠 편집 권한이 없는 사용자는 메뉴를 변경할 수 없다.

## 근거
- `WEB-03` — 「공개 홈페이지」, `wiki/requirements.md` 41-45행
- `WEB-04` — 「공개 홈페이지」, `wiki/requirements.md` 41-46행
- `WEB-06` — 「공개 홈페이지」, `wiki/requirements.md` 41-48행

## UNRESOLVED
없음

## 구현 의존성
- 계약: [관리자 메뉴 편집 API 계약](request-apps-navigation-contract.md)
- 선행: [관리자 메뉴 편집 server 구현](request-apps-navigation-management.md)
- 선행: [관리자 로컬 로그인 화면](request-admin-local-account-login.md)
- 후속: [메뉴 lifecycle E2E 검증](request-e2e-navigation-management.md)
