<?php
/**
 * trainers/create.php — admin-only create trainer.
 *
 * POST api/trainers/create.php
 */

declare(strict_types=1);

ini_set('display_errors', '0');
error_reporting(E_ALL);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/auth.php';
require_once __DIR__ . '/../config/request.php';
require_once __DIR__ . '/trainer_input.php';
require_once __DIR__ . '/../users/account_provisioning.php';

requireHttpMethod('POST');

try {
    requireRole('admin');

    $body = getJsonRequestBody();
    if ($body === null) {
        errorResponse('Request body is required.', 400);
    }

    $normalized = normalizeTrainerWritePayload($body, false);
    if (!$normalized['ok']) {
        errorResponse($normalized['message'], 400);
    }

    $trainerData = $normalized['data'];
    $pdo = getDatabaseConnection();

    assertEmailAvailableForNewTrainer($pdo, $trainerData['email']);

    $pdo->beginTransaction();

    $insertSql = 'INSERT INTO trainers
        (full_name, email, phone, specialization, availability, status)
        VALUES
        (:full_name, :email, :phone, :specialization, :availability, :status)';

    $insertStmt = $pdo->prepare($insertSql);
    $insertStmt->execute([
        'full_name'      => $trainerData['full_name'],
        'email'          => $trainerData['email'],
        'phone'          => $trainerData['phone'],
        'specialization' => $trainerData['specialization'],
        'availability'   => $trainerData['availability'],
        'status'         => $trainerData['status'],
    ]);

    $trainerId = (int) $pdo->lastInsertId();
    createPendingUserForTrainer(
        $pdo,
        $trainerId,
        $trainerData['email'],
        $trainerData['full_name']
    );

    $pdo->commit();

    $trainerRow = fetchTrainerRowById($pdo, $trainerId);

    if (!$trainerRow) {
        errorResponse('Trainer was created but could not be loaded.', 500);
    }

    successResponse([
        'trainer' => formatTrainerRow($trainerRow),
    ], 'Trainer created successfully', 200);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    errorResponse('Failed to create trainer.', 500, [
        'error' => $e->getMessage(),
    ]);
}
