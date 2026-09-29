package com.bankwareglobal.homepage.api.auth.contract

import com.fasterxml.jackson.annotation.JsonAnySetter
import jakarta.validation.constraints.NotNull
import jakarta.validation.constraints.Size

/** Length limits for [LocalLoginRequest.accountId]. */
const val ACCOUNT_ID_MIN_LENGTH = 1
const val ACCOUNT_ID_MAX_LENGTH = 120

/**
 * Body of `POST /api/admin/auth/local-login`.
 *
 * Any field other than `accountId` fails deserialization, which the API reports as 400.
 * The rejection does not depend on the mapper's `FAIL_ON_UNKNOWN_PROPERTIES` setting.
 *
 * `accountId` is nullable so that a missing or null value still deserializes and is then
 * rejected by validation (`@NotNull`), which the API reports as 422 VALIDATION_FAILED.
 */
data class LocalLoginRequest(
    @field:NotNull
    @field:Size(min = ACCOUNT_ID_MIN_LENGTH, max = ACCOUNT_ID_MAX_LENGTH)
    val accountId: String? = null,
) {
    @JsonAnySetter
    @Suppress("UNUSED_PARAMETER")
    private fun rejectUnknownProperty(name: String, value: Any?) {
        throw IllegalArgumentException("Unknown field in login request: $name")
    }
}
