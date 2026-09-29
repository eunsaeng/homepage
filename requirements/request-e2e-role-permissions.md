# 역할별 권한 E2E 검증

- Primary repository: `e2e`
- Request type: E2E

## 요청
로컬 fixture의 역할별 계정으로 허용된 관리자 기능은 성공하고 허용되지 않은 기능은 거부되는지 검증한다.

## 범위
- 권한 관리자의 역할 부여·회수를 검증한다.
- 콘텐츠 편집자의 초안 저장 허용과 게시·역할 관리 거부를 검증한다.
- 게시 담당자의 게시 허용과 초안 저장·역할 관리 거부를 검증한다.
- 역할을 모두 회수당한 계정의 기존 세션이 관리자 API에서 거부되는지 검증한다.

## 완료 기준
- UI 제어와 API 응답을 함께 확인해 서버 권한 검사를 검증한다.
- 성공·거부 결과가 역할 fixture로 반복 재현된다.
- DAOU Office 연결 없이 로컬에서 실행된다.

## 근거
- `ACC-03` — 「계정 동기화 및 관리자 접근」, `wiki/requirements.md` 9-13행
- `ACC-04` — 「계정 동기화 및 관리자 접근」, `wiki/requirements.md` 9-14행
- `ACC-06` — 「계정 동기화 및 관리자 접근」, `wiki/requirements.md` 9-16행

## UNRESOLVED
없음

## 구현 의존성
- 선행: [계정 역할·권한 server 구현](request-apps-role-enforcement.md)
- 선행: [관리자 역할 부여·회수 화면](request-admin-role-management.md)
- 선행: [콘텐츠 초안 server 구현](request-apps-content-authoring.md)
- 선행: [게시 lifecycle server 구현](request-apps-publishing.md)
