package com.bankwareglobal.homepage.api.auth.contract

import com.fasterxml.jackson.databind.DeserializationFeature
import com.fasterxml.jackson.databind.JsonMappingException
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import jakarta.validation.Validation
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows

class LocalLoginRequestDeserializationTests {
    private val lenientMapper: ObjectMapper = jacksonObjectMapper()
        .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)

    private val validator = Validation.buildDefaultValidatorFactory().validator

    @Test
    fun `reads accountId`() {
        val request = lenientMapper.readValue<LocalLoginRequest>("""{"accountId":"acc-1"}""")

        assertEquals("acc-1", request.accountId)
    }

    @Test
    fun `unknown field fails deserialization even when unknown properties are tolerated`() {
        val error = assertThrows<JsonMappingException> {
            lenientMapper.readValue<LocalLoginRequest>("""{"accountId":"acc-1","role":"PUBLISHER"}""")
        }
        assertTrue(error.message.orEmpty().contains("role"))
    }

    @Test
    fun `missing or null accountId deserializes and then fails validation`() {
        listOf("{}", """{"accountId":null}""").forEach { json ->
            val request = lenientMapper.readValue<LocalLoginRequest>(json)

            assertNull(request.accountId)
            assertEquals(1, validator.validate(request).size)
        }
    }

    @Test
    fun `length constants are 1 and 120`() {
        assertEquals(1, ACCOUNT_ID_MIN_LENGTH)
        assertEquals(120, ACCOUNT_ID_MAX_LENGTH)
    }

    @Test
    fun `accountId within 1 to 120 characters is valid`() {
        assertTrue(validator.validate(LocalLoginRequest("a")).isEmpty())
        assertTrue(validator.validate(LocalLoginRequest("a".repeat(120))).isEmpty())
    }

    @Test
    fun `empty or over-long accountId is invalid`() {
        assertEquals(1, validator.validate(LocalLoginRequest("")).size)
        assertEquals(1, validator.validate(LocalLoginRequest("a".repeat(121))).size)
    }
}
