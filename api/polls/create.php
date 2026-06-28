<?php
/**
 * polls/create.php — create a poll with options (admin only).
 *
 * POST api/polls/create.php
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

    $normalized = normalizePollCreatePayload($body);
    if (!$normalized['ok']) {
        errorResponse($normalized['message'], 400);
    }

    $data = $normalized['data'];
    $pdo = getDatabaseConnection();
    $pdo->beginTransaction();

    $insertSql = 'INSERT INTO polls
        (question, description, status, opens_at, closes_at, created_by_user_id)
        VALUES
        (:question, :description, :status, :opens_at, :closes_at, :created_by_user_id)';

    $insertStmt = $pdo->prepare($insertSql);
    $insertStmt->execute([
        'question'           => $data['question'],
        'description'        => $data['description'],
        'status'             => $data['status'],
        'opens_at'           => $data['opens_at'],
        'closes_at'          => $data['closes_at'],
        'created_by_user_id' => (int) $user['id'],
    ]);

    $pollId = (int) $pdo->lastInsertId();
    insertPollOptions($pdo, $pollId, $data['options']);
    $pdo->commit();

    $row = fetchPollRowById($pdo, $pollId);
    if (!$row) {
        errorResponse('Poll was created but could not be loaded.', 500);
    }

    successResponse([
        'poll' => formatPollRow($pdo, $row, $user, true),
        'id'   => $pollId,
    ], 'Poll created successfully', 200);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    errorResponse('Failed to create poll.', 500, [
        'error' => $e->getMessage(),
    ]);
}
