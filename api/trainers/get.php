<?php
/**
 * trainers/get.php — read-only single trainer profile.
 *
 * GET api/trainers/get.php?id=1
 */

declare(strict_types=1);

ini_set('display_errors', '0');
error_reporting(E_ALL);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/auth.php';
require_once __DIR__ . '/../config/request.php';

requireHttpMethod('GET');

try {
    requireLogin();
    $trainerId = getQueryInt('id');

    if ($trainerId === null || $trainerId <= 0) {
        errorResponse('Trainer id is required.', 400);
    }

    $pdo = getDatabaseConnection();

    $stmt = $pdo->prepare(
        'SELECT id, full_name, email, phone, specialization, availability, status, created_at, updated_at
         FROM trainers
         WHERE id = :id
         LIMIT 1'
    );
    $stmt->execute(['id' => $trainerId]);
    $row = $stmt->fetch();

    if (!$row) {
        errorResponse('Trainer not found.', 404);
    }

    successResponse(['trainer' => formatTrainerRow($row)], 'Trainer loaded successfully');
} catch (Throwable $e) {
    errorResponse('Failed to load trainer.', 500, [
        'error' => $e->getMessage(),
    ]);
}
