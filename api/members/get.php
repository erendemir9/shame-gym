<?php
/**
 * members/get.php — read-only single member profile.
 *
 * GET api/members/get.php?id=7
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
    $memberId = getQueryInt('id');

    if ($memberId === null || $memberId <= 0) {
        errorResponse('Member id is required.', 400);
    }

    $pdo = getDatabaseConnection();

    $sql = 'SELECT m.id, m.full_name, m.email, m.phone, m.membership_type, m.start_date,
                   m.assigned_trainer_id, t.full_name AS assigned_trainer_name,
                   m.status, m.created_at, m.updated_at
            FROM members m
            LEFT JOIN trainers t ON t.id = m.assigned_trainer_id
            WHERE m.id = :id';

    $params = ['id' => $memberId];
    $role = $user['role'];

    if ($role === 'member') {
        $linkedMemberId = getLinkedMemberId($user);
        if ($linkedMemberId === null || $linkedMemberId !== $memberId) {
            errorResponse('You do not have permission to view this member.', 403);
        }
    } elseif ($role === 'trainer') {
        $linkedTrainerId = getLinkedTrainerId($user);
        if ($linkedTrainerId === null) {
            errorResponse('You do not have permission to view this member.', 403);
        }
        $sql .= ' AND m.assigned_trainer_id = :assigned_trainer_id';
        $params['assigned_trainer_id'] = $linkedTrainerId;
    }

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $row = $stmt->fetch();

    if (!$row) {
        errorResponse('Member not found.', 404);
    }

    successResponse(['member' => formatMemberRow($row)], 'Member loaded successfully');
} catch (Throwable $e) {
    errorResponse('Failed to load member.', 500, [
        'error' => $e->getMessage(),
    ]);
}
