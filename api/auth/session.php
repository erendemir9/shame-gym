<?php
/**
 * session.php — return the current logged-in server session user.
 *
 * GET only
 * URL: http://localhost/shame-gym/api/auth/session.php
 */

declare(strict_types=1);

ini_set('display_errors', '0');
error_reporting(E_ALL);

require_once __DIR__ . '/../config/auth.php';

requireHttpMethod('GET');

$user = getCurrentUser();

if ($user === null) {
    errorResponse('Not authenticated', 401);
}

successResponse([
    'user' => $user,
], 'Active session found');
