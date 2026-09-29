package com.bankwareglobal.homepage.api.common.error

import org.springframework.http.HttpStatus

enum class ErrorCode(val status: HttpStatus, val defaultMessage: String) {
    BAD_REQUEST(HttpStatus.BAD_REQUEST, "잘못된 요청입니다."),
    UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."),
    FORBIDDEN(HttpStatus.FORBIDDEN, "이 작업을 수행할 권한이 없습니다."),

    // One generic message for every denial reason, so callers cannot enumerate accounts.
    LOGIN_DENIED(HttpStatus.FORBIDDEN, "로그인할 수 없습니다. 관리자에게 문의해 주세요."),
    NOT_FOUND(HttpStatus.NOT_FOUND, "요청한 대상을 찾을 수 없습니다."),
    VALIDATION_FAILED(HttpStatus.UNPROCESSABLE_CONTENT, "입력값이 올바르지 않습니다."),
    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "서버 오류가 발생했습니다."),
}
