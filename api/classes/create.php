<?php
/**
 * classes/create.php — admin-only create class / schedule.
 *
 * POST api/classes/create.php
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

    $normalized = normalizeClassWritePayload($body, false);
    if (!$normalized['ok']) {
        errorResponse($normalized['message'], 400);
    }

    $classData = $normalized['data'];
    $pdo = getDatabaseConnection();

    if (!activeTrainerExists($pdo, $classData['trainer_id'])) {
        errorResponse('Assigned trainer not found or is inactive.', 400);
    }

    $insertSql = 'INSERT INTO classes
        (class_name, trainer_id, class_date, class_time, duration_minutes, capacity, status)
        VALUES
        (:class_name, :trainer_id, :class_date, :class_time, :duration_minutes, :capacity, :status)';

    $insertStmt = $pdo->prepare($insertSql);
    $insertStmt->execute([
        'class_name'       => $classData['class_name'],
        'trainer_id'       => $classData['trainer_id'],
        'class_date'       => $classData['class_date'],
        'class_time'       => $classData['class_time'],
        'duration_minutes' => $classData['duration_minutes'],
        'capacity'         => $classData['capacity'],
        'status'           => $classData['status'],
    ]);

    $classId = (int) $pdo->lastInsertId();
    $classRow = fetchClassRowById($pdo, $classId);

    if (!$classRow) {
        errorResponse('Class was created but could not be loaded.', 500);
    }

    successResponse([
        'class' => formatClassRow($classRow),
    ], 'Class created successfully', 200);
} catch (Throwable $e) {
    errorResponse('Failed to create class.', 500, [
        'error' => $e->getMessage(),
    ]);
}
