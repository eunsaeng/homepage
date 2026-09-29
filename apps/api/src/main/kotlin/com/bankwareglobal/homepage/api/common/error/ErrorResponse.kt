package com.bankwareglobal.homepage.api.common.error

data class ErrorResponse(val error: ErrorBody) {
    companion object {
        fun of(
            code: ErrorCode,
            traceId: String,
            message: String = code.defaultMessage,
            fields: List<FieldError> = emptyList(),
        ): ErrorResponse = ErrorResponse(ErrorBody(code, message, fields, traceId))
    }
}

data class ErrorBody(
    val code: ErrorCode,
    val message: String,
    val fields: List<FieldError> = emptyList(),
    val traceId: String,
)

data class FieldError(val name: String, val reason: String)
