package com.bankwareglobal.homepage.api.auth.contract

import java.time.Instant
import java.time.format.DateTimeFormatter

/**
 * Account shape shared by `GET /api/admin/auth/local-accounts` and the session responses.
 *
 * `roles` is ordered by `app_role.sort_order` and is `[]` when the account has no role.
 * `syncedAt` is a UTC ISO-8601 string; build it with [toContractTimestamp].
 */
data class Account(
    val accountId: String,
    val displayName: String,
    val email: String,
    val active: Boolean,
    val roles: List<AccountRole> = emptyList(),
    val syncedAt: String,
)

/** Formats an instant as a UTC ISO-8601 string such as `2026-01-01T00:00:00Z`. */
fun Instant.toContractTimestamp(): String = DateTimeFormatter.ISO_INSTANT.format(this)
