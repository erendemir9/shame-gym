<?php
/**
 * trainers/update.php — admin-only update trainer.
 *
 * POST api/trainers/update.php
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
    if ($body === null) {
        errorResponse('Request body is required.', 400);
    }

    $normalized = normalizeTrainerWritePayload($body, true);
    if (!$normalized['ok']) {
        errorResponse($normalized['message'], 400);
    }

    $trainerData = $normalized['data'];
    $trainerId = $trainerData['id'];
    $pdo = getDatabaseConnection();

    $existingTrainer = fetchTrainerRowById($pdo, $trainerId);
    if (!$existingTrainer) {
        errorResponse('Trainer not found.', 404);
    }

    $duplicateSql = 'SELECT id FROM trainers WHERE email = :email AND id != :id LIMIT 1';
    $duplicateStmt = $pdo->prepare($duplicateSql);
    $duplicateStmt->execute([
        'email' => $trainerData['email'],
        'id'    => $trainerId,
    ]);
    if ($duplicateStmt->fetch()) {
        errorResponse('Another trainer already uses this email.', 409);
    }

    $updateSql = 'UPDATE trainers
                  SET full_name = :full_name,
                      email = :email,
                      phone = :phone,
                      specialization = :specialization,
                      availability = :availability,
                      status = :status,
                      updated_at = CURRENT_TIMESTAMP
                  WHERE id = :id';

    $updateStmt = $pdo->prepare($updateSql);
    $updateStmt->execute([
        'full_name'      => $trainerData['full_name'],
        'email'          => $trainerData['email'],
        'phone'          => $trainerData['phone'],
        'specialization' => $trainerData['specialization'],
        'availability'   => $trainerData['availability'],
        'status'         => $trainerData['status'],
        'id'             => $trainerId,
    ]);

    $trainerRow = fetchTrainerRowById($pdo, $trainerId);
    if (!$trainerRow) {
        errorResponse('Trainer was updated but could not be loaded.', 500);
    }

    successResponse([
        'trainer' => formatTrainerRow($trainerRow),
    ], 'Trainer updated successfully', 200);
} catch (Throwable $e) {
    errorResponse('Failed to update trainer.', 500, [
        'error' => $e->getMessage(),
    ]);
}
