package com.bankwareglobal.homepage.api.config

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties("homepage.cors")
data class CorsProperties(
    val allowedOrigins: List<String>,
)
