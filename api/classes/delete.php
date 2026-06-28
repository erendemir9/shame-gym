<?php
/**
 * classes/delete.php — admin-only soft delete for a class / schedule.
 *
 * POST api/classes/delete.php
 * Body: { "id": 7 } or { "id": "s7" }
 *
 * Sets status to cancelled. Does not remove the row or related enrollments.
 */

declare(strict_types=1);

ini_set('display_errors', '0');
error_reporting(E_ALL);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/auth.php';
require_once __DIR__ . '/../config/request.php';
require_once __DIR__ . '/class_input.php';

requireHttpMethod('POST');

try {
    requireRole('admin');

    $body = getJsonRequestBody();
    if ($body === null || !array_key_exists('id', $body)) {
        errorResponse('Class id is required.', 400);
    }

    $classId = parseClassIdFromRequest($body['id']);
    if ($classId === null) {
        errorResponse('Invalid class id.', 400);
    }

    $pdo = getDatabaseConnection();

    $selectSql = 'SELECT id, status FROM classes WHERE id = :id LIMIT 1';
    $selectStmt = $pdo->prepare($selectSql);
    $selectStmt->execute(['id' => $classId]);
    $class = $selectStmt->fetch();

    if (!$class) {
        errorResponse('Class not found.', 404);
    }

    if ($class['status'] === 'cancelled') {
        errorResponse('Class is already cancelled.', 409);
    }

    $updateSql = 'UPDATE classes
                  SET status = :status, updated_at = CURRENT_TIMESTAMP
                  WHERE id = :id';
    $updateStmt = $pdo->prepare($updateSql);
    $updateStmt->execute([
        'status' => 'cancelled',
        'id'     => $classId,
    ]);

    successResponse(['class_id' => $classId], 'Class deleted successfully');
} catch (Throwable $e) {
    errorResponse('Failed to delete class.', 500, [
        'error' => $e->getMessage(),
    ]);
}
