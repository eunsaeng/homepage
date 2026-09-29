package com.bankwareglobal.homepage.api.auth.contract

/**
 * Response body shared by the local login response and `GET /api/admin/auth/session`.
 * `expiresAt` is the fixed UTC ISO-8601 expiry of the session.
 */
data class AuthSessionResponse(
    val account: Account,
    val expiresAt: String,
)
