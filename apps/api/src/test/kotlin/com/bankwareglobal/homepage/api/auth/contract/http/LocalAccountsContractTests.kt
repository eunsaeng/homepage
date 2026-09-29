package com.bankwareglobal.homepage.api.auth.contract.http

import com.bankwareglobal.homepage.api.auth.contract.AuthApiContract
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Disabled
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.ApplicationContext
import org.springframework.test.web.reactive.server.WebTestClient

/** Contract skeleton for `GET /api/admin/auth/local-accounts` (local profile). */
@Disabled("request-apps-local-account-auth.md에서 구현")
@SpringBootTest
class LocalAccountsContractTests {
    @Autowired
    private lateinit var context: ApplicationContext

    private lateinit var client: WebTestClient

    @BeforeEach
    fun setUp() {
        client = WebTestClient.bindToApplicationContext(context).configureClient().baseUrl("http://localhost:8080").build()
    }

    private val path = AuthApiContract.LOCAL_ACCOUNTS

    @Disabled("request-apps-local-account-auth.md에서 구현")
    @Test
    fun `returns 200 with items of accounts without a session`() {
    }

    @Disabled("request-apps-local-account-auth.md에서 구현")
    @Test
    fun `account roles are sorted by sort_order and empty when none`() {
    }

    @Disabled("request-apps-local-account-auth.md에서 구현")
    @Test
    fun `response never contains a token or secret`() {
    }
}
