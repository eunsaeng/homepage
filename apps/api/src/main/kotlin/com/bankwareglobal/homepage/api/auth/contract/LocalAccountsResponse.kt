package com.bankwareglobal.homepage.api.auth.contract

/** Response body of `GET /api/admin/auth/local-accounts`. */
data class LocalAccountsResponse(val items: List<Account>)
