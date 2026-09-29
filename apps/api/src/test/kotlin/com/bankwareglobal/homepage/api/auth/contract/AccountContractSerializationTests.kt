package com.bankwareglobal.homepage.api.auth.contract

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.time.Instant

class AccountContractSerializationTests {
    private val mapper: ObjectMapper = jacksonObjectMapper()

    private fun toTree(value: Any): JsonNode = mapper.readTree(mapper.writeValueAsString(value))

    private fun names(node: JsonNode): Set<String> = node.fieldNames().asSequence().toSet()

    private val syncedAt = Instant.parse("2026-01-02T03:04:05Z")

    private fun account(roles: List<AccountRole> = emptyList()) = Account(
        accountId = "acc-1",
        displayName = "Kim",
        email = "kim@example.com",
        active = true,
        roles = roles,
        syncedAt = syncedAt.toContractTimestamp(),
    )

    @Test
    fun `account serializes exactly the api-spec fields`() {
        val root = toTree(account(listOf(AccountRole.ROLE_MANAGER, AccountRole.PUBLISHER)))

        assertEquals(setOf("accountId", "displayName", "email", "active", "roles", "syncedAt"), names(root))
        assertTrue(root["active"].isBoolean)
        assertEquals("ROLE_MANAGER", root["roles"][0].asText())
        assertEquals("PUBLISHER", root["roles"][1].asText())
    }

    @Test
    fun `roles default to an empty array`() {
        val root = toTree(Account("a", "n", "e@x.com", false, syncedAt = "2026-01-01T00:00:00Z"))

        assertTrue(root["roles"].isArray)
        assertEquals(0, root["roles"].size())
    }

    @Test
    fun `syncedAt is UTC ISO-8601`() {
        assertEquals("2026-01-02T03:04:05Z", toTree(account())["syncedAt"].asText())
    }

    @Test
    fun `accounts response wraps items`() {
        val root = toTree(LocalAccountsResponse(listOf(account())))

        assertEquals(setOf("items"), names(root))
        assertEquals(1, root["items"].size())
        assertEquals("acc-1", root["items"][0]["accountId"].asText())
    }

    @Test
    fun `session response carries account and expiresAt`() {
        val root = toTree(AuthSessionResponse(account(), "2026-01-02T11:04:05Z"))

        assertEquals(setOf("account", "expiresAt"), names(root))
        assertEquals("2026-01-02T11:04:05Z", root["expiresAt"].asText())
        assertEquals("acc-1", root["account"]["accountId"].asText())
    }
}
