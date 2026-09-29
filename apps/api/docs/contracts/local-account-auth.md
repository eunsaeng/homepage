# 로컬 계정 인증 API 계약

후속 구현 요청, admin 로그인 화면, e2e가 참조하는 단일 계약 문서다. `wiki/api-spec.md` §1·§2·§4를 그대로 옮긴 것이며 새 규칙을 추가하지 않는다. 문서와 코드 상수가 다르면 코드 상수를 고치지 말고 이 문서와 api-spec 중 어느 쪽이 맞는지 먼저 확인한다.

## 1. 출처와 코드 상수

| 항목 | 위치 |
|---|---|
| 경로 상수 | `auth.contract.AuthApiContract` (`LOCAL_ACCOUNTS`, `LOCAL_LOGIN`, `SESSION`, `LOGOUT`) |
| 쿠키 | `auth.contract.LocalSessionCookie` (`login(token)`, `logout()`, `SESSION_TTL`, `expiresAt`) |
| 요청/응답 타입 | `Account`, `AccountRole`, `LocalAccountsResponse`, `LocalLoginRequest`, `AuthSessionResponse` |
| 오류 코드 | `common.error.ErrorCode`, `ErrorResponse` |
| 세션 판정 | `auth.contract.session.SessionDecisionRule` |

## 2. 공통 규칙

### 쿠키

- 이름은 `local_session`이다. 값은 서버가 발급한 불투명 토큰이다.
- 로그인 응답: `Set-Cookie: local_session=<token>; Max-Age=28800; Path=/; HttpOnly; SameSite=Lax`
- 로그아웃 응답: `Set-Cookie: local_session=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax`
- 쿠키 속성의 순서는 의미가 없다. 위 문자열은 api-spec 표기 순서를 그대로 옮긴 것이고, 검증은 속성 집합으로 한다.
- 두 쿠키는 한 빌더(`LocalSessionCookie`)에서 만들어 Path, HttpOnly, SameSite가 항상 같다. 브라우저는 속성이 같은 쿠키만 지운다.

### 만료

- 세션 수명은 로그인 시각부터 8시간 고정이다(`expiresAt = 로그인 시각 + 8h`).
- 만료는 연장하지 않는다. `GET /session`이 `last_seen_at`을 갱신해도 `expiresAt`은 그대로다.

### 시각

- 응답의 모든 시각은 UTC ISO-8601 문자열이다. 예: `2026-01-01T00:00:00Z`.

### CORS

- `http://localhost:3000`, `http://localhost:3001`만 허용하고 credentials를 포함한다.

## 3. 데이터 형식

### Account

```json
{
  "accountId": "string",
  "displayName": "string",
  "email": "string",
  "active": true,
  "roles": ["ROLE_MANAGER", "CONTENT_EDITOR", "PUBLISHER"],
  "syncedAt": "2026-01-01T00:00:00Z"
}
```

- `roles`는 `app_role.sort_order` 순서로 정렬한다. 역할이 없으면 `[]`이다.
- 역할 값은 `ROLE_MANAGER`, `CONTENT_EDITOR`, `PUBLISHER` 중 하나다.

### AuthSessionResponse

```json
{ "account": { "...Account" }, "expiresAt": "2026-01-01T08:00:00Z" }
```

### 오류 응답

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "입력값이 올바르지 않습니다.",
    "fields": [{ "name": "accountId", "reason": "..." }],
    "traceId": "string"
  }
}
```

`fields`는 검증 오류가 아니면 `[]`다.

| code | HTTP | 기본 메시지 |
|---|---|---|
| `BAD_REQUEST` | 400 | 잘못된 요청입니다. |
| `UNAUTHORIZED` | 401 | 로그인이 필요합니다. |
| `FORBIDDEN` | 403 | 이 작업을 수행할 권한이 없습니다. |
| `LOGIN_DENIED` | 403 | 로그인할 수 없습니다. 관리자에게 문의해 주세요. |
| `NOT_FOUND` | 404 | 요청한 대상을 찾을 수 없습니다. |
| `VALIDATION_FAILED` | 422 | 입력값이 올바르지 않습니다. |
| `INTERNAL_ERROR` | 500 | 서버 오류가 발생했습니다. |

## 4. API

### 4.1 `GET /api/admin/auth/local-accounts`

- 권한: 없음(로그인 전 화면에서 호출). `local` 프로필에서만 존재한다.
- 요청: 없음
- 응답 200: `{ "items": Account[] }`
- 범위: 동기화된 계정 중 `identity_provider='STUB'`인 전체 계정이다. `DAOU_OFFICE` 등 STUB이 아닌 계정은 목록에 넣지 않는다. `accountId` 오름차순으로 정렬한다.
- 비활성 계정과 역할이 없는 계정도 포함한다(`active: false`, `roles: []`).
- `local_session` 쿠키가 있어도 보지 않는다.

| HTTP | code | 조건 |
|---|---|---|
| 404 | `NOT_FOUND` | 프로필이 `local`이 아님 |

부수 효과: 없음.

### 4.2 `POST /api/admin/auth/local-login`

- 권한: 없음. `local` 프로필에서만 존재한다.
- 요청: `{ "accountId": "string" }`. `accountId`는 1~120자다. 다른 필드가 있으면 거부한다.
- 응답 200: `AuthSessionResponse` + 로그인 `Set-Cookie`

| HTTP | code | 조건 |
|---|---|---|
| 404 | `NOT_FOUND` | 프로필이 `local`이 아님 |
| 400 | `BAD_REQUEST` | JSON 형식 오류, body 없음, 알 수 없는 필드 |
| 422 | `VALIDATION_FAILED` | `accountId`가 없거나 null이거나 1~120자를 벗어남 |
| 403 | `LOGIN_DENIED` | 계정이 없거나, 비활성이거나, 역할이 없음 |

- 422 응답의 `fields`는 `[{ "name": "accountId", "reason": "..." }]`이다.
- 로그인 허용 조건: 동기화된 계정 중 `identity_provider='STUB'`인 계정이 있고, 활성이며, 역할이 하나 이상이다. 동기화된 계정이 STUB이 아니면(`DAOU_OFFICE` 등) 403 `LOGIN_DENIED`다. 따라서 200 응답의 계정은 항상 활성이고 `roles`가 비어 있지 않다.
- 로그인은 항상 새 세션을 발급한다. 요청에 실린 기존 `local_session` 쿠키는 보지 않고 그 세션을 폐기하지도 않는다.
- 저장되는 `admin_session` 행: 토큰 SHA-256 해시, 계정 ID, `expires_at`(로그인 시각 + 8h), `last_seen_at`. `revoked_at`과 `revoke_reason`은 비어 있다.

- 판정 순서: 404 → 400 → 422 → 403. 처음 실패한 단계의 응답을 돌려준다.
- `LOGIN_DENIED`는 이유와 상관없이 같은 코드와 같은 메시지를 쓴다. 호출자가 계정을 열거할 수 없게 하기 위해서다.
- 부수 효과: 세션 행을 새로 만들고 토큰의 SHA-256 해시만 저장한다. 응답에 로그인 쿠키를 싣는다. 실패 시에는 세션도 쿠키도 만들지 않는다.

### 4.3 `GET /api/admin/auth/session`

- 권한: 유효한 `local_session` 쿠키. 특정 역할은 요구하지 않는다.
- 요청: `local_session` 쿠키
- 응답 200: `AuthSessionResponse` (로그인 응답과 같은 형태). `expiresAt`은 로그인 때 정한 값이다.

| HTTP | code | 조건 |
|---|---|---|
| 401 | `UNAUTHORIZED` | 쿠키 없음, 알 수 없는 토큰, `LOGOUT`으로 폐기됨, 만료됨 |
| 403 | `FORBIDDEN` | `ROLES_REVOKED` 또는 `ACCOUNT_DEACTIVATED`로 폐기됨, 계정 비활성, 역할 없음 |

- 부수 효과: 200일 때 `last_seen_at`을 갱신한다. `expiresAt`은 바꾸지 않는다.
- 응답의 `roles`는 조회 시점의 현재 역할이다. 로그인 때의 역할을 저장해 두었다가 돌려주지 않는다.
- 이 API는 프로필로 막지 않는다.

### 4.4 `POST /api/admin/auth/logout`

- 권한: 없음. 유효한 세션이 없어도 호출할 수 있다.
- 요청: 없음. `local_session` 쿠키가 있으면 사용한다.
- 응답: **항상 204**. 로그아웃 `Set-Cookie`(`Max-Age=0`)를 싣는다.
- 오류 표는 없다. 세션이 없거나, 알 수 없는 토큰이거나, 이미 폐기·만료된 경우에도 204다(멱등).
- 부수 효과: 폐기되지 않았고 만료되지 않은 세션만 `revoked_at`을 기록하고 `revoke_reason`을 `LOGOUT`으로 남긴다. 이미 폐기된 세션의 `revoke_reason`은 덮어쓰지 않고 그대로 둔다. 만료된 세션은 기록하지 않아도 된다.
- "logout 후 401"은 같은 토큰으로 이후에 호출하는 `GET /session` 등에 해당한다. logout 자신은 항상 204다.
- 이 API는 프로필로 막지 않고, 세션 판정 규칙(4.5)을 쓰지 않는다.

### 4.5 세션 판정 순서

`GET /session`과 이후 관리자 API가 같은 순서를 쓴다. 처음 맞는 조건이 응답을 결정한다.

1. 쿠키가 없거나 토큰이 저장된 세션과 맞지 않음 → 401 `UNAUTHORIZED`
2. 폐기됨: `LOGOUT` → 401, `ROLES_REVOKED`·`ACCOUNT_DEACTIVATED` → 403 `FORBIDDEN`
3. `expiresAt <= now` → 401
4. 계정이 비활성이거나 역할이 없음 → 403
5. 필요한 역할이 지정됐는데 하나도 없음 → 403 (`GET /session`은 역할을 요구하지 않으므로 건너뜀)

폐기 여부를 만료보다 먼저 본다. 만료를 먼저 보면 `ROLES_REVOKED`나 `ACCOUNT_DEACTIVATED`로 막힌 사용자가 만료 후 401을 받아 권한 오류 대신 "다시 로그인" 안내가 뜬다.

| # | 상태 | 결과 |
|---|---|---|
| 1 | 쿠키 없음 | 401 `UNAUTHORIZED` |
| 2 | 알 수 없는 토큰 | 401 `UNAUTHORIZED` |
| 3 | `LOGOUT`으로 폐기 | 401 `UNAUTHORIZED` |
| 4 | `ROLES_REVOKED`로 폐기 | 403 `FORBIDDEN` |
| 5 | `ACCOUNT_DEACTIVATED`로 폐기 | 403 `FORBIDDEN` |
| 6 | 폐기 안 됨, 만료됨 | 401 `UNAUTHORIZED` |
| 7 | 폐기 안 됨, 만료 전, 계정 비활성 또는 역할 없음 | 403 `FORBIDDEN` |
| 8 | 폐기 안 됨, 만료 전, 활성 계정, 역할 있음 | 200 |
| 9 | `ROLES_REVOKED`로 폐기 + 만료됨 | 403 `FORBIDDEN` |
| 10 | `ACCOUNT_DEACTIVATED`로 폐기 + 만료됨 | 403 `FORBIDDEN` |
| 11 | `LOGOUT`으로 폐기 + 만료됨 | 401 `UNAUTHORIZED` |

폐기됨과 만료가 함께 걸리면 폐기 결과가 이긴다(예: `ROLES_REVOKED` + 만료 → 403).

## 5. 프로필 게이팅

| API | `local` | `local` 외 |
|---|---|---|
| `GET /local-accounts` | 사용 가능 | 404 `NOT_FOUND` |
| `POST /local-login` | 사용 가능 | 404 `NOT_FOUND` |
| `GET /session` | 사용 가능 | 게이팅하지 않음 |
| `POST /logout` | 사용 가능 | 게이팅하지 않음 |

api-spec §1은 `local-accounts`와 `local-login`만 `local` 전용으로 명시한다. 따라서 `session`과 `logout`은 프로필로 막지 않는다.

## 6. 보안 규칙

- 토큰은 SHA-256 해시만 DB에 저장한다. 원문은 저장하지 않는다.
- 토큰 원문은 로그, 오류 메시지, 응답 body 어디에도 쓰지 않는다.
- 로그인 거부는 `LOGIN_DENIED` 단일 코드와 단일 메시지만 쓴다. 계정 없음, 비활성, 역할 없음을 구분해 알리지 않는다.
- 쿠키는 `HttpOnly`, `SameSite=Lax`, `Path=/`다.

## 7. 수용 기준과 테스트

계약 테스트는 `auth.contract.http` 패키지에 있고, 구현 전에는 `@Disabled("request-apps-local-account-auth.md에서 구현")` 상태다. 구현 요청에서 비활성화를 풀고 채운다.

| 테스트 클래스 | 대상 |
|---|---|
| `LocalAccountsContractTests` | 4.1 |
| `LocalLoginContractTests` | 4.2 |
| `SessionContractTests` | 4.3, 4.5 |
| `LogoutContractTests` | 4.4 |
| `NonLocalProfileGatingContractTests` | 5 (`stg` 프로필) |
