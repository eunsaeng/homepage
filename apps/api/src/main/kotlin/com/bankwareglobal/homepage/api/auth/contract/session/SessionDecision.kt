package com.bankwareglobal.homepage.api.auth.contract.session

import com.bankwareglobal.homepage.api.common.error.ErrorCode

/** Result of [SessionDecisionRule.decide]. */
sealed interface SessionDecision {
    data object Allowed : SessionDecision

    /** [errorCode] is [ErrorCode.UNAUTHORIZED] (401) or [ErrorCode.FORBIDDEN] (403). */
    data class Denied(val errorCode: ErrorCode) : SessionDecision
}
