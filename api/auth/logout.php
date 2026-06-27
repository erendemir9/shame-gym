<?php
/**
 * logout.php — destroy the current PHP session.
 *
 * POST only
 * URL: http://localhost/shame-gym/api/auth/logout.php
 */

declare(strict_types=1);

ini_set('display_errors', '0');
error_reporting(E_ALL);

require_once __DIR__ . '/../config/auth.php';

requireHttpMethod('POST');

try {
    destroyAppSession();

    successResponse(new stdClass(), 'Logout successful');
} catch (Throwable $e) {
    errorResponse('Logout failed due to a server error.', 500, [
        'error' => $e->getMessage(),
    ]);
}
