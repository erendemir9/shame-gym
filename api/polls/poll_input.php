<?php
/**
 * poll_input.php — shared helpers for poll / voting APIs.
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/request.php';

const POLL_ALLOWED_STATUSES = ['draft', 'open', 'closed'];

/**
 * Parse poll id from request value.
 *
 * @param mixed $rawId
 * @return int|null
 */
function parsePollIdFromRequest($rawId)
{
    if ($rawId === null || $rawId === '') {
        return null;
    }

    if (is_int($rawId) && $rawId > 0) {
        return $rawId;
    }

    if (is_string($rawId) && ctype_digit($rawId)) {
        $pollId = (int) $rawId;
        return $pollId > 0 ? $pollId : null;
    }

    if (is_string($rawId) && preg_match('/^poll(\d+)$/i', $rawId, $matches)) {
        return (int) $matches[1];
    }

    return null;
}

/**
 * Load one poll row by id.
 *
 * @param PDO $pdo
 * @param int $pollId
 * @return array|null
 */
function fetchPollRowById(PDO $pdo, $pollId)
{
    $stmt = $pdo->prepare(
        'SELECT id, question, description, status, opens_at, closes_at,
                created_by_user_id, created_at, updated_at
         FROM polls
         WHERE id = :id
         LIMIT 1'
    );
    $stmt->execute(['id' => $pollId]);
    $row = $stmt->fetch();

    return $row ?: null;
}

/**
 * Load poll options ordered by display_order.
 *
 * @param PDO $pdo
 * @param int $pollId
 * @return array
 */
function fetchPollOptions(PDO $pdo, $pollId)
{
    $stmt = $pdo->prepare(
        'SELECT id, poll_id, option_text, display_order
         FROM poll_options
         WHERE poll_id = :poll_id
         ORDER BY display_order ASC, id ASC'
    );
    $stmt->execute(['poll_id' => $pollId]);
    return $stmt->fetchAll();
}

/**
 * Format poll option rows for JSON output.
 *
 * @param array $rows
 * @return array
 */
function formatPollOptionRows(array $rows)
{
    $options = [];
    foreach ($rows as $row) {
        $options[] = [
            'id'            => (int) $row['id'],
            'poll_id'       => (int) $row['poll_id'],
            'option_text'   => (string) $row['option_text'],
            'display_order' => (int) $row['display_order'],
        ];
    }
    return $options;
}

/**
 * Check whether a user already voted in a poll.
 *
 * @param PDO $pdo
 * @param int $pollId
 * @param int $userId
 * @return bool
 */
function hasUserVotedInPoll(PDO $pdo, $pollId, $userId)
{
    $stmt = $pdo->prepare(
        'SELECT id
         FROM vote_receipts
         WHERE poll_id = :poll_id AND user_id = :user_id
         LIMIT 1'
    );
    $stmt->execute([
        'poll_id' => $pollId,
        'user_id' => $userId,
    ]);

    return (bool) $stmt->fetch();
}

/**
 * Check whether a poll has any votes.
 *
 * @param PDO $pdo
 * @param int $pollId
 * @return bool
 */
function pollHasVotes(PDO $pdo, $pollId)
{
    $stmt = $pdo->prepare(
        'SELECT id FROM votes WHERE poll_id = :poll_id LIMIT 1'
    );
    $stmt->execute(['poll_id' => $pollId]);
    return (bool) $stmt->fetch();
}

/**
 * Determine whether a poll accepts votes right now.
 *
 * @param array $pollRow
 * @return bool
 */
function isPollAcceptingVotes(array $pollRow)
{
    if (($pollRow['status'] ?? '') !== 'open') {
        return false;
    }

    $now = new DateTimeImmutable('now');

    if (!empty($pollRow['opens_at'])) {
        $opensAt = new DateTimeImmutable((string) $pollRow['opens_at']);
        if ($now < $opensAt) {
            return false;
        }
    }

    if (!empty($pollRow['closes_at'])) {
        $closesAt = new DateTimeImmutable((string) $pollRow['closes_at']);
        if ($now > $closesAt) {
            return false;
        }
    }

    return true;
}

/**
 * Generate a random anonymous vote token.
 *
 * @return string
 */
function generateAnonymousVoteToken()
{
    return bin2hex(random_bytes(32));
}

/**
 * Build vote counts per option for a poll.
 *
 * @param PDO $pdo
 * @param int $pollId
 * @return array{total_votes:int,options:array}
 */
function fetchPollResults(PDO $pdo, $pollId)
{
    $options = fetchPollOptions($pdo, $pollId);
    $countStmt = $pdo->prepare(
        'SELECT option_id, COUNT(*) AS vote_count
         FROM votes
         WHERE poll_id = :poll_id
         GROUP BY option_id'
    );
    $countStmt->execute(['poll_id' => $pollId]);
    $countsByOption = [];

    foreach ($countStmt->fetchAll() as $row) {
        $countsByOption[(int) $row['option_id']] = (int) $row['vote_count'];
    }

    $totalVotes = 0;
    $resultOptions = [];

    foreach ($options as $option) {
        $optionId = (int) $option['id'];
        $voteCount = $countsByOption[$optionId] ?? 0;
        $totalVotes += $voteCount;

        $resultOptions[] = [
            'option_id'     => $optionId,
            'option_text'   => (string) $option['option_text'],
            'display_order' => (int) $option['display_order'],
            'vote_count'    => $voteCount,
            'percentage'    => 0,
        ];
    }

    if ($totalVotes > 0) {
        foreach ($resultOptions as &$resultOption) {
            $resultOption['percentage'] = round(($resultOption['vote_count'] / $totalVotes) * 100, 1);
        }
        unset($resultOption);
    }

    return [
        'total_votes' => $totalVotes,
        'options'     => $resultOptions,
    ];
}

/**
 * Check whether the current user may view poll results.
 *
 * @param PDO   $pdo
 * @param array $user
 * @param array $pollRow
 * @return bool
 */
function canViewPollResults(PDO $pdo, array $user, array $pollRow)
{
    if ($user['role'] === 'admin') {
        return true;
    }

    if (hasUserVotedInPoll($pdo, (int) $pollRow['id'], (int) $user['id'])) {
        return true;
    }

    if (($pollRow['status'] ?? '') === 'closed') {
        return true;
    }

    return false;
}

/**
 * Format poll row for JSON output.
 *
 * @param PDO   $pdo
 * @param array $pollRow
 * @param array $user
 * @param bool  $includeResults
 * @return array
 */
function formatPollRow(PDO $pdo, array $pollRow, array $user, $includeResults = false)
{
    $pollId = (int) $pollRow['id'];
    $options = formatPollOptionRows(fetchPollOptions($pdo, $pollId));
    $userVoted = hasUserVotedInPoll($pdo, $pollId, (int) $user['id']);

    $formatted = [
        'id'                 => $pollId,
        'frontend_id'        => 'poll' . $pollId,
        'question'           => (string) $pollRow['question'],
        'title'              => (string) $pollRow['question'],
        'description'        => $pollRow['description'] !== null ? (string) $pollRow['description'] : '',
        'status'             => (string) $pollRow['status'],
        'opens_at'           => $pollRow['opens_at'] !== null ? (string) $pollRow['opens_at'] : null,
        'closes_at'          => $pollRow['closes_at'] !== null ? (string) $pollRow['closes_at'] : null,
        'created_by_user_id' => $pollRow['created_by_user_id'] !== null ? (int) $pollRow['created_by_user_id'] : null,
        'is_open'            => isPollAcceptingVotes($pollRow),
        'user_voted'         => $userVoted,
        'can_view_results'   => canViewPollResults($pdo, $user, $pollRow),
        'options'            => $options,
        'created_at'         => (string) $pollRow['created_at'],
        'updated_at'         => (string) $pollRow['updated_at'],
    ];

    if ($includeResults && $formatted['can_view_results']) {
        $formatted['results'] = fetchPollResults($pdo, $pollId);
    }

    return $formatted;
}

/**
 * Normalize poll option strings from request payload.
 *
 * @param mixed $rawOptions
 * @return array{ok:bool,message?:string,options?:array}
 */
function normalizePollOptionsPayload($rawOptions)
{
    if (!is_array($rawOptions)) {
        return ['ok' => false, 'message' => 'At least two options are required.'];
    }

    $options = [];
    foreach ($rawOptions as $option) {
        $text = trim((string) $option);
        if ($text === '') {
            continue;
        }
        $options[] = substr($text, 0, 255);
    }

    if (count($options) < 2) {
        return ['ok' => false, 'message' => 'At least two non-empty options are required.'];
    }

    return ['ok' => true, 'options' => $options];
}

/**
 * Normalize poll create payload.
 *
 * @param array $body
 * @return array{ok:bool,message?:string,data?:array}
 */
function normalizePollCreatePayload(array $body)
{
    $question = '';
    if (isset($body['question']) && trim((string) $body['question']) !== '') {
        $question = trim((string) $body['question']);
    } elseif (isset($body['title']) && trim((string) $body['title']) !== '') {
        $question = trim((string) $body['title']);
    }

    if ($question === '') {
        return ['ok' => false, 'message' => 'Poll question is required.'];
    }

    $description = null;
    if (isset($body['description']) && trim((string) $body['description']) !== '') {
        $description = trim((string) $body['description']);
    }

    $optionsResult = normalizePollOptionsPayload($body['options'] ?? null);
    if (!$optionsResult['ok']) {
        return ['ok' => false, 'message' => $optionsResult['message']];
    }

    $status = 'open';
    if (isset($body['status']) && in_array($body['status'], POLL_ALLOWED_STATUSES, true)) {
        $status = $body['status'];
    }

    $opensAt = null;
    if (isset($body['opens_at']) && trim((string) $body['opens_at']) !== '') {
        $opensAt = trim((string) $body['opens_at']);
    }

    $closesAt = null;
    if (isset($body['closes_at']) && trim((string) $body['closes_at']) !== '') {
        $closesAt = trim((string) $body['closes_at']);
    }

    return [
        'ok'   => true,
        'data' => [
            'question'    => substr($question, 0, 255),
            'description' => $description,
            'status'      => $status,
            'opens_at'    => $opensAt,
            'closes_at'   => $closesAt,
            'options'     => $optionsResult['options'],
        ],
    ];
}

/**
 * Normalize poll update payload.
 *
 * @param array $body
 * @return array{ok:bool,message?:string,data?:array}
 */
function normalizePollUpdatePayload(array $body)
{
    if (!array_key_exists('id', $body)) {
        return ['ok' => false, 'message' => 'Poll id is required.'];
    }

    $pollId = parsePollIdFromRequest($body['id']);
    if ($pollId === null) {
        return ['ok' => false, 'message' => 'Invalid poll id.'];
    }

    $data = ['id' => $pollId];

    if (isset($body['question']) && trim((string) $body['question']) !== '') {
        $data['question'] = substr(trim((string) $body['question']), 0, 255);
    } elseif (isset($body['title']) && trim((string) $body['title']) !== '') {
        $data['question'] = substr(trim((string) $body['title']), 0, 255);
    }

    if (array_key_exists('description', $body)) {
        $description = trim((string) $body['description']);
        $data['description'] = $description !== '' ? $description : null;
    }

    if (isset($body['status']) && in_array($body['status'], POLL_ALLOWED_STATUSES, true)) {
        $data['status'] = $body['status'];
    }

    if (array_key_exists('opens_at', $body)) {
        $opensAt = trim((string) $body['opens_at']);
        $data['opens_at'] = $opensAt !== '' ? $opensAt : null;
    }

    if (array_key_exists('closes_at', $body)) {
        $closesAt = trim((string) $body['closes_at']);
        $data['closes_at'] = $closesAt !== '' ? $closesAt : null;
    }

    if (isset($body['options'])) {
        $optionsResult = normalizePollOptionsPayload($body['options']);
        if (!$optionsResult['ok']) {
            return ['ok' => false, 'message' => $optionsResult['message']];
        }
        $data['options'] = $optionsResult['options'];
    }

    return ['ok' => true, 'data' => $data];
}

/**
 * Insert poll options for a new poll.
 *
 * @param PDO   $pdo
 * @param int   $pollId
 * @param array $options
 * @return void
 */
function insertPollOptions(PDO $pdo, $pollId, array $options)
{
    $insertStmt = $pdo->prepare(
        'INSERT INTO poll_options (poll_id, option_text, display_order)
         VALUES (:poll_id, :option_text, :display_order)'
    );

    $order = 1;
    foreach ($options as $optionText) {
        $insertStmt->execute([
            'poll_id'       => $pollId,
            'option_text'   => $optionText,
            'display_order' => $order,
        ]);
        $order++;
    }
}

/**
 * Replace poll options only when no votes exist.
 *
 * @param PDO   $pdo
 * @param int   $pollId
 * @param array $options
 * @return array{ok:bool,message?:string}
 */
function replacePollOptionsIfNoVotes(PDO $pdo, $pollId, array $options)
{
    if (pollHasVotes($pdo, $pollId)) {
        return ['ok' => false, 'message' => 'Options cannot be changed after votes have been cast.'];
    }

    $deleteStmt = $pdo->prepare('DELETE FROM poll_options WHERE poll_id = :poll_id');
    $deleteStmt->execute(['poll_id' => $pollId]);
    insertPollOptions($pdo, $pollId, $options);

    return ['ok' => true];
}

/**
 * Verify option belongs to poll.
 *
 * @param PDO $pdo
 * @param int $pollId
 * @param int $optionId
 * @return bool
 */
function pollOptionBelongsToPoll(PDO $pdo, $pollId, $optionId)
{
    $stmt = $pdo->prepare(
        'SELECT id
         FROM poll_options
         WHERE id = :option_id AND poll_id = :poll_id
         LIMIT 1'
    );
    $stmt->execute([
        'option_id' => $optionId,
        'poll_id'   => $pollId,
    ]);

    return (bool) $stmt->fetch();
}
