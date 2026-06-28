<?php
/**
 * polls/list.php — list polls visible to the current user.
 *
 * GET api/polls/list.php
 * Optional: status
 */

declare(strict_types=1);

ini_set('display_errors', '0');
error_reporting(E_ALL);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/auth.php';
require_once __DIR__ . '/../config/request.php';
require_once __DIR__ . '/poll_input.php';

requireHttpMethod('GET');

try {
    $user = requireLogin();
    $pdo = getDatabaseConnection();
    $role = (string) $user['role'];
    $userId = (int) $user['id'];

    $sql = 'SELECT p.id, p.question, p.description, p.status, p.opens_at, p.closes_at,
                   p.created_by_user_id, p.created_at, p.updated_at
            FROM polls p
            WHERE 1 = 1';

    $params = [];

    if ($role === 'admin') {
        $statusFilter = getQueryString('status');
        if ($statusFilter !== null && in_array($statusFilter, POLL_ALLOWED_STATUSES, true)) {
            $sql .= ' AND p.status = :status';
            $params['status'] = $statusFilter;
        }
    } else {
        $sql .= ' AND (p.status = :open_status OR EXISTS (
                    SELECT 1 FROM vote_receipts vr
                    WHERE vr.poll_id = p.id AND vr.user_id = :user_id
                ))';
        $params['open_status'] = 'open';
        $params['user_id'] = $userId;
    }

    $sql .= ' ORDER BY p.created_at DESC, p.id DESC';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    $polls = [];
    foreach ($rows as $row) {
        $polls[] = formatPollRow($pdo, $row, $user, false);
    }

    successResponse(['polls' => $polls], 'Polls loaded successfully');
} catch (Throwable $e) {
    errorResponse('Failed to load polls.', 500, [
        'error' => $e->getMessage(),
    ]);
}
