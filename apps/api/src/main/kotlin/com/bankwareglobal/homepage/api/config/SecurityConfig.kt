package com.bankwareglobal.homepage.api.config

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.HttpStatus
import org.springframework.security.config.annotation.web.reactive.EnableWebFluxSecurity
import org.springframework.security.config.web.server.ServerHttpSecurity
import org.springframework.security.web.server.SecurityWebFilterChain
import org.springframework.security.web.server.authentication.HttpStatusServerEntryPoint
import org.springframework.web.cors.CorsConfiguration
import org.springframework.web.cors.reactive.UrlBasedCorsConfigurationSource

/**
 * Public and health endpoints are open; every other request needs an authenticated session.
 * Session authentication and per-role rules are added by the local account auth request.
 */
@Configuration
@EnableWebFluxSecurity
class SecurityConfig {
    @Bean
    fun securityWebFilterChain(http: ServerHttpSecurity, corsProperties: CorsProperties): SecurityWebFilterChain =
        http
            .csrf { it.disable() }
            .httpBasic { it.disable() }
            .formLogin { it.disable() }
            .cors { it.configurationSource(corsConfigurationSource(corsProperties)) }
            .exceptionHandling { it.authenticationEntryPoint(HttpStatusServerEntryPoint(HttpStatus.UNAUTHORIZED)) }
            .authorizeExchange {
                it.pathMatchers("/actuator/health", "/api/public/**").permitAll()
                it.anyExchange().authenticated()
            }
            .build()

    private fun corsConfigurationSource(corsProperties: CorsProperties) =
        UrlBasedCorsConfigurationSource().apply {
            registerCorsConfiguration(
                "/api/**",
                CorsConfiguration().apply {
                    allowedOrigins = corsProperties.allowedOrigins
                    allowedMethods = listOf("GET", "POST", "PUT", "DELETE", "OPTIONS")
                    allowedHeaders = listOf("Content-Type")
                    allowCredentials = true
                },
            )
        }
}
