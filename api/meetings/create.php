<?php
/**
 * meetings/create.php — schedule a staff meeting (admin only).
 *
 * POST api/meetings/create.php
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

    $normalized = normalizeMeetingWritePayload($body, false);
    if (!$normalized['ok']) {
        errorResponse($normalized['message'], 400);
    }

    $meetingData = $normalized['data'];
    $pdo = getDatabaseConnection();

    $attendeeResult = resolveMeetingAttendees(
        $pdo,
        $meetingData['attendee_emails'],
        $meetingData['attendee_ids']
    );

    if (!$attendeeResult['ok']) {
        errorResponse($attendeeResult['message'], 400);
    }

    $pdo->beginTransaction();

    $insertSql = 'INSERT INTO meetings
        (title, meeting_date, meeting_time, location, notes, created_by_user_id, status)
        VALUES
        (:title, :meeting_date, :meeting_time, :location, :notes, :created_by_user_id, :status)';

    $insertStmt = $pdo->prepare($insertSql);
    $insertStmt->execute([
        'title'              => $meetingData['title'],
        'meeting_date'       => $meetingData['meeting_date'],
        'meeting_time'       => $meetingData['meeting_time'],
        'location'           => $meetingData['location'],
        'notes'              => $meetingData['notes'],
        'created_by_user_id' => (int) $user['id'],
        'status'             => 'scheduled',
    ]);

    $meetingId = (int) $pdo->lastInsertId();
    replaceMeetingAttendees($pdo, $meetingId, $attendeeResult['attendees']);

    $pdo->commit();

    $row = fetchMeetingRowById($pdo, $meetingId);
    if (!$row) {
        errorResponse('Meeting was created but could not be loaded.', 500);
    }

    successResponse([
        'meeting' => formatMeetingRow($pdo, $row),
    ], 'Meeting created successfully', 200);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    errorResponse('Failed to create meeting.', 500, [
        'error' => $e->getMessage(),
    ]);
}
