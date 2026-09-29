package com.bankwareglobal.homepage.api.auth.contract.session

import com.bankwareglobal.homepage.api.common.error.ErrorCode
import java.time.Instant

/**
 * Pure session decision rule (no DB, no I/O). The first matching condition decides the response:
 *
 * 1. No cookie or unknown token (null snapshot) -> 401 `UNAUTHORIZED`
 * 2. Revoked: `LOGOUT` -> 401; `ROLES_REVOKED` or `ACCOUNT_DEACTIVATED` -> 403 `FORBIDDEN`
 * 3. `expiresAt <= now` -> 401
 * 4. Account inactive or no roles -> 403
 * 5. Required roles given and none held -> 403; skipped when no role is required (`GET /session`)
 *
 * Revocation is checked before expiry on purpose. If expiry came first, a user blocked by
 * `ROLES_REVOKED` or `ACCOUNT_DEACTIVATED` would get 401 once the session expired, and admin
 * would wrongly show a "log in again" prompt instead of a permission error.
 *
 * `POST /api/admin/auth/logout` must not use this rule; it is idempotent and always returns 204.
 *
 * Out of scope here: the DB lookup that builds the [SessionSnapshot] and the `last_seen_at`
 * update. Both belong to the follow-up implementation request.
 */
object SessionDecisionRule {
    fun decide(
        snapshot: SessionSnapshot?,
        now: Instant,
        requiredRoles: Set<String> = emptySet(),
    ): SessionDecision {
        if (snapshot == null) return deny(ErrorCode.UNAUTHORIZED)

        snapshot.revokeReason?.let { reason ->
            return when (reason) {
                RevokeReason.LOGOUT -> deny(ErrorCode.UNAUTHORIZED)
                RevokeReason.ROLES_REVOKED,
                RevokeReason.ACCOUNT_DEACTIVATED,
                -> deny(ErrorCode.FORBIDDEN)
            }
        }

        if (!snapshot.expiresAt.isAfter(now)) return deny(ErrorCode.UNAUTHORIZED)

        if (!snapshot.accountActive || snapshot.roles.isEmpty()) return deny(ErrorCode.FORBIDDEN)

        if (requiredRoles.isNotEmpty() && snapshot.roles.none { it in requiredRoles }) {
            return deny(ErrorCode.FORBIDDEN)
        }

        return SessionDecision.Allowed
    }

    private fun deny(errorCode: ErrorCode): SessionDecision = SessionDecision.Denied(errorCode)
}
