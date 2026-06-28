<?php
/**
 * class_input.php — shared helpers for class create/update payloads.
 */

declare(strict_types=1);

/**
 * Convert a request id value to a numeric class id.
 *
 * @param mixed $rawId
 * @return int|null
 */
function parseClassIdFromRequest($rawId)
{
    if ($rawId === null || $rawId === '') {
        return null;
    }

    if (is_int($rawId) && $rawId > 0) {
        return $rawId;
    }

    if (is_string($rawId) && ctype_digit($rawId)) {
        $classId = (int) $rawId;
        return $classId > 0 ? $classId : null;
    }

    if (is_string($rawId) && preg_match('/^s(\d+)$/i', $rawId, $matches)) {
        return (int) $matches[1];
    }

    return null;
}

/**
 * Convert a trainer id value to a numeric trainer id.
 *
 * @param mixed $rawId
 * @return int|null
 */
function parseTrainerIdFromRequest($rawId)
{
    if ($rawId === null || $rawId === '') {
        return null;
    }

    if (is_int($rawId) && $rawId > 0) {
        return $rawId;
    }

    if (is_string($rawId) && ctype_digit($rawId)) {
        $trainerId = (int) $rawId;
        return $trainerId > 0 ? $trainerId : null;
    }

    if (is_string($rawId) && preg_match('/^t(\d+)$/i', $rawId, $matches)) {
        return (int) $matches[1];
    }

    return null;
}

/**
 * Normalize a class time value for MySQL TIME column.
 *
 * @param string $time
 * @return string|null
 */
function normalizeClassTime($time)
{
    $time = trim((string) $time);

    if (preg_match('/^\d{2}:\d{2}$/', $time)) {
        return $time . ':00';
    }

    if (preg_match('/^\d{2}:\d{2}:\d{2}$/', $time)) {
        return $time;
    }

    return null;
}

/**
 * Normalize create/update JSON body into database-ready class fields.
 *
 * @param array $body
 * @param bool  $requireId
 * @return array{ok:bool,message?:string,data?:array}
 */
function normalizeClassWritePayload(array $body, $requireId = false)
{
    $classId = null;
    if ($requireId) {
        if (!array_key_exists('id', $body)) {
            return ['ok' => false, 'message' => 'Class id is required.'];
        }
        $classId = parseClassIdFromRequest($body['id']);
        if ($classId === null) {
            return ['ok' => false, 'message' => 'Invalid class id.'];
        }
    }

    $className = '';
    if (isset($body['class_name'])) {
        $className = trim((string) $body['class_name']);
    } elseif (isset($body['className'])) {
        $className = trim((string) $body['className']);
    }

    if ($className === '') {
        return ['ok' => false, 'message' => 'Class name is required.'];
    }

    $trainerId = null;
    if (array_key_exists('trainer_id', $body)) {
        $trainerId = parseTrainerIdFromRequest($body['trainer_id']);
    } elseif (array_key_exists('trainerId', $body)) {
        $trainerId = parseTrainerIdFromRequest($body['trainerId']);
    }

    if ($trainerId === null) {
        return ['ok' => false, 'message' => 'Trainer id is required.'];
    }

    $classDate = null;
    if (isset($body['class_date']) && trim((string) $body['class_date']) !== '') {
        $classDate = trim((string) $body['class_date']);
    } elseif (isset($body['date']) && trim((string) $body['date']) !== '') {
        $classDate = trim((string) $body['date']);
    }

    if ($classDate === null || $classDate === '') {
        return ['ok' => false, 'message' => 'Class date is required.'];
    }

    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $classDate)) {
        return ['ok' => false, 'message' => 'Class date must use YYYY-MM-DD format.'];
    }

    $classTime = null;
    if (isset($body['class_time']) && trim((string) $body['class_time']) !== '') {
        $classTime = normalizeClassTime($body['class_time']);
    } elseif (isset($body['time']) && trim((string) $body['time']) !== '') {
        $classTime = normalizeClassTime($body['time']);
    }

    if ($classTime === null) {
        return ['ok' => false, 'message' => 'Class time is required. Use HH:MM format.'];
    }

    $durationMinutes = null;
    if (isset($body['duration_minutes'])) {
        $durationMinutes = (int) $body['duration_minutes'];
    } elseif (isset($body['duration'])) {
        $durationMinutes = (int) $body['duration'];
    }

    if ($durationMinutes === null || $durationMinutes <= 0) {
        return ['ok' => false, 'message' => 'Duration must be a positive number of minutes.'];
    }

    $capacity = null;
    if (isset($body['capacity'])) {
        $capacity = (int) $body['capacity'];
    }

    if ($capacity === null || $capacity <= 0) {
        return ['ok' => false, 'message' => 'Capacity must be a positive number.'];
    }

    $status = 'scheduled';
    if (isset($body['status']) && trim((string) $body['status']) !== '') {
        $status = trim((string) $body['status']);
    }

    $allowedStatuses = ['scheduled', 'cancelled', 'completed'];
    if (!in_array($status, $allowedStatuses, true)) {
        return ['ok' => false, 'message' => 'Invalid class status.'];
    }

    $data = [
        'class_name'       => $className,
        'trainer_id'       => $trainerId,
        'class_date'       => $classDate,
        'class_time'       => $classTime,
        'duration_minutes' => $durationMinutes,
        'capacity'         => $capacity,
        'status'           => $status,
    ];

    if ($requireId) {
        $data['id'] = $classId;
    }

    return ['ok' => true, 'data' => $data];
}

/**
 * Verify that an active trainer exists.
 *
 * @param PDO $pdo
 * @param int $trainerId
 * @return bool
 */
function activeTrainerExists(PDO $pdo, $trainerId)
{
    $stmt = $pdo->prepare('SELECT id FROM trainers WHERE id = :id AND status = :status LIMIT 1');
    $stmt->execute([
        'id'     => $trainerId,
        'status' => 'active',
    ]);

    return (bool) $stmt->fetch();
}

/**
 * Load a class row with trainer name and enrollment count.
 *
 * @param PDO $pdo
 * @param int $classId
 * @return array|null
 */
function fetchClassRowById(PDO $pdo, $classId)
{
    $sql = 'SELECT c.id, c.class_name, c.trainer_id, t.full_name AS trainer_name,
                   c.class_date, c.class_time, c.duration_minutes, c.capacity, c.status,
                   c.created_at, c.updated_at,
                   (SELECT COUNT(*)
                    FROM enrollments e
                    WHERE e.class_id = c.id AND e.status = \'enrolled\') AS enrolled_count
            FROM classes c
            INNER JOIN trainers t ON t.id = c.trainer_id
            WHERE c.id = :id
            LIMIT 1';

    $stmt = $pdo->prepare($sql);
    $stmt->execute(['id' => $classId]);
    $row = $stmt->fetch();

    return $row ?: null;
}
