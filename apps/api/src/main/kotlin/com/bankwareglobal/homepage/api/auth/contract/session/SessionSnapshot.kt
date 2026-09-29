package com.bankwareglobal.homepage.api.auth.contract.session

import java.time.Instant

/**
 * Session state read by the caller before it asks [SessionDecisionRule] for a decision.
 * A missing cookie and an unknown token are both represented by passing a null snapshot to the rule.
 */
data class SessionSnapshot(
    val revokeReason: RevokeReason?,
    val expiresAt: Instant,
    val accountActive: Boolean,
    val roles: Set<String>,
)
