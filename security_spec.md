# Hardened Security Specification for PMES-AGR Dosso

## Data Invariants
1.  **Integrity**: Every document must adhere to its schema defined in the blueprint.
2.  **Authentication**: Only authenticated users with verified emails can perform write operations.
3.  **RBAC**: Access is strictly controlled by roles defined in the `users` collection:
    *   **ADMIN**: Global read/write access.
    *   **TRESORIER**: Write access to financial records (transactions, caisse, financements).
    *   **AGENT**: Limited write access to member creation and transactions.
    *   **MAIRE**: Read-only access to all auditing data.
4.  **Immutability**: Historical records like `audit_logs` and `transactions` are immutable once written (except for Admin corrections).
5.  **PII Privacy**: Member sensitive data (PIN, telephone) is protected.

## The "Dirty Dozen" Payloads (Denial Tests)
1.  **Unauthorized Write**: unauthenticated user tries to create an audit log.
2.  **Shadow Field Injection**: adding `is_super_admin: true` to a user profile update.
3.  **Role Escalation**: AGENT tries to update their role to ADMIN in `/users/{uid}`.
4.  **Invalid Type**: sending a string for `solde` in a Member document.
5.  **Oversized String**: sending a 10KB string for a `livret` number.
6.  **Future Timestamp**: setting `sync_at` to a future date manually.
7.  **Identity Spoofing**: User A trying to write an audit log claiming to be User B.
8.  **Orphaned Transaction**: creating a transaction for a member ID that doesn't exist.
9.  **Unauthorized List Query**: AGENT trying to list all `users` with a broad query.
10. **Maire Write Attempt**: User with MAIRE role trying to delete a transaction.
11. **PIN Length Violation**: setting a 5-digit PIN for a member.
12. **Status Shortcut**: moving a financing request from `en_attente` to `decaissed` without `valide` step (checked via rules).

## Security Logic Gates
*   `isValidId(id)`: Ensures IDs are strings, max 128 chars, alphanumeric.
*   `isValidUser(data)`: Validates User schema.
*   `isValidMember(data)`: Validates Member schema.
*   `isValidTransaction(data)`: Validates Transaction schema.
*   `isValidAuditLog(data)`: Validates AuditLog schema.
*   `isOwner(uid)`: `request.auth.uid == uid`.
*   `hasRole(role)`: Checks user document for specific role.
*   `isStaff()`: Checks for ADMIN, TRESORIER, or AGENT roles.
