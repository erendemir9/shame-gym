<?php
/**
 * meetings/delete.php — cancel a staff meeting (admin only, soft delete).
 *
 * POST api/meetings/delete.php
 */

declare(strict_types=1);

ini_set('display_errors', '0');
error_reporting(E_ALL);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/auth.php';
require_once __DIR__ . '/../config/request.php';
require_once __DIR__ . '/meeting_input.php';

requireHttpMethod('POST');

try {
    $user = requireRole('admin');

    $body = getJsonRequestBody();
    if ($body === null) {
        errorResponse('Request body is required.', 400);
    }

    $meetingId = parseMeetingIdFromRequest($body['id'] ?? null);
    if ($meetingId === null) {
        errorResponse('Meeting id is required.', 400);
    }

    $pdo = getDatabaseConnection();
    $existing = fetchMeetingRowById($pdo, $meetingId);

    if (!$existing) {
        errorResponse('Meeting not found.', 404);
    }

    $stmt = $pdo->prepare(
        'UPDATE meetings
         SET status = :status, updated_at = CURRENT_TIMESTAMP
         WHERE id = :id'
    );
    $stmt->execute([
        'status' => 'cancelled',
        'id'     => $meetingId,
    ]);

    successResponse([
        'id' => $meetingId,
    ], 'Meeting cancelled successfully', 200);
} catch (Throwable $e) {
    errorResponse('Failed to cancel meeting.', 500, [
        'error' => $e->getMessage(),
    ]);
}
