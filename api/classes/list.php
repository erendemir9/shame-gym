<?php
/**
 * classes/list.php — read-only list of classes / schedules.
 *
 * GET api/classes/list.php
 * Optional: trainer_id, status, date
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

    $sql = 'SELECT c.id, c.class_name, c.trainer_id, t.full_name AS trainer_name,
                   c.class_date, c.class_time, c.duration_minutes, c.capacity, c.status,
                   c.created_at, c.updated_at,
                   (SELECT COUNT(*)
                    FROM enrollments e
                    WHERE e.class_id = c.id AND e.status = \'enrolled\') AS enrolled_count
            FROM classes c
            INNER JOIN trainers t ON t.id = c.trainer_id
            WHERE 1 = 1';

    $params = [];

    if ($role === 'trainer') {
        $linkedTrainerId = getLinkedTrainerId($user);
        if ($linkedTrainerId === null) {
            successResponse(['classes' => []], 'Classes loaded successfully');
        }
        $sql .= ' AND c.trainer_id = :session_trainer_id';
        $params['session_trainer_id'] = $linkedTrainerId;
    }

    $trainerFilter = getQueryInt('trainer_id');
    if ($trainerFilter !== null) {
        if ($role === 'trainer' && $trainerFilter !== getLinkedTrainerId($user)) {
            errorResponse('You do not have permission to view these classes.', 403);
        }
        $sql .= ' AND c.trainer_id = :trainer_id';
        $params['trainer_id'] = $trainerFilter;
    }

    $statusFilter = getQueryString('status');
    if ($statusFilter === null) {
        $sql .= ' AND c.status = :status';
        $params['status'] = 'scheduled';
    } elseif ($statusFilter === 'all') {
        if ($role !== 'admin') {
            errorResponse('You do not have permission to view all class statuses.', 403);
        }
    } else {
        $allowedStatuses = ['scheduled', 'cancelled', 'completed'];
        if (!in_array($statusFilter, $allowedStatuses, true)) {
            errorResponse('Invalid status filter.', 400);
        }
        $sql .= ' AND c.status = :status';
        $params['status'] = $statusFilter;
    }

    $dateFilter = getQueryString('date');
    if ($dateFilter !== null) {
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateFilter)) {
            errorResponse('Invalid date filter. Use YYYY-MM-DD.', 400);
        }
        $sql .= ' AND c.class_date = :class_date';
        $params['class_date'] = $dateFilter;
    }

    $sql .= ' ORDER BY c.class_date ASC, c.class_time ASC';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    $classes = [];
    foreach ($rows as $row) {
        $classes[] = formatClassRow($row);
    }

    successResponse(['classes' => $classes], 'Classes loaded successfully');
} catch (Throwable $e) {
    errorResponse('Failed to load classes.', 500, [
        'error' => $e->getMessage(),
    ]);
}
