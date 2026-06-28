<?php
/**
 * polls/results.php — poll vote counts and percentages.
 *
 * GET api/polls/results.php?id=
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
    $pollId = getQueryInt('id');

    if ($pollId === null) {
        errorResponse('Poll id is required.', 400);
    }

    $pdo = getDatabaseConnection();
    $pollRow = fetchPollRowById($pdo, $pollId);

    if (!$pollRow) {
        errorResponse('Poll not found.', 404);
    }

    if (!canViewPollResults($pdo, $user, $pollRow)) {
        errorResponse('Results are available after you vote or when the poll closes.', 403);
    }

    $results = fetchPollResults($pdo, $pollId);

    successResponse([
        'poll_id' => $pollId,
        'status'  => (string) $pollRow['status'],
        'results' => $results,
    ], 'Poll results loaded successfully');
} catch (Throwable $e) {
    errorResponse('Failed to load poll results.', 500, [
        'error' => $e->getMessage(),
    ]);
}
