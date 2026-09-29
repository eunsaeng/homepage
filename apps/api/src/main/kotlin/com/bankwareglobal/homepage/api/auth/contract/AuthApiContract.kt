package com.bankwareglobal.homepage.api.auth.contract

/**
 * Path constants and behavior contract of the local account authentication APIs (api-spec §2, §4).
 *
 * Only [LOCAL_ACCOUNTS] and [LOCAL_LOGIN] exist solely under the `local` profile; under any other
 * profile they answer 404 NOT_FOUND. [SESSION] and [LOGOUT] are not profile-gated. Route
 * registration, services and DB access belong to other issues; this object only fixes the contract.
 *
 * ## GET [LOCAL_ACCOUNTS] — list local accounts
 * - 200: [LocalAccountsResponse] `{ items: Account[] }`
 * - 404 NOT_FOUND: the profile is not `local`
 *
 * ## POST [LOCAL_LOGIN] — log in as a local account
 * Request: [LocalLoginRequest] `{ accountId }`; the cookie is `LocalSessionCookie.login(token)`.
 * - 200: [AuthSessionResponse] `{ account, expiresAt }` plus the login `Set-Cookie`
 * - 404 NOT_FOUND: the profile is not `local`
 * - 400 BAD_REQUEST: malformed JSON, missing body or an unknown field
 * - 422 VALIDATION_FAILED: `accountId` violates the 1..120 length constraint
 * - 403 LOGIN_DENIED: the account is unknown, inactive or has no role. One generic message covers
 *   every reason so that callers cannot enumerate accounts.
 *
 * Decision order: 404 -> 400 -> 422 -> 403 LOGIN_DENIED. The first failing step wins.
 *
 * ## GET [SESSION] — read the current session
 * - 200: [AuthSessionResponse], the same shape as the login response
 * - 401 UNAUTHORIZED: no cookie, unknown token, revoked by LOGOUT, or expired
 * - 403 FORBIDDEN: revoked by ROLES_REVOKED or ACCOUNT_DEACTIVATED, or the account is inactive or
 *   has no role
 *
 * Session check order (the first failing step wins):
 * 1. no `local_session` cookie, or the token matches no stored session: 401
 * 2. the session is revoked with `revoke_reason` LOGOUT: 401
 * 3. the session is revoked with `revoke_reason` ROLES_REVOKED or ACCOUNT_DEACTIVATED: 403
 * 4. the session has passed its fixed expiry (8 hours from login, never extended): 401
 * 5. the account is inactive or holds no role: 403
 *
 * ## POST [LOGOUT] — log out
 * - 204: always, whether or not a valid session existed (idempotent); there is no error table. The
 *   response carries the logout `Set-Cookie`, which uses the same Path, HttpOnly and SameSite as
 *   the login cookie.
 *
 * The session token is a secret. It must never be written to any log or error message.
 */
object AuthApiContract {
    const val LOCAL_ACCOUNTS = "/api/admin/auth/local-accounts"
    const val LOCAL_LOGIN = "/api/admin/auth/local-login"
    const val SESSION = "/api/admin/auth/session"
    const val LOGOUT = "/api/admin/auth/logout"
}
