<?php
/**
 * enrollments/list.php — read-only list of class enrollments.
 *
 * GET api/enrollments/list.php
 * Optional: class_id, member_id
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

    $classId = getQueryInt('class_id');
    $memberId = getQueryInt('member_id');

    $sql = 'SELECT e.id, e.class_id, c.class_name, e.member_id,
                   m.full_name AS member_name, m.email AS member_email,
                   e.enrolled_at, e.status
            FROM enrollments e
            INNER JOIN classes c ON c.id = e.class_id
            INNER JOIN members m ON m.id = e.member_id
            WHERE 1 = 1';

    $params = [];

    if ($role === 'admin') {
        if ($classId !== null) {
            $sql .= ' AND e.class_id = :class_id';
            $params['class_id'] = $classId;
        }
        if ($memberId !== null) {
            $sql .= ' AND e.member_id = :member_id';
            $params['member_id'] = $memberId;
        }
    } elseif ($role === 'trainer') {
        $linkedTrainerId = getLinkedTrainerId($user);
        if ($linkedTrainerId === null) {
            successResponse(['enrollments' => []], 'Enrollments loaded successfully');
        }

        $sql .= ' AND c.trainer_id = :trainer_id';
        $params['trainer_id'] = $linkedTrainerId;

        if ($classId !== null) {
            $classRow = fetchClassForUser($pdo, $user, $classId);
            if ($classRow === null) {
                errorResponse('You do not have permission to view enrollments for this class.', 403);
            }
            $sql .= ' AND e.class_id = :class_id';
            $params['class_id'] = $classId;
        }

        if ($memberId !== null) {
            $sql .= ' AND e.member_id = :member_id';
            $params['member_id'] = $memberId;
        }
    } elseif ($role === 'member') {
        $linkedMemberId = getLinkedMemberId($user);
        if ($linkedMemberId === null) {
            successResponse(['enrollments' => []], 'Enrollments loaded successfully');
        }

        $sql .= ' AND e.member_id = :member_id';
        $params['member_id'] = $linkedMemberId;

        if ($memberId !== null && $memberId !== $linkedMemberId) {
            errorResponse('You do not have permission to view these enrollments.', 403);
        }

        if ($classId !== null) {
            $sql .= ' AND e.class_id = :class_id';
            $params['class_id'] = $classId;
        }
    }

    $sql .= ' ORDER BY e.enrolled_at DESC';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    $enrollments = [];
    foreach ($rows as $row) {
        $enrollments[] = formatEnrollmentRow($row);
    }

    successResponse(['enrollments' => $enrollments], 'Enrollments loaded successfully');
} catch (Throwable $e) {
    errorResponse('Failed to load enrollments.', 500, [
        'error' => $e->getMessage(),
    ]);
}
