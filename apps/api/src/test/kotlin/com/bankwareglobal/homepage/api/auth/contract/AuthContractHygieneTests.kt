package com.bankwareglobal.homepage.api.auth.contract

import com.bankwareglobal.homepage.api.common.error.ErrorCode
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.http.HttpStatus
import java.nio.file.Files
import java.nio.file.Path

class AuthContractHygieneTests {
    @Test
    fun `paths match the api spec`() {
        assertEquals("/api/admin/auth/local-accounts", AuthApiContract.LOCAL_ACCOUNTS)
        assertEquals("/api/admin/auth/local-login", AuthApiContract.LOCAL_LOGIN)
        assertEquals("/api/admin/auth/session", AuthApiContract.SESSION)
        assertEquals("/api/admin/auth/logout", AuthApiContract.LOGOUT)
    }

    @Test
    fun `error codes used by the contract map to the documented statuses`() {
        assertEquals(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND.status)
        assertEquals(HttpStatus.BAD_REQUEST, ErrorCode.BAD_REQUEST.status)
        assertEquals(HttpStatus.UNPROCESSABLE_CONTENT, ErrorCode.VALIDATION_FAILED.status)
        assertEquals(HttpStatus.FORBIDDEN, ErrorCode.LOGIN_DENIED.status)
        assertEquals(HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHORIZED.status)
    }

    @Test
    fun `contract sources never log or print`() {
        val relative = "src/main/kotlin/com/bankwareglobal/homepage/api/auth/contract"
        val dir = listOf(Path.of(relative), Path.of("apps/api", relative)).first { Files.isDirectory(it) }
        val sources = Files.list(dir).use { stream ->
            stream.filter { it.toString().endsWith(".kt") }.toList()
        }
        assertTrue(sources.isNotEmpty())
        val forbidden = listOf(
            Regex("""\bLoggerFactory\b"""),
            Regex("""\bKotlinLogging\b"""),
            Regex("""\bprintln?\s*\("""),
            Regex("""\b(logger|log|LOG|LOGGER)\s*\.\s*(trace|debug|info|warn|error)\b"""),
        )
        for (source in sources) {
            val text = Files.readString(source)
            for (pattern in forbidden) {
                assertFalse(pattern.containsMatchIn(text), "${source.fileName} matches ${pattern.pattern}")
            }
        }
    }
}
