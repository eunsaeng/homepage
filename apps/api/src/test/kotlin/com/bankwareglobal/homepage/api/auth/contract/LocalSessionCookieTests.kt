package com.bankwareglobal.homepage.api.auth.contract

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.time.Duration
import java.time.Instant

class LocalSessionCookieTests {
    @Test
    fun `login cookie carries the token with 8h max age`() {
        val cookie = LocalSessionCookie.login("abc")
        assertEquals("local_session", cookie.name)
        assertEquals("abc", cookie.value)
        assertEquals(Duration.ofSeconds(28800), cookie.maxAge)
        assertTrue(cookie.isHttpOnly)
        assertEquals("Lax", cookie.sameSite)
        assertEquals("/", cookie.path)
    }

    @Test
    fun `logout cookie is empty with zero max age`() {
        val cookie = LocalSessionCookie.logout()
        assertEquals("local_session", cookie.name)
        assertEquals("", cookie.value)
        assertEquals(Duration.ZERO, cookie.maxAge)
    }

    @Test
    fun `login and logout cookies share Path HttpOnly and SameSite`() {
        val login = LocalSessionCookie.login("abc")
        val logout = LocalSessionCookie.logout()
        assertEquals(login.path, logout.path)
        assertEquals(login.isHttpOnly, logout.isHttpOnly)
        assertEquals(login.sameSite, logout.sameSite)
    }

    @Test
    fun `serialized headers contain the contract attributes`() {
        val login = LocalSessionCookie.login("abc").toString()
        assertTrue(login.contains("local_session=abc"))
        assertTrue(login.contains("Max-Age=28800"))
        assertTrue(login.contains("Path=/"))
        assertTrue(login.contains("HttpOnly"))
        assertTrue(login.contains("SameSite=Lax"))

        val logout = LocalSessionCookie.logout().toString()
        assertTrue(logout.contains("local_session=;"))
        assertTrue(logout.contains("Max-Age=0"))
        assertTrue(logout.contains("Path=/"))
        assertTrue(logout.contains("HttpOnly"))
        assertTrue(logout.contains("SameSite=Lax"))
    }

    @Test
    fun `expiry is fixed at login time plus 8 hours`() {
        val loginAt = Instant.parse("2026-01-01T00:00:00Z")
        assertEquals(Instant.parse("2026-01-01T08:00:00Z"), LocalSessionCookie.expiresAt(loginAt))
        assertEquals(Duration.ofHours(8), LocalSessionCookie.SESSION_TTL)
    }
}
