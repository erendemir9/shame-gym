<?php
/**
 * workouts/list.php — list workout plans with role-based filtering.
 *
 * GET api/workouts/list.php
 * Optional: status (active|archived|all, admin only for all/archived)
 */

declare(strict_types=1);

ini_set('display_errors', '0');
error_reporting(E_ALL);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/auth.php';
require_once __DIR__ . '/../config/request.php';
require_once __DIR__ . '/workout_input.php';

requireHttpMethod('GET');

try {
    $user = requireLogin();
    $role = $user['role'];
    $pdo = getDatabaseConnection();

    $sql = 'SELECT wp.id, wp.member_id, wp.trainer_id, wp.plan_name, wp.notes, wp.plan_details,
                   wp.status, wp.created_at, wp.updated_at,
                   m.full_name AS member_name, m.email AS member_email,
                   t.full_name AS trainer_name
            FROM workout_plans wp
            INNER JOIN members m ON m.id = wp.member_id
            INNER JOIN trainers t ON t.id = wp.trainer_id
            WHERE 1 = 1';

    $params = [];

    if ($role === 'member') {
        $linkedMemberId = getLinkedMemberId($user);
        if ($linkedMemberId === null) {
            successResponse(['workout_plans' => []], 'Workout plans loaded successfully');
        }
        $sql .= ' AND wp.member_id = :member_id';
        $params['member_id'] = $linkedMemberId;
        $sql .= ' AND wp.status = :status';
        $params['status'] = 'active';
    } elseif ($role === 'trainer') {
        $linkedTrainerId = getLinkedTrainerId($user);
        if ($linkedTrainerId === null) {
            successResponse(['workout_plans' => []], 'Workout plans loaded successfully');
        }
        $sql .= ' AND wp.trainer_id = :trainer_id';
        $params['trainer_id'] = $linkedTrainerId;
        $sql .= ' AND wp.status = :status';
        $params['status'] = 'active';
    } else {
        $statusFilter = getQueryString('status');
        if ($statusFilter === null || $statusFilter === 'active') {
            $sql .= ' AND wp.status = :status';
            $params['status'] = 'active';
        } elseif ($statusFilter === 'all') {
            if ($role !== 'admin') {
                errorResponse('You do not have permission to view all workout plan statuses.', 403);
            }
        } elseif ($statusFilter === 'archived') {
            if ($role !== 'admin') {
                errorResponse('You do not have permission to view archived workout plans.', 403);
            }
            $sql .= ' AND wp.status = :status';
            $params['status'] = 'archived';
        } else {
            errorResponse('Invalid status filter.', 400);
        }
    }

    $sql .= ' ORDER BY wp.updated_at DESC, wp.id DESC';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    $plans = [];
    foreach ($rows as $row) {
        $plans[] = formatWorkoutPlanRow($pdo, $row);
    }

    successResponse(['workout_plans' => $plans], 'Workout plans loaded successfully');
} catch (Throwable $e) {
    errorResponse('Failed to load workout plans.', 500, [
        'error' => $e->getMessage(),
    ]);
}
