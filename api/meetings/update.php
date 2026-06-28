<?php
/**
 * meetings/update.php — update a staff meeting (admin only).
 *
 * POST api/meetings/update.php
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

    $normalized = normalizeMeetingWritePayload($body, true);
    if (!$normalized['ok']) {
        errorResponse($normalized['message'], 400);
    }

    $meetingData = $normalized['data'];
    $meetingId = (int) $meetingData['id'];
    $pdo = getDatabaseConnection();

    $existing = fetchMeetingRowById($pdo, $meetingId);
    if (!$existing) {
        errorResponse('Meeting not found.', 404);
    }

    if ($existing['status'] === 'cancelled') {
        errorResponse('Cancelled meetings cannot be edited.', 400);
    }

    $attendeeResult = resolveMeetingAttendees(
        $pdo,
        $meetingData['attendee_emails'],
        $meetingData['attendee_ids']
    );

    if (!$attendeeResult['ok']) {
        errorResponse($attendeeResult['message'], 400);
    }

    $pdo->beginTransaction();

    $updateSql = 'UPDATE meetings
                  SET title = :title,
                      meeting_date = :meeting_date,
                      meeting_time = :meeting_time,
                      location = :location,
                      notes = :notes,
                      updated_at = CURRENT_TIMESTAMP
                  WHERE id = :id';

    $updateStmt = $pdo->prepare($updateSql);
    $updateStmt->execute([
        'title'        => $meetingData['title'],
        'meeting_date' => $meetingData['meeting_date'],
        'meeting_time' => $meetingData['meeting_time'],
        'location'     => $meetingData['location'],
        'notes'        => $meetingData['notes'],
        'id'           => $meetingId,
    ]);

    replaceMeetingAttendees($pdo, $meetingId, $attendeeResult['attendees']);

    $pdo->commit();

    $row = fetchMeetingRowById($pdo, $meetingId);
    if (!$row) {
        errorResponse('Meeting was updated but could not be loaded.', 500);
    }

    successResponse([
        'meeting' => formatMeetingRow($pdo, $row),
    ], 'Meeting updated successfully', 200);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    errorResponse('Failed to update meeting.', 500, [
        'error' => $e->getMessage(),
    ]);
}
