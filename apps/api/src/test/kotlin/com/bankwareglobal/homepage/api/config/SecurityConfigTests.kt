package com.bankwareglobal.homepage.api.config

import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.ApplicationContext
import org.springframework.http.HttpHeaders
import org.springframework.test.web.reactive.server.WebTestClient

@SpringBootTest
class SecurityConfigTests {
    @Autowired
    private lateinit var context: ApplicationContext

    private lateinit var client: WebTestClient

    @BeforeEach
    fun setUp() {
        // CORS compares Origin with the request host, so the mock request needs an absolute base URL.
        client = WebTestClient.bindToApplicationContext(context).configureClient().baseUrl("http://localhost:8080").build()
    }

    @Test
    fun `admin endpoints require a session`() {
        client.get().uri("/api/admin/pages").exchange().expectStatus().isUnauthorized
    }

    @Test
    fun `public endpoints are reachable without a session`() {
        client.get().uri("/api/public/navigation").exchange().expectStatus().isNotFound
    }

    @Test
    fun `health endpoint is public`() {
        client.get().uri("/actuator/health").exchange().expectStatus().isOk
    }

    @Test
    fun `admin origin may send credentialed requests`() {
        client.options().uri("/api/admin/pages")
            .header(HttpHeaders.ORIGIN, "http://localhost:3001")
            .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "PUT")
            .exchange()
            .expectHeader().valueEquals(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "http://localhost:3001")
            .expectHeader().valueEquals(HttpHeaders.ACCESS_CONTROL_ALLOW_CREDENTIALS, "true")
    }

    @Test
    fun `other origins are rejected`() {
        client.options().uri("/api/admin/pages")
            .header(HttpHeaders.ORIGIN, "http://example.com")
            .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET")
            .exchange()
            .expectStatus().isForbidden
    }
}
