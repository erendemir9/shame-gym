<?php
/**
 * trainers/list.php — read-only list of trainers.
 *
 * GET api/trainers/list.php
 * All logged-in roles may view the trainer list for schedule context.
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

    $pdo = getDatabaseConnection();

    $stmt = $pdo->query(
        'SELECT id, full_name, email, phone, specialization, availability, status, created_at, updated_at
         FROM trainers
         ORDER BY full_name ASC'
    );

    $trainers = [];
    foreach ($stmt->fetchAll() as $row) {
        $trainers[] = formatTrainerRow($row);
    }

    successResponse(['trainers' => $trainers], 'Trainers loaded successfully');
} catch (Throwable $e) {
    errorResponse('Failed to load trainers.', 500, [
        'error' => $e->getMessage(),
    ]);
}
