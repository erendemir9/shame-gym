<?php
/**
 * trainers/list.php — read-only list of trainers.
 *
 * GET api/trainers/list.php
 * Optional: status
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
    $user = requireLogin();
    $role = $user['role'];

    $pdo = getDatabaseConnection();

    $sql = 'SELECT id, full_name, email, phone, specialization, availability, status, created_at, updated_at
            FROM trainers
            WHERE 1 = 1';

    $params = [];

    $statusFilter = getQueryString('status');
    if ($statusFilter === null) {
        $sql .= ' AND status = :status';
        $params['status'] = 'active';
    } elseif ($statusFilter === 'all') {
        if ($role !== 'admin') {
            errorResponse('You do not have permission to view all trainer statuses.', 403);
        }
    } else {
        $allowedStatuses = ['active', 'inactive'];
        if (!in_array($statusFilter, $allowedStatuses, true)) {
            errorResponse('Invalid status filter.', 400);
        }
        $sql .= ' AND status = :status';
        $params['status'] = $statusFilter;
    }

    $sql .= ' ORDER BY full_name ASC';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

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
