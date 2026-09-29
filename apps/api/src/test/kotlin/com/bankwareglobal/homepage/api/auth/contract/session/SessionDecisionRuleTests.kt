package com.bankwareglobal.homepage.api.auth.contract.session

import com.bankwareglobal.homepage.api.common.error.ErrorCode
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.DynamicTest.dynamicTest
import org.junit.jupiter.api.TestFactory
import java.time.Instant

class SessionDecisionRuleTests {
    private val now = Instant.parse("2026-09-29T12:00:00Z")
    private val future = now.plusSeconds(3600)
    private val past = now.minusSeconds(3600)
    private val editor = setOf("CONTENT_EDITOR")

    private fun snapshot(
        revokeReason: RevokeReason? = null,
        expiresAt: Instant = future,
        accountActive: Boolean = true,
        roles: Set<String> = editor,
    ) = SessionSnapshot(revokeReason, expiresAt, accountActive, roles)

    private class Case(
        val name: String,
        val snapshot: SessionSnapshot?,
        val requiredRoles: Set<String>,
        val expected: SessionDecision,
    )

    private fun denied(code: ErrorCode): SessionDecision = SessionDecision.Denied(code)

    private fun case(
        name: String,
        snapshot: SessionSnapshot?,
        expected: SessionDecision,
        requiredRoles: Set<String> = emptySet(),
    ) = Case(name, snapshot, requiredRoles, expected)

    @TestFactory
    fun `decision table`(): List<DynamicTest> {
        val cases =
            listOf(
                // Spec 7-5
                case("no cookie -> 401", null, denied(ErrorCode.UNAUTHORIZED)),
                case("unknown token -> 401", null, denied(ErrorCode.UNAUTHORIZED)),
                case("LOGOUT revoked -> 401", snapshot(revokeReason = RevokeReason.LOGOUT), denied(ErrorCode.UNAUTHORIZED)),
                case("expired -> 401", snapshot(expiresAt = past), denied(ErrorCode.UNAUTHORIZED)),
                case("ROLES_REVOKED -> 403", snapshot(revokeReason = RevokeReason.ROLES_REVOKED), denied(ErrorCode.FORBIDDEN)),
                case(
                    "ACCOUNT_DEACTIVATED -> 403",
                    snapshot(revokeReason = RevokeReason.ACCOUNT_DEACTIVATED),
                    denied(ErrorCode.FORBIDDEN),
                ),
                case(
                    "ROLES_REVOKED + expired -> 403 (revocation before expiry)",
                    snapshot(revokeReason = RevokeReason.ROLES_REVOKED, expiresAt = past),
                    denied(ErrorCode.FORBIDDEN),
                ),
                case("not revoked but inactive -> 403", snapshot(accountActive = false), denied(ErrorCode.FORBIDDEN)),
                // Boundaries and order
                case("expiresAt == now -> 401", snapshot(expiresAt = now), denied(ErrorCode.UNAUTHORIZED)),
                case("expiresAt == now + 1ns -> allowed", snapshot(expiresAt = now.plusNanos(1)), SessionDecision.Allowed),
                case(
                    "LOGOUT + expired -> 401",
                    snapshot(revokeReason = RevokeReason.LOGOUT, expiresAt = past),
                    denied(ErrorCode.UNAUTHORIZED),
                ),
                case(
                    "ACCOUNT_DEACTIVATED + expired -> 403",
                    snapshot(revokeReason = RevokeReason.ACCOUNT_DEACTIVATED, expiresAt = past),
                    denied(ErrorCode.FORBIDDEN),
                ),
                case(
                    "expired + inactive -> 401 (expiry before active check)",
                    snapshot(expiresAt = past, accountActive = false),
                    denied(ErrorCode.UNAUTHORIZED),
                ),
                case("zero roles -> 403", snapshot(roles = emptySet()), denied(ErrorCode.FORBIDDEN)),
                // Required roles
                case("valid session, no required roles -> allowed", snapshot(), SessionDecision.Allowed),
                case(
                    "missing required role -> 403",
                    snapshot(),
                    denied(ErrorCode.FORBIDDEN),
                    requiredRoles = setOf("PUBLISHER"),
                ),
                case(
                    "matching required role -> allowed",
                    snapshot(),
                    SessionDecision.Allowed,
                    requiredRoles = setOf("PUBLISHER", "CONTENT_EDITOR"),
                ),
                case(
                    "required role but expired -> 401 (expiry before role check)",
                    snapshot(expiresAt = past),
                    denied(ErrorCode.UNAUTHORIZED),
                    requiredRoles = setOf("PUBLISHER"),
                ),
            )

        return cases.map { c ->
            dynamicTest(c.name) {
                assertEquals(c.expected, SessionDecisionRule.decide(c.snapshot, now, c.requiredRoles))
            }
        }
    }
}
