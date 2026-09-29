package com.bankwareglobal.homepage.api.auth.contract

/** Role names exposed in `Account.roles`. Order in a response follows `app_role.sort_order`. */
enum class AccountRole {
    ROLE_MANAGER,
    CONTENT_EDITOR,
    PUBLISHER,
}
