<?php
/**
 * polls/delete.php — close a poll (admin only, soft close).
 *
 * POST api/polls/delete.php
 */

declare(strict_types=1);

ini_set('display_errors', '0');
error_reporting(E_ALL);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/auth.php';
require_once __DIR__ . '/../config/request.php';
require_once __DIR__ . '/poll_input.php';

requireHttpMethod('POST');

try {
    $user = requireRole('admin');

    $body = getJsonRequestBody();
    if ($body === null) {
        errorResponse('Request body is required.', 400);
    }

    $pollId = parsePollIdFromRequest($body['id'] ?? null);
    if ($pollId === null) {
        errorResponse('Poll id is required.', 400);
    }

    $pdo = getDatabaseConnection();
    $existing = fetchPollRowById($pdo, $pollId);

    if (!$existing) {
        errorResponse('Poll not found.', 404);
    }

    $stmt = $pdo->prepare(
        'UPDATE polls
         SET status = :status, updated_at = CURRENT_TIMESTAMP
         WHERE id = :id'
    );
    $stmt->execute([
        'status' => 'closed',
        'id'     => $pollId,
    ]);

    successResponse([
        'id'     => $pollId,
        'status' => 'closed',
    ], 'Poll closed successfully', 200);
} catch (Throwable $e) {
    errorResponse('Failed to close poll.', 500, [
        'error' => $e->getMessage(),
    ]);
}
