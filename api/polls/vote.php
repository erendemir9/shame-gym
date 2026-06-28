<?php
/**
 * polls/vote.php — cast a confidential vote.
 *
 * POST api/polls/vote.php
 * Body: poll_id, option_id
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
    $user = requireLogin();

    $body = getJsonRequestBody();
    if ($body === null) {
        errorResponse('Request body is required.', 400);
    }

    $pollId = parsePollIdFromRequest($body['poll_id'] ?? $body['id'] ?? null);
    $optionId = isset($body['option_id']) ? (int) $body['option_id'] : 0;

    if ($pollId === null) {
        errorResponse('Poll id is required.', 400);
    }

    if ($optionId <= 0) {
        errorResponse('Option id is required.', 400);
    }

    $pdo = getDatabaseConnection();
    $pollRow = fetchPollRowById($pdo, $pollId);

    if (!$pollRow) {
        errorResponse('Poll not found.', 404);
    }

    if (!isPollAcceptingVotes($pollRow)) {
        errorResponse('This poll is not open for voting.', 400);
    }

    if (!pollOptionBelongsToPoll($pdo, $pollId, $optionId)) {
        errorResponse('Invalid option for this poll.', 400);
    }

    $userId = (int) $user['id'];

    if (hasUserVotedInPoll($pdo, $pollId, $userId)) {
        errorResponse('You have already voted in this poll.', 409);
    }

    $pdo->beginTransaction();

    $receiptCheck = $pdo->prepare(
        'SELECT id FROM vote_receipts WHERE poll_id = :poll_id AND user_id = :user_id LIMIT 1'
    );
    $receiptCheck->execute([
        'poll_id' => $pollId,
        'user_id' => $userId,
    ]);

    if ($receiptCheck->fetch()) {
        $pdo->rollBack();
        errorResponse('You have already voted in this poll.', 409);
    }

    $anonymousToken = generateAnonymousVoteToken();

    $voteStmt = $pdo->prepare(
        'INSERT INTO votes (poll_id, option_id, anonymous_vote_token)
         VALUES (:poll_id, :option_id, :anonymous_vote_token)'
    );
    $voteStmt->execute([
        'poll_id'              => $pollId,
        'option_id'            => $optionId,
        'anonymous_vote_token' => $anonymousToken,
    ]);

    $receiptStmt = $pdo->prepare(
        'INSERT INTO vote_receipts (poll_id, user_id)
         VALUES (:poll_id, :user_id)'
    );
    $receiptStmt->execute([
        'poll_id' => $pollId,
        'user_id' => $userId,
    ]);

    $pdo->commit();

    $results = fetchPollResults($pdo, $pollId);

    successResponse([
        'poll_id'   => $pollId,
        'option_id' => $optionId,
        'results'   => $results,
    ], 'Vote recorded successfully', 200);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    if ($e instanceof PDOException && (int) $e->getCode() === 23000) {
        errorResponse('You have already voted in this poll.', 409);
    }

    errorResponse('Failed to record vote.', 500, [
        'error' => $e->getMessage(),
    ]);
}
