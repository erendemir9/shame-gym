<?php
/**
 * meetings/get.php — fetch one meeting by id.
 *
 * GET api/meetings/get.php?id=1
 */

declare(strict_types=1);

ini_set('display_errors', '0');
error_reporting(E_ALL);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/auth.php';
require_once __DIR__ . '/../config/request.php';
require_once __DIR__ . '/meeting_input.php';

requireHttpMethod('GET');

try {
    $user = requireLogin();

    if ($user['role'] === 'member') {
        errorResponse('You do not have permission to view staff meetings.', 403);
    }

    $meetingId = parseMeetingIdFromRequest(getQueryString('id'));
    if ($meetingId === null) {
        errorResponse('Meeting id is required.', 400);
    }

    $pdo = getDatabaseConnection();
    $row = fetchMeetingRowById($pdo, $meetingId);

    if (!$row) {
        errorResponse('Meeting not found.', 404);
    }

    if (!canAccessMeeting($pdo, $user, $row)) {
        errorResponse('You do not have permission to view this meeting.', 403);
    }

    successResponse([
        'meeting' => formatMeetingRow($pdo, $row),
    ], 'Meeting loaded successfully');
} catch (Throwable $e) {
    errorResponse('Failed to load meeting.', 500, [
        'error' => $e->getMessage(),
    ]);
}
