<?php
/**
 * auth.php — session and role-check helpers for server-side API protection.
 *
 * Login/logout endpoints in api/auth/ use these helpers.
 * The frontend still uses localStorage auth for now; server sessions are
 * ready for later improvement.
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
 * Normalize an email address for lookup and comparison.
 *
 * @param string $email
 * @return string
 */
function normalizeEmail($email)
{
    return strtolower(trim((string) $email));
}

/**
 * Build a safe user object for session storage and JSON responses.
 * Never includes password_hash or other sensitive fields.
 *
 * @param array $userRow Database row or partial user data
 * @return array
 */
function sanitizeSessionUser($userRow)
{
    return [
        'id'                 => isset($userRow['id']) ? (int) $userRow['id'] : null,
        'email'              => isset($userRow['email']) ? (string) $userRow['email'] : '',
        'full_name'          => isset($userRow['full_name']) ? (string) $userRow['full_name'] : '',
        'role'               => isset($userRow['role']) ? (string) $userRow['role'] : '',
        'linked_member_id'   => isset($userRow['linked_member_id']) && $userRow['linked_member_id'] !== null
            ? (int) $userRow['linked_member_id']
            : null,
        'linked_trainer_id'  => isset($userRow['linked_trainer_id']) && $userRow['linked_trainer_id'] !== null
            ? (int) $userRow['linked_trainer_id']
            : null,
    ];
}

/**
 * Store the authenticated user in the PHP session.
 *
 * @param array $user Safe user object from sanitizeSessionUser()
 * @return void
 */
function setCurrentUser($user)
{
    startAppSession();
    $_SESSION['user'] = sanitizeSessionUser($user);
}

/**
 * Return the logged-in user stored in the PHP session, or null.
 *
 * @return array|null
 */
function getCurrentUser()
{
    startAppSession();

    if (!isset($_SESSION['user']) || !is_array($_SESSION['user'])) {
        return null;
    }

    return sanitizeSessionUser($_SESSION['user']);
}

/**
 * Clear session user data without destroying the session cookie.
 *
 * @return void
 */
function clearCurrentUser()
{
    startAppSession();
    unset($_SESSION['user']);
}

/**
 * Destroy the PHP session and remove the session cookie.
 *
 * @return void
 */
function destroyAppSession()
{
    startAppSession();

    $_SESSION = [];

    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(
            session_name(),
            '',
            time() - 42000,
            $params['path'],
            $params['domain'],
            $params['secure'],
            $params['httponly']
        );
    }

    session_destroy();
}

/**
 * Read and decode a JSON request body.
 *
 * @return array|null Decoded array, or null if body is empty/invalid JSON
 */
function getJsonRequestBody()
{
    $raw = file_get_contents('php://input');

    if ($raw === false || trim($raw) === '') {
        return null;
    }

    $data = json_decode($raw, true);

    if (!is_array($data)) {
        return null;
    }

    return $data;
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
 * @param array|string $allowedRoles e.g. ['admin'] or 'admin'
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

/**
 * Reject requests that do not use the expected HTTP method.
 *
 * @param string $expectedMethod e.g. 'POST'
 * @return void
 */
function requireHttpMethod($expectedMethod)
{
    $method = isset($_SERVER['REQUEST_METHOD']) ? strtoupper($_SERVER['REQUEST_METHOD']) : '';

    if ($method !== strtoupper($expectedMethod)) {
        errorResponse('Method not allowed.', 405, [
            'allowed' => strtoupper($expectedMethod),
        ]);
    }
}
