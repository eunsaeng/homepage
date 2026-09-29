package com.bankwareglobal.homepage.api.auth.contract.http

import com.bankwareglobal.homepage.api.auth.contract.AuthApiContract
import com.bankwareglobal.homepage.api.auth.contract.LocalSessionCookie
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Disabled
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.ApplicationContext
import org.springframework.test.web.reactive.server.WebTestClient

/** Contract skeleton for `GET /api/admin/auth/session` and its decision order. */
@Disabled("request-apps-local-account-auth.md에서 구현")
@SpringBootTest
class SessionContractTests {
    @Autowired
    private lateinit var context: ApplicationContext

    private lateinit var client: WebTestClient

    @BeforeEach
    fun setUp() {
        client = WebTestClient.bindToApplicationContext(context).configureClient().baseUrl("http://localhost:8080").build()
    }

    private val path = AuthApiContract.SESSION
    private val cookieName = LocalSessionCookie.NAME

    @Disabled("request-apps-local-account-auth.md에서 구현")
    @Test
    fun `valid session returns 200 with account and unchanged expiresAt`() {
    }

    @Disabled("request-apps-local-account-auth.md에서 구현")
    @Test
    fun `valid session updates last_seen_at without extending expiry`() {
    }

    @Disabled("request-apps-local-account-auth.md에서 구현")
    @Test
    fun `missing cookie returns 401 UNAUTHORIZED`() {
    }

    @Disabled("request-apps-local-account-auth.md에서 구현")
    @Test
    fun `unknown token returns 401 UNAUTHORIZED`() {
    }

    @Disabled("request-apps-local-account-auth.md에서 구현")
    @Test
    fun `session revoked by LOGOUT returns 401 UNAUTHORIZED`() {
    }

    @Disabled("request-apps-local-account-auth.md에서 구현")
    @Test
    fun `session revoked by ROLES_REVOKED returns 403 FORBIDDEN`() {
    }

    @Disabled("request-apps-local-account-auth.md에서 구현")
    @Test
    fun `session revoked by ACCOUNT_DEACTIVATED returns 403 FORBIDDEN`() {
    }

    @Disabled("request-apps-local-account-auth.md에서 구현")
    @Test
    fun `expired session returns 401 UNAUTHORIZED`() {
    }

    @Disabled("request-apps-local-account-auth.md에서 구현")
    @Test
    fun `unrevoked session with inactive account returns 403 FORBIDDEN`() {
    }

    @Disabled("request-apps-local-account-auth.md에서 구현")
    @Test
    fun `unrevoked session with account without a role returns 403 FORBIDDEN`() {
    }

    @Disabled("request-apps-local-account-auth.md에서 구현")
    @Test
    fun `ROLES_REVOKED revoked and expired session returns 403 FORBIDDEN`() {
    }

    @Disabled("request-apps-local-account-auth.md에서 구현")
    @Test
    fun `ACCOUNT_DEACTIVATED revoked and expired session returns 403 FORBIDDEN`() {
    }

    @Disabled("request-apps-local-account-auth.md에서 구현")
    @Test
    fun `LOGOUT revoked and expired session returns 401 UNAUTHORIZED`() {
    }

    @Disabled("request-apps-local-account-auth.md에서 구현")
    @Test
    fun `session roles reflect roles at query time`() {
    }

    @Disabled("request-apps-local-account-auth.md에서 구현")
    @Test
    fun `401 and 403 responses use error envelope with code, message, empty fields and traceId`() {
    }

    @Disabled("request-apps-local-account-auth.md에서 구현")
    @Test
    fun `401 and 403 error messages are Korean`() {
    }
}
