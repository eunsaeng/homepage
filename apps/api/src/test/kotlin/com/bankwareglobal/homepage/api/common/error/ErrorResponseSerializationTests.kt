package com.bankwareglobal.homepage.api.common.error

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class ErrorResponseSerializationTests {
    private val mapper: ObjectMapper = jacksonObjectMapper()

    private fun toTree(response: ErrorResponse) = mapper.readTree(mapper.writeValueAsString(response))

    @Test
    fun `serializes to the common error shape with an empty fields array`() {
        val root = toTree(ErrorResponse.of(ErrorCode.UNAUTHORIZED, "trace-1"))

        assertEquals(setOf("error"), root.fieldNames().asSequence().toSet())
        val error = root["error"]
        assertEquals(setOf("code", "message", "fields", "traceId"), error.fieldNames().asSequence().toSet())
        assertEquals("UNAUTHORIZED", error["code"].asText())
        assertEquals(ErrorCode.UNAUTHORIZED.defaultMessage, error["message"].asText())
        assertEquals("trace-1", error["traceId"].asText())
        assertTrue(error["fields"].isArray)
        assertEquals(0, error["fields"].size())
    }

    @Test
    fun `serializes field validation errors`() {
        val response = ErrorResponse.of(
            ErrorCode.VALIDATION_FAILED,
            "trace-2",
            fields = listOf(FieldError("loginId", "필수 값입니다.")),
        )
        val fields = toTree(response)["error"]["fields"]

        assertEquals(1, fields.size())
        assertEquals(setOf("name", "reason"), fields[0].fieldNames().asSequence().toSet())
        assertEquals("loginId", fields[0]["name"].asText())
        assertEquals("필수 값입니다.", fields[0]["reason"].asText())
        assertEquals("VALIDATION_FAILED", toTree(response)["error"]["code"].asText())
    }

    @Test
    fun `LOGIN_DENIED carries one generic message`() {
        val error = toTree(ErrorResponse.of(ErrorCode.LOGIN_DENIED, "trace-3"))["error"]

        assertEquals("LOGIN_DENIED", error["code"].asText())
        assertEquals(ErrorCode.LOGIN_DENIED.defaultMessage, error["message"].asText())
        assertEquals(0, error["fields"].size())
        assertFalse(error["message"].asText().isBlank())
    }
}
