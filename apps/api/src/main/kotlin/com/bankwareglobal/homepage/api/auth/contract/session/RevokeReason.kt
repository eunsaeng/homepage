package com.bankwareglobal.homepage.api.auth.contract.session

/** Why a session was revoked. Mirrors the `admin_session.revoke_reason` CHECK constraint. */
enum class RevokeReason {
    LOGOUT,
    ROLES_REVOKED,
    ACCOUNT_DEACTIVATED,
}
