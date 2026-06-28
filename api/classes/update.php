<?php
/**
 * classes/update.php — admin-only update class / schedule.
 *
 * POST api/classes/update.php
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
    if ($body === null) {
        errorResponse('Request body is required.', 400);
    }

    $normalized = normalizeClassWritePayload($body, true);
    if (!$normalized['ok']) {
        errorResponse($normalized['message'], 400);
    }

    $classData = $normalized['data'];
    $classId = $classData['id'];
    $pdo = getDatabaseConnection();

    $existingClass = fetchClassRowById($pdo, $classId);
    if (!$existingClass) {
        errorResponse('Class not found.', 404);
    }

    if (!activeTrainerExists($pdo, $classData['trainer_id'])) {
        errorResponse('Assigned trainer not found or is inactive.', 400);
    }

    $enrolledCount = isset($existingClass['enrolled_count']) ? (int) $existingClass['enrolled_count'] : 0;
    if ($classData['capacity'] < $enrolledCount) {
        errorResponse('Capacity cannot be below current enrollments (' . $enrolledCount . ').', 400);
    }

    $updateSql = 'UPDATE classes
                  SET class_name = :class_name,
                      trainer_id = :trainer_id,
                      class_date = :class_date,
                      class_time = :class_time,
                      duration_minutes = :duration_minutes,
                      capacity = :capacity,
                      status = :status,
                      updated_at = CURRENT_TIMESTAMP
                  WHERE id = :id';

    $updateStmt = $pdo->prepare($updateSql);
    $updateStmt->execute([
        'class_name'       => $classData['class_name'],
        'trainer_id'       => $classData['trainer_id'],
        'class_date'       => $classData['class_date'],
        'class_time'       => $classData['class_time'],
        'duration_minutes' => $classData['duration_minutes'],
        'capacity'         => $classData['capacity'],
        'status'           => $classData['status'],
        'id'               => $classId,
    ]);

    $classRow = fetchClassRowById($pdo, $classId);
    if (!$classRow) {
        errorResponse('Class was updated but could not be loaded.', 500);
    }

    successResponse([
        'class' => formatClassRow($classRow),
    ], 'Class updated successfully', 200);
} catch (Throwable $e) {
    errorResponse('Failed to update class.', 500, [
        'error' => $e->getMessage(),
    ]);
}
