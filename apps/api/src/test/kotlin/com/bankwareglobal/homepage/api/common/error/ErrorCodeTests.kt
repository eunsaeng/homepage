package com.bankwareglobal.homepage.api.common.error

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class ErrorCodeTests {
    @Test
    fun `defines exactly the seven codes with their statuses`() {
        val actual = ErrorCode.entries.associate { it.name to it.status.value() }
        assertEquals(
            mapOf(
                "BAD_REQUEST" to 400,
                "UNAUTHORIZED" to 401,
                "FORBIDDEN" to 403,
                "LOGIN_DENIED" to 403,
                "NOT_FOUND" to 404,
                "VALIDATION_FAILED" to 422,
                "INTERNAL_ERROR" to 500,
            ),
            actual,
        )
    }

    @Test
    fun `default messages are Korean and non-blank`() {
        ErrorCode.entries.forEach { code ->
            assertTrue(code.defaultMessage.isNotBlank())
            assertTrue(code.defaultMessage.any { it in '가'..'힣' }, "${code.name} message must be Korean")
        }
    }

    @Test
    fun `LOGIN_DENIED is 403 and distinct from FORBIDDEN`() {
        assertEquals(403, ErrorCode.LOGIN_DENIED.status.value())
        assertNotEquals(ErrorCode.FORBIDDEN, ErrorCode.LOGIN_DENIED)
        assertNotEquals(ErrorCode.FORBIDDEN.defaultMessage, ErrorCode.LOGIN_DENIED.defaultMessage)
    }
}
