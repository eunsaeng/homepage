# API Specification

> 대상: `apps/api` 로컬 개발 API\
> 기준 문서: [요구사항](requirements.md), [로컬 아키텍처](architecture.md), [ERD](erd.md)\
> Base URL: `http://localhost:8080`\
> Content-Type: `application/json; charset=utf-8`\
> 모든 시간은 UTC ISO-8601 형식(`2026-09-29T04:00:00Z`)으로 주고받는다.

## 1. 공통 규칙

- 공개 API(`/api/public/**`)는 인증 없이 호출할 수 있고, 게시 상태인 콘텐츠만 반환한다.
- 관리자 API(`/api/admin/**`)는 `local_session` HttpOnly 쿠키로 인증한다. 쿠키는 `SameSite=Lax`, `Path=/`, 만료 8시간이다.
- 로컬 stub 로그인과 stub 계정 목록 API는 Spring의 `local` 프로필에서만 등록된다. 다른 프로필에서는 `404 NOT_FOUND`를 반환한다.
- API는 요청마다 세션 유효성, 계정 활성 상태, 필요한 역할을 확인한다. UI 권한 제어는 보안 경계로 간주하지 않는다.
- 세션이 없거나 만료되었거나 로그아웃으로 폐기되었으면 `401 UNAUTHORIZED`, 계정 비활성화나 역할 전부 회수로 폐기되었으면 `403 FORBIDDEN`으로 응답해 admin이 다시 로그인할지 접근 불가를 안내할지 구분하게 한다.
- 관리자 역할은 `ROLE_MANAGER`(권한 관리자), `CONTENT_EDITOR`(콘텐츠 편집자), `PUBLISHER`(게시 담당자)이며, 한 계정에 여러 역할을 부여할 수 있다.
- 허용 Origin은 `http://localhost:3000`, `http://localhost:3001`이며 credential 요청을 허용한다.
- 목록 API의 `page`는 0부터 시작하고, 기본 `size`는 20, 최대 100이다.
- 요청 표의 `위치`는 `path`, `query`, `cookie`, `body`(JSON) 중 하나다. 필수가 아닌 항목은 생략할 수 있다.
- 쓰기 요청 body에 정의되지 않은 필드가 있으면 `400 BAD_REQUEST`로 거부한다.

### 공통 오류 응답

모든 오류는 아래 형식으로 응답한다.

| 필드 | 형식 | 설명 |
|---|---|---|
| `error.code` | string | 오류 코드 (아래 표) |
| `error.message` | string | 사용자에게 보여줄 수 있는 한국어 메시지 |
| `error.fields[]` | object[] | 필드 검증 오류 목록. 검증 오류가 아니면 빈 배열 |
| `error.fields[].name` | string | 요청 필드 이름 |
| `error.fields[].reason` | string | 오류 사유 |
| `error.traceId` | string | 서버 로그 추적 ID |

```json
{
  "error": {
    "code": "SLUG_CONFLICT",
    "message": "이미 사용 중인 주소입니다.",
    "fields": [{ "name": "slug", "reason": "이미 사용 중인 주소입니다." }],
    "traceId": "local-7f3a"
  }
}
```

| HTTP 상태 | `error.code` | 의미 |
|---:|---|---|
| 400 | `BAD_REQUEST` | JSON 파싱 실패, 알 수 없는 필드, 잘못된 query 형식 |
| 401 | `UNAUTHORIZED` | 세션 없음, 만료 또는 로그아웃된 세션 |
| 403 | `FORBIDDEN` | 계정 비활성, 역할 없음 또는 필요한 역할 없음 |
| 403 | `LOGIN_DENIED` | 로그인 대상 계정이 없거나 비활성이거나 역할이 없음 |
| 404 | `NOT_FOUND` | 계정·역할·페이지·revision·메뉴 항목·동기화 이력이 없음, 또는 현재 프로필에서 제공하지 않는 API |
| 409 | `SLUG_CONFLICT` | 다른 페이지가 이미 사용하는 slug |
| 409 | `STATE_CONFLICT` | 현재 상태에서 할 수 없는 작업 (게시할 초안 없음, 비게시 대상 아님, 게시 이력 있는 페이지 삭제 등) |
| 409 | `REVISION_MISMATCH` | 요청한 revision이 현재 초안이 아님 |
| 409 | `NAVIGATION_CONFLICT` | 이미 메뉴에 있는 페이지, 게시되지 않은 페이지 추가, 끝 위치에서 더 이동 |
| 409 | `LAST_ROLE_MANAGER` | 활성 권한 관리자가 한 명뿐인데 그 역할을 회수하려 함 |
| 409 | `SYNC_IN_PROGRESS` | 이미 실행 중인 계정 동기화가 있음 |
| 422 | `VALIDATION_FAILED` | 필드 형식 또는 길이 제약 위반 |
| 500 | `INTERNAL_ERROR` | 서버 오류 |

## 2. 공통 데이터 형식

여러 API가 같은 구조로 응답하는 객체다. 각 API의 응답 표에서 형식 이름으로 참조한다.

### `Account`

| 필드 | 형식 | 설명 |
|---|---|---|
| `accountId` | string | 계정 ID |
| `displayName` | string | 이름 |
| `email` | string | 이메일 |
| `active` | boolean | 활성 여부. `false`면 로그인과 API 호출이 거부된다 |
| `roles` | string[] | 부여된 역할 코드. 없으면 빈 배열 |
| `syncedAt` | string | 마지막 동기화 시각 |

### `PageSummary`

| 필드 | 형식 | 설명 |
|---|---|---|
| `pageId` | string | 페이지 ID |
| `slug` | string | 현재 작업 slug |
| `title` | string | 초안이 있으면 초안 제목, 없으면 공개 revision 제목 |
| `status` | string | `DRAFT`, `PUBLISHED`, `UNPUBLISHED` |
| `hasDraft` | boolean | 게시되지 않은 초안이 있는지 여부 |
| `publishedAt` | string \| null | 마지막 게시 시각. 게시 이력이 없으면 `null` |
| `updatedAt` | string | 페이지 최종 변경 시각 |
| `updatedBy` | string | 최종 변경 계정 ID |

### `PageDetail`

| 필드 | 형식 | 설명 |
|---|---|---|
| `pageId` | string | 페이지 ID |
| `slug` | string | 현재 작업 slug |
| `publishedSlug` | string \| null | 공개 URL에 쓰이는 slug. 게시 이력이 없으면 `null` |
| `status` | string | `DRAFT`, `PUBLISHED`, `UNPUBLISHED` |
| `draft` | `DraftRevision` \| null | 현재 초안. 없으면 `null` |
| `published` | `PublishedRevision` \| null | 현재 공개 revision. 게시 중이 아니면 `null` |
| `createdAt` | string | 페이지 생성 시각 |
| `updatedAt` | string | 페이지 최종 변경 시각 |

`status`는 공개 상태다. 수정 초안이 있는 게시 페이지도 `PUBLISHED`이며, 이때 `draft`와 `published`는 서로 다른 revision이다.

### `DraftRevision`

| 필드 | 형식 | 설명 |
|---|---|---|
| `revisionId` | string | revision ID |
| `revision` | integer | 페이지 내 revision 순번 (1부터) |
| `slug` | string | 이 revision의 slug |
| `title` | string | 제목 |
| `body` | string | Markdown 원문 |
| `updatedAt` | string | revision 생성 시각 |
| `updatedBy` | string | 작성 계정 ID |

### `PublishedRevision`

| 필드 | 형식 | 설명 |
|---|---|---|
| `revisionId` | string | revision ID |
| `revision` | integer | 페이지 내 revision 순번 |
| `slug` | string | 공개 slug |
| `title` | string | 제목 |
| `body` | string | Markdown 원문 |
| `publishedAt` | string | 게시 시각 |

### `NavigationItem`

| 필드 | 형식 | 설명 |
|---|---|---|
| `itemId` | string | 메뉴 항목 ID |
| `pageId` | string | 연결된 페이지 ID |
| `slug` | string \| null | 연결된 페이지의 공개 slug. 게시 이력이 없으면 `null` |
| `label` | string | 메뉴 표시명 |
| `position` | integer | 0부터 시작하는 표시 순서 |
| `published` | boolean | 연결된 페이지가 현재 게시 상태인지 여부 |

### `SyncRun`

| 필드 | 형식 | 설명 |
|---|---|---|
| `syncRunId` | string | 동기화 실행 ID (UUID) |
| `identityProvider` | string | `STUB` 또는 `DAOU_OFFICE`. 로컬은 항상 `STUB` |
| `status` | string | `RUNNING`, `SUCCEEDED`, `FAILED` |
| `createdCount` | integer | 새로 등록된 계정 수 |
| `updatedCount` | integer | 정보가 갱신된 계정 수 |
| `deactivatedCount` | integer | 비활성으로 바뀐 계정 수 |
| `startedAt` | string | 시작 시각 |
| `syncedAt` | string \| null | 성공 완료 시각. 실행 중이거나 실패면 `null` |
| `triggeredBy` | string \| null | 실행한 계정 ID. 자동 실행이면 `null` |

### `PageInfo`

목록 응답은 `items`와 함께 아래 필드를 반환한다.

| 필드 | 형식 | 설명 |
|---|---|---|
| `page` | integer | 현재 페이지 번호 (0부터) |
| `size` | integer | 페이지 크기 |
| `totalElements` | integer | 전체 항목 수 |
| `totalPages` | integer | 전체 페이지 수 |

## 3. 공개 API

### `GET /api/public/navigation`

게시된 페이지에 연결된 메뉴 항목을 표시 순서대로 반환한다. 비게시 페이지의 메뉴 항목은 제외한다.

- 권한: 공개
- 성공: `200 OK`

요청: 없음

응답:

| 필드 | 형식 | 설명 |
|---|---|---|
| `items[]` | object[] | 표시 순서(`position` 오름차순)로 정렬된 메뉴 |
| `items[].itemId` | string | 메뉴 항목 ID |
| `items[].pageId` | string | 페이지 ID |
| `items[].slug` | string | 공개 slug |
| `items[].label` | string | 메뉴 표시명 |
| `items[].position` | integer | 표시 순서 |

```json
{
  "items": [
    { "itemId": "nav_01J8X5A1", "pageId": "pg_01J8X4M2", "slug": "company-overview", "label": "회사 소개", "position": 0 }
  ]
}
```

### `GET /api/public/pages/{slug}`

공개 slug에 해당하는 게시 revision을 반환한다. 초안, 비게시 페이지, 없는 slug는 모두 같은 404로 응답해 존재 여부를 드러내지 않는다.

- 권한: 공개
- 성공: `200 OK`

요청:

| 위치 | 필드 | 형식 | 필수 | 제약 |
|---|---|---|:---:|---|
| path | `slug` | string | O | `^[a-z0-9]+(?:-[a-z0-9]+)*$`, 1~160자 |

응답:

| 필드 | 형식 | 설명 |
|---|---|---|
| `pageId` | string | 페이지 ID |
| `slug` | string | 공개 slug |
| `title` | string | 제목 |
| `body` | string | Markdown 원문 |
| `revisionId` | string | 공개 revision ID |
| `publishedAt` | string | 게시 시각 |
| `updatedAt` | string | 공개 revision 작성 시각 |

오류:

| 상태 | 코드 | 조건 |
|---:|---|---|
| 404 | `NOT_FOUND` | 없거나 게시 상태가 아닌 slug, slug 형식 위반 |

## 4. 로컬 stub 인증 API

### `GET /api/admin/auth/local-accounts`

로컬 로그인 화면에서 선택할 수 있는 동기화된 stub 계정 목록을 반환한다. 역할 없는 계정과 비활성 계정도 거부 시나리오 확인을 위해 포함한다.

- 권한: 비로그인, `local` 프로필 전용
- 성공: `200 OK`

요청: 없음

응답:

| 필드 | 형식 | 설명 |
|---|---|---|
| `items[]` | `Account`[] | 동기화된 stub 계정 (`accountId` 오름차순) |

오류:

| 상태 | 코드 | 조건 |
|---:|---|---|
| 404 | `NOT_FOUND` | `local` 프로필이 아님 |

### `POST /api/admin/auth/local-login`

stub 계정으로 로그인하고 세션 쿠키를 발급한다. 계정은 동기화되어 있고 활성 상태이며 역할이 하나 이상 있어야 한다.

- 권한: 비로그인, `local` 프로필 전용
- 성공: `200 OK`, `Set-Cookie: local_session=...; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800`

요청:

| 위치 | 필드 | 형식 | 필수 | 제약 |
|---|---|---|:---:|---|
| body | `accountId` | string | O | 1~120자 |

응답:

| 필드 | 형식 | 설명 |
|---|---|---|
| `account` | `Account` | 로그인한 계정 |
| `expiresAt` | string | 세션 만료 시각 |

```json
{
  "account": {
    "accountId": "editor01",
    "displayName": "로컬 콘텐츠 편집자",
    "email": "editor01@example.local",
    "active": true,
    "roles": ["CONTENT_EDITOR"],
    "syncedAt": "2026-09-29T01:00:00Z"
  },
  "expiresAt": "2026-09-29T12:00:00Z"
}
```

오류:

| 상태 | 코드 | 조건 |
|---:|---|---|
| 403 | `LOGIN_DENIED` | 동기화 목록에 없거나 비활성이거나 역할이 없는 계정 |
| 404 | `NOT_FOUND` | `local` 프로필이 아님 |
| 422 | `VALIDATION_FAILED` | `accountId` 누락 또는 길이 위반 |

### `GET /api/admin/auth/session`

현재 세션의 계정과 역할을 반환한다. admin은 이 응답의 `roles`로 메뉴 노출을 결정한다.

- 권한: 로그인 계정 (역할 무관)
- 성공: `200 OK`

요청:

| 위치 | 필드 | 형식 | 필수 | 제약 |
|---|---|---|:---:|---|
| cookie | `local_session` | string | O | 유효한 세션 토큰 |

응답:

| 필드 | 형식 | 설명 |
|---|---|---|
| `account` | `Account` | 현재 계정 |
| `expiresAt` | string | 세션 만료 시각 |

오류:

| 상태 | 코드 | 조건 |
|---:|---|---|
| 401 | `UNAUTHORIZED` | 세션 없음·만료·로그아웃 |
| 403 | `FORBIDDEN` | 계정 비활성화 또는 역할 전부 회수로 세션이 폐기됨 |

### `POST /api/admin/auth/logout`

현재 세션을 폐기하고 쿠키를 만료시킨다.

- 권한: 로그인 계정
- 성공: `204 NO CONTENT`, `Set-Cookie: local_session=; Max-Age=0; Path=/`

요청:

| 위치 | 필드 | 형식 | 필수 | 제약 |
|---|---|---|:---:|---|
| cookie | `local_session` | string | O | 유효한 세션 토큰 |

응답: body 없음

오류:

| 상태 | 코드 | 조건 |
|---:|---|---|
| 401 | `UNAUTHORIZED` | 세션 없음·만료·이미 로그아웃 |

## 5. 계정 및 역할 API

### `POST /api/admin/accounts/sync`

계정 디렉터리를 읽어 계정을 upsert한다. 로컬은 stub 디렉터리를 사용하고, stg 이상 환경의 DAOU Office 디렉터리는 배포·운영 아키텍처에서 정의한다. 반복 실행해도 계정이 중복되지 않으며, 디렉터리에서 비활성화되었거나 사라진 계정은 삭제하지 않고 `active=false`로 바꾸고 해당 계정의 세션을 폐기한다.

- 권한: `ROLE_MANAGER`
- 성공: `200 OK`

요청:

| 위치 | 필드 | 형식 | 필수 | 제약 |
|---|---|---|:---:|---|
| cookie | `local_session` | string | O | 유효한 세션 토큰 |

응답:

| 필드 | 형식 | 설명 |
|---|---|---|
| `syncRun` | `SyncRun` | 완료된 동기화 결과 |

오류:

| 상태 | 코드 | 조건 |
|---:|---|---|
| 401 | `UNAUTHORIZED` | 세션 없음 |
| 403 | `FORBIDDEN` | `ROLE_MANAGER` 없음 |
| 409 | `SYNC_IN_PROGRESS` | 실행 중인 동기화가 있음 |
| 500 | `INTERNAL_ERROR` | 디렉터리 조회 실패. 동기화 이력은 `FAILED`로 기록 |

### `GET /api/admin/accounts/sync-runs/latest`

가장 최근 계정 동기화의 결과를 반환한다.

- 권한: `ROLE_MANAGER`
- 성공: `200 OK`

요청:

| 위치 | 필드 | 형식 | 필수 | 제약 |
|---|---|---|:---:|---|
| cookie | `local_session` | string | O | 유효한 세션 토큰 |

응답:

| 필드 | 형식 | 설명 |
|---|---|---|
| `syncRun` | `SyncRun` | 가장 최근에 시작된 동기화 |

오류:

| 상태 | 코드 | 조건 |
|---:|---|---|
| 401 | `UNAUTHORIZED` | 세션 없음 |
| 403 | `FORBIDDEN` | `ROLE_MANAGER` 없음 |
| 404 | `NOT_FOUND` | 동기화 이력이 없음 |

### `GET /api/admin/accounts`

동기화된 계정을 검색하고 활성 상태와 역할을 확인한다.

- 권한: `ROLE_MANAGER`
- 성공: `200 OK`

요청:

| 위치 | 필드 | 형식 | 필수 | 제약 |
|---|---|---|:---:|---|
| query | `query` | string | | 이름·계정 ID·이메일 부분 일치, 대소문자 무시, 최대 100자 |
| query | `active` | boolean | | 지정하면 해당 활성 상태만 |
| query | `page` | integer | | 0 이상, 기본 0 |
| query | `size` | integer | | 1~100, 기본 20 |
| cookie | `local_session` | string | O | 유효한 세션 토큰 |

응답:

| 필드 | 형식 | 설명 |
|---|---|---|
| `items[]` | `Account`[] | 이름 오름차순 계정 목록 |
| `page`, `size`, `totalElements`, `totalPages` | integer | `PageInfo` |

오류:

| 상태 | 코드 | 조건 |
|---:|---|---|
| 400 | `BAD_REQUEST` | query 형식 오류 |
| 401 | `UNAUTHORIZED` | 세션 없음 |
| 403 | `FORBIDDEN` | `ROLE_MANAGER` 없음 |

### `PUT /api/admin/accounts/{accountId}/roles/{roleCode}`

계정에 역할 하나를 부여한다. 이미 부여된 역할이면 변경 없이 성공한다.

- 권한: `ROLE_MANAGER`
- 성공: `200 OK`

요청:

| 위치 | 필드 | 형식 | 필수 | 제약 |
|---|---|---|:---:|---|
| path | `accountId` | string | O | 동기화된 계정 ID |
| path | `roleCode` | string | O | `ROLE_MANAGER`, `CONTENT_EDITOR`, `PUBLISHER` |
| cookie | `local_session` | string | O | 유효한 세션 토큰 |

응답:

| 필드 | 형식 | 설명 |
|---|---|---|
| `account` | `Account` | 역할이 반영된 계정 |
| `rolesUpdatedAt` | string | 역할 최종 변경 시각 |

오류:

| 상태 | 코드 | 조건 |
|---:|---|---|
| 401 | `UNAUTHORIZED` | 세션 없음 |
| 403 | `FORBIDDEN` | `ROLE_MANAGER` 없음 |
| 404 | `NOT_FOUND` | 계정 또는 역할 코드가 없음 |
| 409 | `STATE_CONFLICT` | 비활성 계정에 부여 |

### `DELETE /api/admin/accounts/{accountId}/roles/{roleCode}`

계정에서 역할 하나를 회수한다. 부여되지 않은 역할이면 변경 없이 성공한다. 마지막 역할을 회수하면 해당 계정의 세션을 폐기해 관리자 접근을 즉시 차단한다.

- 권한: `ROLE_MANAGER`
- 성공: `200 OK`

요청:

| 위치 | 필드 | 형식 | 필수 | 제약 |
|---|---|---|:---:|---|
| path | `accountId` | string | O | 동기화된 계정 ID |
| path | `roleCode` | string | O | `ROLE_MANAGER`, `CONTENT_EDITOR`, `PUBLISHER` |
| cookie | `local_session` | string | O | 유효한 세션 토큰 |

응답:

| 필드 | 형식 | 설명 |
|---|---|---|
| `account` | `Account` | 역할이 반영된 계정 |
| `rolesUpdatedAt` | string | 역할 최종 변경 시각 |

오류:

| 상태 | 코드 | 조건 |
|---:|---|---|
| 401 | `UNAUTHORIZED` | 세션 없음 |
| 403 | `FORBIDDEN` | `ROLE_MANAGER` 없음 |
| 404 | `NOT_FOUND` | 계정 또는 역할 코드가 없음 |
| 409 | `LAST_ROLE_MANAGER` | 마지막 활성 권한 관리자의 `ROLE_MANAGER` 회수 |

## 6. 관리자 콘텐츠 API

### `GET /api/admin/pages`

관리 대상 페이지를 필터링·검색한다.

- 권한: `CONTENT_EDITOR` 또는 `PUBLISHER`
- 성공: `200 OK`

요청:

| 위치 | 필드 | 형식 | 필수 | 제약 |
|---|---|---|:---:|---|
| query | `status` | string | | `DRAFT`, `PUBLISHED`, `UNPUBLISHED` |
| query | `hasDraft` | boolean | | `true`면 게시되지 않은 초안이 있는 페이지만 |
| query | `query` | string | | 제목·slug 부분 일치, 대소문자 무시, 최대 100자 |
| query | `page` | integer | | 0 이상, 기본 0 |
| query | `size` | integer | | 1~100, 기본 20 |
| cookie | `local_session` | string | O | 유효한 세션 토큰 |

응답:

| 필드 | 형식 | 설명 |
|---|---|---|
| `items[]` | `PageSummary`[] | `updatedAt` 내림차순 페이지 목록 |
| `page`, `size`, `totalElements`, `totalPages` | integer | `PageInfo` |

오류:

| 상태 | 코드 | 조건 |
|---:|---|---|
| 400 | `BAD_REQUEST` | query 형식 오류 |
| 401 | `UNAUTHORIZED` | 세션 없음 |
| 403 | `FORBIDDEN` | 필요한 역할 없음 |

### `POST /api/admin/pages`

새 페이지와 첫 초안 revision을 한 트랜잭션으로 생성한다.

- 권한: `CONTENT_EDITOR`
- 성공: `201 CREATED`, `Location: /api/admin/pages/{pageId}`

요청:

| 위치 | 필드 | 형식 | 필수 | 제약 |
|---|---|---|:---:|---|
| body | `slug` | string | O | `^[a-z0-9]+(?:-[a-z0-9]+)*$`, 1~160자, 모든 페이지의 작업·공개 slug와 중복 불가 |
| body | `title` | string | O | 앞뒤 공백 제외 1~160자 |
| body | `body` | string | O | Markdown 원문, 최대 200,000자 |
| cookie | `local_session` | string | O | 유효한 세션 토큰 |

응답: `PageDetail` (`status`는 `DRAFT`, `published`는 `null`)

오류:

| 상태 | 코드 | 조건 |
|---:|---|---|
| 401 | `UNAUTHORIZED` | 세션 없음 |
| 403 | `FORBIDDEN` | `CONTENT_EDITOR` 없음 |
| 409 | `SLUG_CONFLICT` | slug 중복 |
| 422 | `VALIDATION_FAILED` | 필드 형식·길이 위반 |

### `GET /api/admin/pages/{pageId}`

페이지의 현재 초안과 공개 revision을 함께 조회한다.

- 권한: `CONTENT_EDITOR` 또는 `PUBLISHER`
- 성공: `200 OK`

요청:

| 위치 | 필드 | 형식 | 필수 | 제약 |
|---|---|---|:---:|---|
| path | `pageId` | string | O | 페이지 ID |
| cookie | `local_session` | string | O | 유효한 세션 토큰 |

응답: `PageDetail`

오류:

| 상태 | 코드 | 조건 |
|---:|---|---|
| 401 | `UNAUTHORIZED` | 세션 없음 |
| 403 | `FORBIDDEN` | 필요한 역할 없음 |
| 404 | `NOT_FOUND` | 페이지 없음 |

### `PUT /api/admin/pages/{pageId}/draft`

초안을 새 revision으로 저장하고 초안 포인터를 옮긴다. 게시 페이지에 저장하면 공개 revision과 공개 slug는 바뀌지 않는다.

- 권한: `CONTENT_EDITOR`
- 성공: `200 OK`

요청:

| 위치 | 필드 | 형식 | 필수 | 제약 |
|---|---|---|:---:|---|
| path | `pageId` | string | O | 페이지 ID |
| body | `slug` | string | O | `POST /api/admin/pages`와 같음. 자기 페이지의 slug는 중복으로 보지 않음 |
| body | `title` | string | O | 앞뒤 공백 제외 1~160자 |
| body | `body` | string | O | Markdown 원문, 최대 200,000자 |
| cookie | `local_session` | string | O | 유효한 세션 토큰 |

응답: `PageDetail` (`draft`는 방금 저장한 revision)

오류:

| 상태 | 코드 | 조건 |
|---:|---|---|
| 401 | `UNAUTHORIZED` | 세션 없음 |
| 403 | `FORBIDDEN` | `CONTENT_EDITOR` 없음 |
| 404 | `NOT_FOUND` | 페이지 없음 |
| 409 | `SLUG_CONFLICT` | 다른 페이지가 사용 중인 slug |
| 422 | `VALIDATION_FAILED` | 필드 형식·길이 위반 |

### `GET /api/admin/pages/{pageId}/draft/preview`

저장된 현재 초안을 공개하지 않고 미리보기용으로 반환한다.

- 권한: `CONTENT_EDITOR` 또는 `PUBLISHER`
- 성공: `200 OK`

요청:

| 위치 | 필드 | 형식 | 필수 | 제약 |
|---|---|---|:---:|---|
| path | `pageId` | string | O | 페이지 ID |
| cookie | `local_session` | string | O | 유효한 세션 토큰 |

응답:

| 필드 | 형식 | 설명 |
|---|---|---|
| `pageId` | string | 페이지 ID |
| `revisionId` | string | 초안 revision ID |
| `slug` | string | 초안 slug |
| `title` | string | 초안 제목 |
| `body` | string | Markdown 원문 |
| `updatedAt` | string | 초안 저장 시각 |
| `updatedBy` | string | 초안 작성 계정 ID |

오류:

| 상태 | 코드 | 조건 |
|---:|---|---|
| 401 | `UNAUTHORIZED` | 세션 없음 |
| 403 | `FORBIDDEN` | 필요한 역할 없음 |
| 404 | `NOT_FOUND` | 페이지 또는 초안 없음 |

### `DELETE /api/admin/pages/{pageId}`

한 번도 게시되지 않은 페이지와 그 revision을 삭제한다.

- 권한: `CONTENT_EDITOR`
- 성공: `204 NO CONTENT`

요청:

| 위치 | 필드 | 형식 | 필수 | 제약 |
|---|---|---|:---:|---|
| path | `pageId` | string | O | 페이지 ID |
| cookie | `local_session` | string | O | 유효한 세션 토큰 |

응답: body 없음

오류:

| 상태 | 코드 | 조건 |
|---:|---|---|
| 401 | `UNAUTHORIZED` | 세션 없음 |
| 403 | `FORBIDDEN` | `CONTENT_EDITOR` 없음 |
| 404 | `NOT_FOUND` | 페이지 없음 |
| 409 | `STATE_CONFLICT` | 게시 이력이 있는 페이지 |

### `POST /api/admin/pages/{pageId}/publish`

현재 초안 revision을 게시한다. 공개 revision 전환, 공개 slug 갱신, 초안 포인터 해제, 게시 시각 기록을 한 트랜잭션으로 처리한다. 첫 게시, 수정 초안의 재게시, 비게시 페이지의 재게시 모두 이 API를 쓴다.

- 권한: `PUBLISHER`
- 성공: `200 OK`

요청:

| 위치 | 필드 | 형식 | 필수 | 제약 |
|---|---|---|:---:|---|
| path | `pageId` | string | O | 페이지 ID |
| body | `revisionId` | string | O | 화면에서 확인한 현재 초안 revision ID |
| cookie | `local_session` | string | O | 유효한 세션 토큰 |

응답: `PageDetail` (`status`는 `PUBLISHED`, `draft`는 `null`)

오류:

| 상태 | 코드 | 조건 |
|---:|---|---|
| 401 | `UNAUTHORIZED` | 세션 없음 |
| 403 | `FORBIDDEN` | `PUBLISHER` 없음 |
| 404 | `NOT_FOUND` | 페이지 없음 |
| 409 | `STATE_CONFLICT` | 게시할 초안 없음 |
| 409 | `REVISION_MISMATCH` | `revisionId`가 현재 초안이 아님 (그 사이 다른 편집자가 저장) |
| 409 | `SLUG_CONFLICT` | 초안 slug를 다른 페이지가 공개 slug로 사용 중 |

### `POST /api/admin/pages/{pageId}/unpublish`

게시된 페이지를 공개 조회와 공개 메뉴에서 제외한다. 메뉴 항목과 revision은 보존한다.

- 권한: `PUBLISHER`
- 성공: `200 OK`

요청:

| 위치 | 필드 | 형식 | 필수 | 제약 |
|---|---|---|:---:|---|
| path | `pageId` | string | O | 페이지 ID |
| cookie | `local_session` | string | O | 유효한 세션 토큰 |

응답:

| 필드 | 형식 | 설명 |
|---|---|---|
| `pageId` | string | 페이지 ID |
| `status` | string | `UNPUBLISHED` |
| `unpublishedAt` | string | 비게시 시각 |

오류:

| 상태 | 코드 | 조건 |
|---:|---|---|
| 401 | `UNAUTHORIZED` | 세션 없음 |
| 403 | `FORBIDDEN` | `PUBLISHER` 없음 |
| 404 | `NOT_FOUND` | 페이지 없음 |
| 409 | `STATE_CONFLICT` | 게시 상태가 아님 |

## 7. 관리자 메뉴 API

### `GET /api/admin/navigation/items`

현재 메뉴 편성을 표시 순서대로 조회한다. 비게시 페이지의 항목도 `published=false`로 포함한다.

- 권한: `CONTENT_EDITOR` 또는 `PUBLISHER`
- 성공: `200 OK`

요청:

| 위치 | 필드 | 형식 | 필수 | 제약 |
|---|---|---|:---:|---|
| cookie | `local_session` | string | O | 유효한 세션 토큰 |

응답:

| 필드 | 형식 | 설명 |
|---|---|---|
| `items[]` | `NavigationItem`[] | `position` 오름차순 메뉴 항목 |

오류:

| 상태 | 코드 | 조건 |
|---:|---|---|
| 401 | `UNAUTHORIZED` | 세션 없음 |
| 403 | `FORBIDDEN` | 필요한 역할 없음 |

### `POST /api/admin/navigation/items`

게시된 페이지를 메뉴 끝에 추가한다.

- 권한: `CONTENT_EDITOR`
- 성공: `201 CREATED`

요청:

| 위치 | 필드 | 형식 | 필수 | 제약 |
|---|---|---|:---:|---|
| body | `pageId` | string | O | 게시 상태인 페이지 ID |
| body | `label` | string | O | 앞뒤 공백 제외 1~80자 |
| cookie | `local_session` | string | O | 유효한 세션 토큰 |

응답: `NavigationItem` (추가된 항목, `position`은 기존 마지막 순서 + 1)

오류:

| 상태 | 코드 | 조건 |
|---:|---|---|
| 401 | `UNAUTHORIZED` | 세션 없음 |
| 403 | `FORBIDDEN` | `CONTENT_EDITOR` 없음 |
| 404 | `NOT_FOUND` | 페이지 없음 |
| 409 | `NAVIGATION_CONFLICT` | 게시되지 않은 페이지이거나 이미 메뉴에 있는 페이지 |
| 422 | `VALIDATION_FAILED` | `label` 길이 위반 |

### `POST /api/admin/navigation/items/{itemId}/move`

메뉴 항목 하나를 인접 항목과 자리를 바꿔 한 칸 위 또는 아래로 옮긴다. 두 항목의 순서 교환은 한 트랜잭션으로 처리한다.

- 권한: `CONTENT_EDITOR`
- 성공: `200 OK`

요청:

| 위치 | 필드 | 형식 | 필수 | 제약 |
|---|---|---|:---:|---|
| path | `itemId` | string | O | 메뉴 항목 ID |
| body | `direction` | string | O | `UP`(앞으로) 또는 `DOWN`(뒤로) |
| cookie | `local_session` | string | O | 유효한 세션 토큰 |

응답:

| 필드 | 형식 | 설명 |
|---|---|---|
| `items[]` | `NavigationItem`[] | 순서가 반영된 전체 메뉴 (`position` 오름차순) |

오류:

| 상태 | 코드 | 조건 |
|---:|---|---|
| 401 | `UNAUTHORIZED` | 세션 없음 |
| 403 | `FORBIDDEN` | `CONTENT_EDITOR` 없음 |
| 404 | `NOT_FOUND` | 메뉴 항목 없음 |
| 409 | `NAVIGATION_CONFLICT` | 맨 앞 항목을 `UP`, 맨 끝 항목을 `DOWN`으로 이동 |
| 422 | `VALIDATION_FAILED` | `direction` 값 위반 |

### `DELETE /api/admin/navigation/items/{itemId}`

메뉴 항목을 제거하고 뒤 항목의 순서를 한 칸씩 당긴다. 페이지와 revision은 삭제하지 않는다.

- 권한: `CONTENT_EDITOR`
- 성공: `204 NO CONTENT`

요청:

| 위치 | 필드 | 형식 | 필수 | 제약 |
|---|---|---|:---:|---|
| path | `itemId` | string | O | 메뉴 항목 ID |
| cookie | `local_session` | string | O | 유효한 세션 토큰 |

응답: body 없음

오류:

| 상태 | 코드 | 조건 |
|---:|---|---|
| 401 | `UNAUTHORIZED` | 세션 없음 |
| 403 | `FORBIDDEN` | `CONTENT_EDITOR` 없음 |
| 404 | `NOT_FOUND` | 메뉴 항목 없음 |

## 8. 운영 확인 API

### `GET /actuator/health`

API와 데이터베이스 연결 상태를 반환한다. 로컬 실행 순서와 E2E 준비 확인에 사용한다.

- 권한: 공개
- 성공: `200 OK`, 비정상이면 `503 SERVICE UNAVAILABLE`

요청: 없음

응답:

| 필드 | 형식 | 설명 |
|---|---|---|
| `status` | string | `UP` 또는 `DOWN` |

## 9. 요구사항 대응

| 요구사항 | API |
|---|---|
| ACC-01, ACC-02, ACC-11 | `POST /api/admin/accounts/sync` |
| ACC-03 | `PUT /api/admin/accounts/{accountId}/roles/{roleCode}` |
| ACC-04 | `DELETE /api/admin/accounts/{accountId}/roles/{roleCode}` |
| ACC-05, ACC-07 | `GET /api/admin/auth/local-accounts`, `POST /api/admin/auth/local-login`, `GET /api/admin/auth/session` |
| ACC-06 | 모든 관리자 API의 역할 검사 (`403 FORBIDDEN`) |
| ACC-08 | `POST /api/admin/auth/logout` |
| ACC-09, ACC-10 | `GET /api/admin/accounts` |
| ACC-12 | `GET /api/admin/accounts/sync-runs/latest` |
| ACC-13 | `local` 외 프로필에서 stub 인증 API 미등록 (`404 NOT_FOUND`) |
| CMS-01, WEB-01, WEB-05 | `GET /api/public/pages/{slug}` |
| CMS-02 | `POST /api/admin/pages` |
| CMS-03, CMS-07 | `PUT /api/admin/pages/{pageId}/draft` |
| CMS-04 | `GET /api/admin/pages/{pageId}/draft/preview` |
| CMS-05, CMS-08 | `POST /api/admin/pages/{pageId}/publish` |
| CMS-06 | `POST /api/admin/pages/{pageId}/unpublish` |
| CMS-09 | `DELETE /api/admin/pages/{pageId}` |
| CMS-10, CMS-11, CMS-13 | `GET /api/admin/pages` |
| CMS-12 | `GET /api/admin/pages/{pageId}` |
| WEB-02 | `GET /api/public/navigation` |
| WEB-03 | `POST /api/admin/navigation/items`, `GET /api/admin/navigation/items` |
| WEB-04 | `DELETE /api/admin/navigation/items/{itemId}` |
| WEB-06 | `POST /api/admin/navigation/items/{itemId}/move` |
