<?php
/**
 * auth.php — session and role-check helpers for server-side API protection.
 *
 * Real login/logout endpoints will be added in a later sprint part.
 * The frontend still uses localStorage auth for now; these helpers prepare
 * the server-side structure endpoints will use once migration begins.
 */

require_once __DIR__ . '/response.php';

/**
 * Start a PHP session safely (only once per request).
 *
 * @return void
 */
function startAppSession()
{
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
}

/**
 * Return the logged-in user stored in the PHP session, or null.
 *
 * Expected session shape (set later by login.php):
 *   $_SESSION['user'] = ['id' => int, 'email' => string, 'full_name' => string, 'role' => string]
 *
 * @return array|null
 */
function getCurrentUser()
{
    startAppSession();

    if (!isset($_SESSION['user']) || !is_array($_SESSION['user'])) {
        return null;
    }

    return $_SESSION['user'];
}

/**
 * Check whether a user is logged in on the server.
 *
 * @return bool
 */
function isLoggedIn()
{
    return getCurrentUser() !== null;
}

/**
 * Require a logged-in user; send JSON 401 if not authenticated.
 *
 * @return array The current user record from the session
 */
function requireLogin()
{
    $user = getCurrentUser();

    if ($user === null) {
        errorResponse('Authentication required.', 401);
    }

    return $user;
}

/**
 * Require the current user to have one of the allowed roles.
 *
 * @param array $allowedRoles e.g. ['admin'] or ['admin', 'trainer']
 * @return array The current user record from the session
 */
function requireRole($allowedRoles)
{
    $user = requireLogin();

    if (!is_array($allowedRoles)) {
        $allowedRoles = [$allowedRoles];
    }

    $role = isset($user['role']) ? $user['role'] : '';

    if (!in_array($role, $allowedRoles, true)) {
        errorResponse('You do not have permission to access this resource.', 403);
    }

    return $user;
}
