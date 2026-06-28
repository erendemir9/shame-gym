<?php
/**
 * classes/get.php — read-only single class / schedule detail.
 *
 * GET api/classes/get.php?id=1
 */

declare(strict_types=1);

ini_set('display_errors', '0');
error_reporting(E_ALL);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/auth.php';
require_once __DIR__ . '/../config/request.php';

requireHttpMethod('GET');

try {
    $user = requireLogin();
    $classId = getQueryInt('id');

    if ($classId === null || $classId <= 0) {
        errorResponse('Class id is required.', 400);
    }

    $pdo = getDatabaseConnection();
    $row = fetchClassForUser($pdo, $user, $classId);

    if (!$row) {
        errorResponse('Class not found.', 404);
    }

    successResponse(['class' => formatClassRow($row)], 'Class loaded successfully');
} catch (Throwable $e) {
    errorResponse('Failed to load class.', 500, [
        'error' => $e->getMessage(),
    ]);
}
