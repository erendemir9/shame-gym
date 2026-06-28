<?php
/**
 * members/delete.php — admin-only soft delete for a member.
 *
 * POST api/members/delete.php
 * Body: { "id": 7 } or { "id": "m7" }
 *
 * Sets status to inactive. Does not remove the row or related records.
 */

declare(strict_types=1);

ini_set('display_errors', '0');
error_reporting(E_ALL);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/auth.php';
require_once __DIR__ . '/../config/request.php';

requireHttpMethod('POST');

/**
 * Convert a request id value to a numeric member id.
 *
 * @param mixed $rawId
 * @return int|null
 */
function parseMemberIdFromRequest($rawId)
{
    if ($rawId === null || $rawId === '') {
        return null;
    }

    if (is_int($rawId) && $rawId > 0) {
        return $rawId;
    }

    if (is_string($rawId) && ctype_digit($rawId)) {
        $memberId = (int) $rawId;
        return $memberId > 0 ? $memberId : null;
    }

    if (is_string($rawId) && preg_match('/^m(\d+)$/i', $rawId, $matches)) {
        return (int) $matches[1];
    }

    return null;
}

try {
    requireRole('admin');

    $body = getJsonRequestBody();
    if ($body === null || !array_key_exists('id', $body)) {
        errorResponse('Member id is required.', 400);
    }

    $memberId = parseMemberIdFromRequest($body['id']);
    if ($memberId === null) {
        errorResponse('Invalid member id.', 400);
    }

    $pdo = getDatabaseConnection();

    $selectSql = 'SELECT id, status FROM members WHERE id = :id LIMIT 1';
    $selectStmt = $pdo->prepare($selectSql);
    $selectStmt->execute(['id' => $memberId]);
    $member = $selectStmt->fetch();

    if (!$member) {
        errorResponse('Member not found.', 404);
    }

    if ($member['status'] === 'inactive') {
        errorResponse('Member is already inactive.', 409);
    }

    $updateSql = 'UPDATE members
                  SET status = :status, updated_at = CURRENT_TIMESTAMP
                  WHERE id = :id';
    $updateStmt = $pdo->prepare($updateSql);
    $updateStmt->execute([
        'status' => 'inactive',
        'id'     => $memberId,
    ]);

    successResponse(['member_id' => $memberId], 'Member deleted successfully');
} catch (Throwable $e) {
    errorResponse('Failed to delete member.', 500, [
        'error' => $e->getMessage(),
    ]);
}
