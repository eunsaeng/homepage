package com.bankwareglobal.homepage.api.auth.contract.http

import com.bankwareglobal.homepage.api.auth.contract.AuthApiContract
import com.bankwareglobal.homepage.api.auth.contract.LocalSessionCookie
import com.bankwareglobal.homepage.api.common.error.ErrorCode
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Disabled
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.ApplicationContext
import org.springframework.test.web.reactive.server.WebTestClient

/** Contract skeleton for `POST /api/admin/auth/local-login` (local profile). */
@Disabled("request-apps-local-account-auth.md에서 구현")
@SpringBootTest
class LocalLoginContractTests {
    @Autowired
    private lateinit var context: ApplicationContext

    private lateinit var client: WebTestClient

    @BeforeEach
    fun setUp() {
        client = WebTestClient.bindToApplicationContext(context).configureClient().baseUrl("http://localhost:8080").build()
    }

    private val path = AuthApiContract.LOCAL_LOGIN
    private val cookieName = LocalSessionCookie.NAME
    private val deniedCode = ErrorCode.LOGIN_DENIED

    @Disabled("request-apps-local-account-auth.md에서 구현")
    @Test
    fun `active account with a role logs in with 200 and login Set-Cookie`() {
    }

    @Disabled("request-apps-local-account-auth.md에서 구현")
    @Test
    fun `expiresAt is UTC ISO-8601 exactly 8 hours after login`() {
    }

    @Disabled("request-apps-local-account-auth.md에서 구현")
    @Test
    fun `only the token hash is stored`() {
    }

    @Disabled("request-apps-local-account-auth.md에서 구현")
    @Test
    fun `malformed JSON, missing body or unknown field returns 400 BAD_REQUEST`() {
    }

    @Disabled("request-apps-local-account-auth.md에서 구현")
    @Test
    fun `accountId outside 1 to 120 characters returns 422 VALIDATION_FAILED`() {
    }

    @Disabled("request-apps-local-account-auth.md에서 구현")
    @Test
    fun `unknown account returns 403 LOGIN_DENIED`() {
    }

    @Disabled("request-apps-local-account-auth.md에서 구현")
    @Test
    fun `inactive account returns 403 LOGIN_DENIED`() {
    }

    @Disabled("request-apps-local-account-auth.md에서 구현")
    @Test
    fun `account without a role returns 403 LOGIN_DENIED`() {
    }

    @Disabled("request-apps-local-account-auth.md에서 구현")
    @Test
    fun `denied reasons share one identical response`() {
    }

    @Disabled("request-apps-local-account-auth.md에서 구현")
    @Test
    fun `422 response carries fields with name accountId`() {
    }

    @Disabled("request-apps-local-account-auth.md에서 구현")
    @Test
    fun `login with an existing cookie issues a new session and does not revoke the old one`() {
    }

    @Disabled("request-apps-local-account-auth.md에서 구현")
    @Test
    fun `stored admin_session row has token hash, account, expiry and no revoke`() {
    }

    @Disabled("request-apps-local-account-auth.md에서 구현")
    @Test
    fun `decision order is 400 before 422 before 403`() {
    }

    @Disabled("request-apps-local-account-auth.md에서 구현")
    @Test
    fun `400, 403 and 404 responses use error envelope with code, message, empty fields and traceId`() {
    }

    @Disabled("request-apps-local-account-auth.md에서 구현")
    @Test
    fun `error messages are Korean`() {
    }
}
