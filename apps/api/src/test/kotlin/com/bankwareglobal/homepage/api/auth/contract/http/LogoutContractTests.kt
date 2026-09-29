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

/** Contract skeleton for `POST /api/admin/auth/logout`, which always answers 204. */
@Disabled("request-apps-local-account-auth.md에서 구현")
@SpringBootTest
class LogoutContractTests {
    @Autowired
    private lateinit var context: ApplicationContext

    private lateinit var client: WebTestClient

    @BeforeEach
    fun setUp() {
        client = WebTestClient.bindToApplicationContext(context).configureClient().baseUrl("http://localhost:8080").build()
    }

    private val path = AuthApiContract.LOGOUT
    private val cookieName = LocalSessionCookie.NAME

    @Disabled("request-apps-local-account-auth.md에서 구현")
    @Test
    fun `valid session logs out with 204 and logout Set-Cookie and revokes with LOGOUT`() {
    }

    @Disabled("request-apps-local-account-auth.md에서 구현")
    @Test
    fun `without a cookie returns 204 with logout Set-Cookie`() {
    }

    @Disabled("request-apps-local-account-auth.md에서 구현")
    @Test
    fun `unknown token returns 204`() {
    }

    @Disabled("request-apps-local-account-auth.md에서 구현")
    @Test
    fun `already revoked session returns 204 and keeps its revoke reason`() {
    }

    @Disabled("request-apps-local-account-auth.md에서 구현")
    @Test
    fun `logout cookie attributes match the login cookie`() {
    }

    @Disabled("request-apps-local-account-auth.md에서 구현")
    @Test
    fun `session after logout returns 401 UNAUTHORIZED`() {
    }
}
