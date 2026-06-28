<?php
/**
 * polls/get.php — fetch one poll with options and optional results.
 *
 * GET api/polls/get.php?id=
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
    $row = fetchPollRowById($pdo, $pollId);

    if (!$row) {
        errorResponse('Poll not found.', 404);
    }

    if ($user['role'] !== 'admin') {
        $visible = ($row['status'] === 'open') || hasUserVotedInPoll($pdo, $pollId, (int) $user['id']);
        if (!$visible) {
            errorResponse('You do not have permission to view this poll.', 403);
        }
    }

    $includeResults = getQueryString('include_results') === '1'
        || canViewPollResults($pdo, $user, $row);

    successResponse([
        'poll' => formatPollRow($pdo, $row, $user, $includeResults),
    ], 'Poll loaded successfully');
} catch (Throwable $e) {
    errorResponse('Failed to load poll.', 500, [
        'error' => $e->getMessage(),
    ]);
}
