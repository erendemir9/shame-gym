<?php
/**
 * trainer_input.php — shared helpers for trainer create/update payloads.
 */

declare(strict_types=1);

/**
 * Convert a request id value to a numeric trainer id.
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
 * Normalize create/update JSON body into database-ready trainer fields.
 *
 * @param array $body
 * @param bool  $requireId
 * @return array{ok:bool,message?:string,data?:array}
 */
function normalizeTrainerWritePayload(array $body, $requireId = false)
{
    $trainerId = null;
    if ($requireId) {
        if (!array_key_exists('id', $body)) {
            return ['ok' => false, 'message' => 'Trainer id is required.'];
        }
        $trainerId = parseTrainerIdFromRequest($body['id']);
        if ($trainerId === null) {
            return ['ok' => false, 'message' => 'Invalid trainer id.'];
        }
    }

    $fullName = '';
    if (isset($body['full_name'])) {
        $fullName = trim((string) $body['full_name']);
    } elseif (isset($body['name'])) {
        $fullName = trim((string) $body['name']);
    }

    if ($fullName === '') {
        return ['ok' => false, 'message' => 'Full name is required.'];
    }

    if (!isset($body['email']) || trim((string) $body['email']) === '') {
        return ['ok' => false, 'message' => 'Email is required.'];
    }

    $email = strtolower(trim((string) $body['email']));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return ['ok' => false, 'message' => 'Enter a valid email address.'];
    }

    $specialization = '';
    if (isset($body['specialization']) && trim((string) $body['specialization']) !== '') {
        $specialization = trim((string) $body['specialization']);
    }

    if ($specialization === '') {
        return ['ok' => false, 'message' => 'Specialization is required.'];
    }

    $availability = '';
    if (isset($body['availability']) && trim((string) $body['availability']) !== '') {
        $availability = trim((string) $body['availability']);
    }

    if ($availability === '') {
        return ['ok' => false, 'message' => 'Availability is required.'];
    }

    $phone = null;
    if (isset($body['phone']) && trim((string) $body['phone']) !== '') {
        $phone = trim((string) $body['phone']);
    }

    $status = 'active';
    if (isset($body['status']) && trim((string) $body['status']) !== '') {
        $status = trim((string) $body['status']);
    }

    $allowedStatuses = ['active', 'inactive'];
    if (!in_array($status, $allowedStatuses, true)) {
        return ['ok' => false, 'message' => 'Invalid trainer status.'];
    }

    $data = [
        'full_name'       => $fullName,
        'email'           => $email,
        'phone'           => $phone,
        'specialization'  => $specialization,
        'availability'    => $availability,
        'status'          => $status,
    ];

    if ($requireId) {
        $data['id'] = $trainerId;
    }

    return ['ok' => true, 'data' => $data];
}

/**
 * Load a trainer row for JSON output.
 *
 * @param PDO $pdo
 * @param int $trainerId
 * @return array|null
 */
function fetchTrainerRowById(PDO $pdo, $trainerId)
{
    $sql = 'SELECT id, full_name, email, phone, specialization, availability, status, created_at, updated_at
            FROM trainers
            WHERE id = :id
            LIMIT 1';

    $stmt = $pdo->prepare($sql);
    $stmt->execute(['id' => $trainerId]);
    $row = $stmt->fetch();

    return $row ?: null;
}
