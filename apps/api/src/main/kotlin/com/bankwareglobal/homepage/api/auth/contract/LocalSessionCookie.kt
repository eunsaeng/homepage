package com.bankwareglobal.homepage.api.auth.contract

import org.springframework.http.ResponseCookie
import java.time.Duration
import java.time.Instant

/**
 * `local_session` cookie contract for the local-only stub authentication.
 *
 * Login sets `local_session=<token>; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800`.
 * Logout expires it with `local_session=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax`.
 * Both cookies come from one builder so Path, HttpOnly and SameSite always match;
 * a browser only removes a cookie whose attributes match the one that was set.
 *
 * The session lifetime is a fixed 8 hours from login and is never extended.
 * The token value is never logged.
 */
object LocalSessionCookie {
    const val NAME = "local_session"
    const val PATH = "/"
    const val SAME_SITE = "Lax"

    val SESSION_TTL: Duration = Duration.ofHours(8)

    fun login(token: String): ResponseCookie = build(token, SESSION_TTL)

    fun logout(): ResponseCookie = build("", Duration.ZERO)

    /** Fixed expiry: login time plus [SESSION_TTL]. */
    fun expiresAt(loginAt: Instant): Instant = loginAt.plus(SESSION_TTL)

    private fun build(value: String, maxAge: Duration): ResponseCookie =
        ResponseCookie.from(NAME, value)
            .httpOnly(true)
            .sameSite(SAME_SITE)
            .path(PATH)
            .maxAge(maxAge)
            .build()
}
