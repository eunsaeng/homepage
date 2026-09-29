package com.bankwareglobal.homepage.api.auth.contract.http

import com.bankwareglobal.homepage.api.auth.contract.AuthApiContract
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Disabled
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.ApplicationContext
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.reactive.server.WebTestClient

/** Contract skeleton: outside `local`, only local-accounts and local-login answer 404. */
@Disabled("request-apps-local-account-auth.md에서 구현")
@SpringBootTest
@ActiveProfiles("stg")
class NonLocalProfileGatingContractTests {
    @Autowired
    private lateinit var context: ApplicationContext

    private lateinit var client: WebTestClient

    @BeforeEach
    fun setUp() {
        client = WebTestClient.bindToApplicationContext(context).configureClient().baseUrl("http://localhost:8080").build()
    }

    private val localAccountsPath = AuthApiContract.LOCAL_ACCOUNTS
    private val localLoginPath = AuthApiContract.LOCAL_LOGIN
    private val sessionPath = AuthApiContract.SESSION
    private val logoutPath = AuthApiContract.LOGOUT

    @Disabled("request-apps-local-account-auth.md에서 구현")
    @Test
    fun `local-accounts returns 404 NOT_FOUND outside local`() {
    }

    @Disabled("request-apps-local-account-auth.md에서 구현")
    @Test
    fun `local-login returns 404 NOT_FOUND outside local before body validation`() {
    }

    @Disabled("request-apps-local-account-auth.md에서 구현")
    @Test
    fun `session is not gated and returns 401 without a cookie`() {
    }

    @Disabled("request-apps-local-account-auth.md에서 구현")
    @Test
    fun `logout is not gated and returns 204`() {
    }
}
