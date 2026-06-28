<?php
/**
 * trainers/delete.php — admin-only soft delete for a trainer.
 *
 * POST api/trainers/delete.php
 * Body: { "id": 6 } or { "id": "t6" }
 *
 * Sets status to inactive. Does not remove the row or related records.
 */

declare(strict_types=1);

ini_set('display_errors', '0');
error_reporting(E_ALL);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/auth.php';
require_once __DIR__ . '/../config/request.php';
require_once __DIR__ . '/trainer_input.php';

requireHttpMethod('POST');

try {
    requireRole('admin');

    $body = getJsonRequestBody();
    if ($body === null || !array_key_exists('id', $body)) {
        errorResponse('Trainer id is required.', 400);
    }

    $trainerId = parseTrainerIdFromRequest($body['id']);
    if ($trainerId === null) {
        errorResponse('Invalid trainer id.', 400);
    }

    $pdo = getDatabaseConnection();

    $selectSql = 'SELECT id, status FROM trainers WHERE id = :id LIMIT 1';
    $selectStmt = $pdo->prepare($selectSql);
    $selectStmt->execute(['id' => $trainerId]);
    $trainer = $selectStmt->fetch();

    if (!$trainer) {
        errorResponse('Trainer not found.', 404);
    }

    if ($trainer['status'] === 'inactive') {
        errorResponse('Trainer is already inactive.', 409);
    }

    $updateSql = 'UPDATE trainers
                  SET status = :status, updated_at = CURRENT_TIMESTAMP
                  WHERE id = :id';
    $updateStmt = $pdo->prepare($updateSql);
    $updateStmt->execute([
        'status' => 'inactive',
        'id'     => $trainerId,
    ]);

    successResponse(['trainer_id' => $trainerId], 'Trainer deleted successfully');
} catch (Throwable $e) {
    errorResponse('Failed to delete trainer.', 500, [
        'error' => $e->getMessage(),
    ]);
}
