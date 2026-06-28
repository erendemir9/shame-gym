<?php
/**
 * meetings/list.php — list meetings with role-based filtering.
 *
 * GET api/meetings/list.php
 * Optional: status (scheduled|completed|cancelled|all)
 */

declare(strict_types=1);

ini_set('display_errors', '0');
error_reporting(E_ALL);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/auth.php';
require_once __DIR__ . '/../config/request.php';
require_once __DIR__ . '/meeting_input.php';

requireHttpMethod('GET');

try {
    $user = requireLogin();
    $role = $user['role'];
    $pdo = getDatabaseConnection();

    if ($role === 'member') {
        errorResponse('You do not have permission to view staff meetings.', 403);
    }

    $sql = 'SELECT id, title, meeting_date, meeting_time, location, notes,
                   created_by_user_id, status, created_at, updated_at
            FROM meetings
            WHERE 1 = 1';

    $params = [];

    if ($role === 'trainer') {
        $sql = 'SELECT m.id, m.title, m.meeting_date, m.meeting_time, m.location, m.notes,
                       m.created_by_user_id, m.status, m.created_at, m.updated_at
                FROM meetings m
                INNER JOIN meeting_attendees ma ON ma.meeting_id = m.id
                WHERE (ma.user_id = :user_id OR ma.attendee_email = :email)';

        $params['user_id'] = (int) $user['id'];
        $params['email'] = normalizeEmail($user['email']);
    }

    $statusFilter = getQueryString('status');
    if ($statusFilter === null || $statusFilter === 'scheduled') {
        $sql .= ' AND ' . ($role === 'trainer' ? 'm.' : '') . 'status = :status';
        $params['status'] = 'scheduled';
    } elseif ($statusFilter === 'all') {
        if ($role !== 'admin') {
            errorResponse('You do not have permission to view all meeting statuses.', 403);
        }
    } else {
        $allowedStatuses = ['scheduled', 'completed', 'cancelled'];
        if (!in_array($statusFilter, $allowedStatuses, true)) {
            errorResponse('Invalid status filter.', 400);
        }
        $sql .= ' AND ' . ($role === 'trainer' ? 'm.' : '') . 'status = :status';
        $params['status'] = $statusFilter;
    }

    if ($role === 'trainer') {
        $sql .= ' GROUP BY m.id';
    }

    $sql .= ' ORDER BY ' . ($role === 'trainer' ? 'm.' : '') . 'meeting_date ASC, '
        . ($role === 'trainer' ? 'm.' : '') . 'meeting_time ASC';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    $meetings = [];
    foreach ($rows as $row) {
        $meetings[] = formatMeetingRow($pdo, $row);
    }

    successResponse(['meetings' => $meetings], 'Meetings loaded successfully');
} catch (Throwable $e) {
    errorResponse('Failed to load meetings.', 500, [
        'error' => $e->getMessage(),
    ]);
}
