<?php
/**
 * members/list.php — read-only list of members with role-based filtering.
 *
 * GET api/members/list.php
 * Optional: search, status, trainer_id
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

    if ($role === 'member') {
        errorResponse('You do not have permission to view the member list.', 403);
    }

    $pdo = getDatabaseConnection();

    $sql = 'SELECT m.id, m.full_name, m.email, m.phone, m.membership_type, m.start_date,
                   m.assigned_trainer_id, t.full_name AS assigned_trainer_name,
                   m.status, m.created_at, m.updated_at
            FROM members m
            LEFT JOIN trainers t ON t.id = m.assigned_trainer_id
            WHERE 1 = 1';

    $params = [];

    if ($role === 'trainer') {
        $linkedTrainerId = getLinkedTrainerId($user);
        if ($linkedTrainerId === null) {
            successResponse(['members' => []], 'Members loaded successfully');
        }
        $sql .= ' AND m.assigned_trainer_id = :assigned_trainer_id';
        $params['assigned_trainer_id'] = $linkedTrainerId;
    }

    $searchTerm = getQueryString('search');
    if ($searchTerm !== null) {
        $sql .= ' AND (m.full_name LIKE :search OR m.email LIKE :search)';
        $params['search'] = '%' . $searchTerm . '%';
    }

    $statusFilter = getQueryString('status');
    if ($statusFilter !== null) {
        $allowedStatuses = ['active', 'inactive', 'suspended'];
        if (!in_array($statusFilter, $allowedStatuses, true)) {
            errorResponse('Invalid status filter.', 400);
        }
        $sql .= ' AND m.status = :status';
        $params['status'] = $statusFilter;
    }

    $trainerFilter = getQueryInt('trainer_id');
    if ($trainerFilter !== null) {
        if ($role === 'trainer' && $trainerFilter !== getLinkedTrainerId($user)) {
            errorResponse('You do not have permission to view these members.', 403);
        }
        $sql .= ' AND m.assigned_trainer_id = :trainer_id';
        $params['trainer_id'] = $trainerFilter;
    }

    $sql .= ' ORDER BY m.full_name ASC';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    $members = [];
    foreach ($rows as $row) {
        $members[] = formatMemberRow($row);
    }

    successResponse(['members' => $members], 'Members loaded successfully');
} catch (Throwable $e) {
    errorResponse('Failed to load members.', 500, [
        'error' => $e->getMessage(),
    ]);
}
