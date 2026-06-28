<?php
/**
 * polls/update.php — update poll metadata and optionally options (admin only).
 *
 * POST api/polls/update.php
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

    $normalized = normalizePollUpdatePayload($body);
    if (!$normalized['ok']) {
        errorResponse($normalized['message'], 400);
    }

    $data = $normalized['data'];
    $pdo = getDatabaseConnection();
    $existing = fetchPollRowById($pdo, $data['id']);

    if (!$existing) {
        errorResponse('Poll not found.', 404);
    }

    $pdo->beginTransaction();

    $fields = [];
    $params = ['id' => $data['id']];

    if (isset($data['question'])) {
        $fields[] = 'question = :question';
        $params['question'] = $data['question'];
    }

    if (array_key_exists('description', $data)) {
        $fields[] = 'description = :description';
        $params['description'] = $data['description'];
    }

    if (isset($data['status'])) {
        $fields[] = 'status = :status';
        $params['status'] = $data['status'];
    }

    if (array_key_exists('opens_at', $data)) {
        $fields[] = 'opens_at = :opens_at';
        $params['opens_at'] = $data['opens_at'];
    }

    if (array_key_exists('closes_at', $data)) {
        $fields[] = 'closes_at = :closes_at';
        $params['closes_at'] = $data['closes_at'];
    }

    if (count($fields) > 0) {
        $fields[] = 'updated_at = CURRENT_TIMESTAMP';
        $updateSql = 'UPDATE polls SET ' . implode(', ', $fields) . ' WHERE id = :id';
        $updateStmt = $pdo->prepare($updateSql);
        $updateStmt->execute($params);
    }

    if (isset($data['options'])) {
        $replaceResult = replacePollOptionsIfNoVotes($pdo, $data['id'], $data['options']);
        if (!$replaceResult['ok']) {
            $pdo->rollBack();
            errorResponse($replaceResult['message'], 400);
        }
    }

    $pdo->commit();

    $row = fetchPollRowById($pdo, $data['id']);
    if (!$row) {
        errorResponse('Poll was updated but could not be loaded.', 500);
    }

    successResponse([
        'poll' => formatPollRow($pdo, $row, $user, true),
    ], 'Poll updated successfully', 200);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    errorResponse('Failed to update poll.', 500, [
        'error' => $e->getMessage(),
    ]);
}
