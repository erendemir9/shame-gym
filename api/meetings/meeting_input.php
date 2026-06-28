<?php
/**
 * meeting_input.php — shared helpers for meeting APIs.
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/request.php';

/**
 * Parse meeting id from request value.
 *
 * @param mixed $rawId
 * @return int|null
 */
function parseMeetingIdFromRequest($rawId)
{
    if ($rawId === null || $rawId === '') {
        return null;
    }

    if (is_int($rawId) && $rawId > 0) {
        return $rawId;
    }

    if (is_string($rawId) && ctype_digit($rawId)) {
        $meetingId = (int) $rawId;
        return $meetingId > 0 ? $meetingId : null;
    }

    if (is_string($rawId) && preg_match('/^mt(\d+)$/i', $rawId, $matches)) {
        return (int) $matches[1];
    }

    return null;
}

/**
 * Normalize meeting write payload.
 *
 * @param array $body
 * @param bool  $requireId
 * @return array{ok:bool,message?:string,data?:array}
 */
function normalizeMeetingWritePayload(array $body, $requireId = false)
{
    $meetingId = null;
    if ($requireId) {
        if (!array_key_exists('id', $body)) {
            return ['ok' => false, 'message' => 'Meeting id is required.'];
        }
        $meetingId = parseMeetingIdFromRequest($body['id']);
        if ($meetingId === null) {
            return ['ok' => false, 'message' => 'Invalid meeting id.'];
        }
    }

    $title = isset($body['title']) ? trim((string) $body['title']) : '';
    if ($title === '') {
        return ['ok' => false, 'message' => 'Title is required.'];
    }

    $meetingDate = null;
    if (isset($body['meeting_date']) && trim((string) $body['meeting_date']) !== '') {
        $meetingDate = trim((string) $body['meeting_date']);
    } elseif (isset($body['date']) && trim((string) $body['date']) !== '') {
        $meetingDate = trim((string) $body['date']);
    }

    if ($meetingDate === null || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $meetingDate)) {
        return ['ok' => false, 'message' => 'Valid meeting date is required (YYYY-MM-DD).'];
    }

    $meetingTime = null;
    if (isset($body['meeting_time']) && trim((string) $body['meeting_time']) !== '') {
        $meetingTime = trim((string) $body['meeting_time']);
    } elseif (isset($body['time']) && trim((string) $body['time']) !== '') {
        $meetingTime = trim((string) $body['time']);
    }

    if ($meetingTime === null || $meetingTime === '') {
        return ['ok' => false, 'message' => 'Meeting time is required.'];
    }

    if (preg_match('/^\d{2}:\d{2}$/', $meetingTime)) {
        $meetingTime .= ':00';
    }

    $location = null;
    if (isset($body['location']) && trim((string) $body['location']) !== '') {
        $location = trim((string) $body['location']);
    }

    $notes = null;
    if (isset($body['notes']) && trim((string) $body['notes']) !== '') {
        $notes = trim((string) $body['notes']);
    } elseif (isset($body['agenda']) && trim((string) $body['agenda']) !== '') {
        $notes = trim((string) $body['agenda']);
    }

    $attendeeEmails = [];
    if (isset($body['attendee_emails']) && is_array($body['attendee_emails'])) {
        foreach ($body['attendee_emails'] as $email) {
            $normalized = strtolower(trim((string) $email));
            if ($normalized !== '') {
                $attendeeEmails[$normalized] = $normalized;
            }
        }
    }

    if (isset($body['attendees']) && is_array($body['attendees'])) {
        foreach ($body['attendees'] as $email) {
            $normalized = strtolower(trim((string) $email));
            if ($normalized !== '') {
                $attendeeEmails[$normalized] = $normalized;
            }
        }
    }

    $attendeeIds = [];
    if (isset($body['attendee_ids']) && is_array($body['attendee_ids'])) {
        foreach ($body['attendee_ids'] as $userId) {
            $id = (int) $userId;
            if ($id > 0) {
                $attendeeIds[$id] = $id;
            }
        }
    }

    if (count($attendeeEmails) === 0 && count($attendeeIds) === 0) {
        return ['ok' => false, 'message' => 'At least one attendee is required.'];
    }

    $data = [
        'title'           => $title,
        'meeting_date'    => $meetingDate,
        'meeting_time'    => $meetingTime,
        'location'        => $location,
        'notes'           => $notes,
        'attendee_emails' => array_values($attendeeEmails),
        'attendee_ids'    => array_values($attendeeIds),
    ];

    if ($requireId) {
        $data['id'] = $meetingId;
    }

    return ['ok' => true, 'data' => $data];
}

/**
 * Load attendees for a meeting.
 *
 * @param PDO $pdo
 * @param int $meetingId
 * @return array
 */
function fetchMeetingAttendees(PDO $pdo, $meetingId)
{
    $stmt = $pdo->prepare(
        'SELECT id, meeting_id, user_id, attendee_email, attendee_name, response_status
         FROM meeting_attendees
         WHERE meeting_id = :meeting_id
         ORDER BY attendee_name ASC, attendee_email ASC'
    );
    $stmt->execute(['meeting_id' => $meetingId]);
    return $stmt->fetchAll();
}

/**
 * Format attendee rows for JSON output.
 *
 * @param array $rows
 * @return array
 */
function formatMeetingAttendeeRows(array $rows)
{
    $attendees = [];
    foreach ($rows as $row) {
        $attendees[] = [
            'id'              => (int) $row['id'],
            'user_id'         => $row['user_id'] !== null ? (int) $row['user_id'] : null,
            'attendee_email'  => (string) $row['attendee_email'],
            'attendee_name'   => $row['attendee_name'] !== null ? (string) $row['attendee_name'] : null,
            'response_status' => (string) $row['response_status'],
        ];
    }
    return $attendees;
}

/**
 * Format meeting row for JSON output.
 *
 * @param PDO   $pdo
 * @param array $row
 * @return array
 */
function formatMeetingRow(PDO $pdo, array $row)
{
    $attendeeRows = fetchMeetingAttendees($pdo, (int) $row['id']);
    $attendees = formatMeetingAttendeeRows($attendeeRows);
    $attendeeEmails = [];

    foreach ($attendees as $attendee) {
        $attendeeEmails[] = $attendee['attendee_email'];
    }

    return [
        'id'               => (int) $row['id'],
        'frontend_id'      => 'mt' . $row['id'],
        'title'            => (string) $row['title'],
        'meeting_date'     => (string) $row['meeting_date'],
        'meeting_time'     => substr((string) $row['meeting_time'], 0, 5),
        'date'             => (string) $row['meeting_date'],
        'time'             => substr((string) $row['meeting_time'], 0, 5),
        'location'         => $row['location'] !== null ? (string) $row['location'] : '',
        'notes'            => $row['notes'] !== null ? (string) $row['notes'] : '',
        'status'           => (string) $row['status'],
        'created_by_user_id' => $row['created_by_user_id'] !== null ? (int) $row['created_by_user_id'] : null,
        'attendees'        => $attendeeEmails,
        'attendee_details' => $attendees,
        'created_at'       => (string) $row['created_at'],
        'updated_at'       => (string) $row['updated_at'],
    ];
}

/**
 * Load one meeting row by id.
 *
 * @param PDO $pdo
 * @param int $meetingId
 * @return array|null
 */
function fetchMeetingRowById(PDO $pdo, $meetingId)
{
    $stmt = $pdo->prepare(
        'SELECT id, title, meeting_date, meeting_time, location, notes,
                created_by_user_id, status, created_at, updated_at
         FROM meetings
         WHERE id = :id
         LIMIT 1'
    );
    $stmt->execute(['id' => $meetingId]);
    $row = $stmt->fetch();

    return $row ?: null;
}

/**
 * Resolve attendee list into rows for insert.
 *
 * @param PDO   $pdo
 * @param array $attendeeEmails
 * @param array $attendeeIds
 * @return array{ok:bool,message?:string,attendees?:array}
 */
function resolveMeetingAttendees(PDO $pdo, array $attendeeEmails, array $attendeeIds)
{
    $resolved = [];
    $seenEmails = [];

    foreach ($attendeeIds as $userId) {
        $stmt = $pdo->prepare(
            'SELECT id, email, full_name, role
             FROM users
             WHERE id = :id AND is_active = 1
             LIMIT 1'
        );
        $stmt->execute(['id' => $userId]);
        $user = $stmt->fetch();

        if (!$user) {
            return ['ok' => false, 'message' => 'Attendee user id ' . $userId . ' not found.'];
        }

        if (!in_array($user['role'], ['admin', 'trainer'], true)) {
            return ['ok' => false, 'message' => 'Only staff users may be meeting attendees.'];
        }

        $email = strtolower(trim((string) $user['email']));
        if (isset($seenEmails[$email])) {
            continue;
        }

        $seenEmails[$email] = true;
        $resolved[] = [
            'user_id'        => (int) $user['id'],
            'attendee_email' => $email,
            'attendee_name'  => (string) $user['full_name'],
        ];
    }

    foreach ($attendeeEmails as $email) {
        $normalized = strtolower(trim((string) $email));
        if ($normalized === '' || isset($seenEmails[$normalized])) {
            continue;
        }

        $stmt = $pdo->prepare(
            'SELECT id, email, full_name, role
             FROM users
             WHERE email = :email AND is_active = 1
             LIMIT 1'
        );
        $stmt->execute(['email' => $normalized]);
        $user = $stmt->fetch();

        if ($user && !in_array($user['role'], ['admin', 'trainer'], true)) {
            return ['ok' => false, 'message' => 'Only staff users may be meeting attendees.'];
        }

        $seenEmails[$normalized] = true;
        $resolved[] = [
            'user_id'        => $user ? (int) $user['id'] : null,
            'attendee_email' => $normalized,
            'attendee_name'  => $user ? (string) $user['full_name'] : null,
        ];
    }

    if (count($resolved) === 0) {
        return ['ok' => false, 'message' => 'At least one attendee is required.'];
    }

    return ['ok' => true, 'attendees' => $resolved];
}

/**
 * Replace attendees for a meeting inside an open transaction.
 *
 * @param PDO   $pdo
 * @param int   $meetingId
 * @param array $attendees
 * @return void
 */
function replaceMeetingAttendees(PDO $pdo, $meetingId, array $attendees)
{
    $deleteStmt = $pdo->prepare('DELETE FROM meeting_attendees WHERE meeting_id = :meeting_id');
    $deleteStmt->execute(['meeting_id' => $meetingId]);

    $insertSql = 'INSERT INTO meeting_attendees
        (meeting_id, user_id, attendee_email, attendee_name, response_status)
        VALUES
        (:meeting_id, :user_id, :attendee_email, :attendee_name, :response_status)';

    $insertStmt = $pdo->prepare($insertSql);

    foreach ($attendees as $attendee) {
        $insertStmt->execute([
            'meeting_id'       => $meetingId,
            'user_id'          => $attendee['user_id'],
            'attendee_email'   => $attendee['attendee_email'],
            'attendee_name'    => $attendee['attendee_name'],
            'response_status'  => 'invited',
        ]);
    }
}

/**
 * Check whether user can view a meeting.
 *
 * @param PDO   $pdo
 * @param array $user
 * @param array $meetingRow
 * @return bool
 */
function canAccessMeeting(PDO $pdo, array $user, array $meetingRow)
{
    if ($user['role'] === 'admin') {
        return true;
    }

    if ($user['role'] === 'trainer') {
        $stmt = $pdo->prepare(
            'SELECT id
             FROM meeting_attendees
             WHERE meeting_id = :meeting_id
               AND (user_id = :user_id OR attendee_email = :email)
             LIMIT 1'
        );
        $stmt->execute([
            'meeting_id' => (int) $meetingRow['id'],
            'user_id'    => (int) $user['id'],
            'email'      => normalizeEmail($user['email']),
        ]);

        return (bool) $stmt->fetch();
    }

    return false;
}
