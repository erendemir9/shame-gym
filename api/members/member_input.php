<?php
/**
 * member_input.php — shared helpers for member create/update payloads.
 */

declare(strict_types=1);

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
 * Normalize create/update JSON body into database-ready member fields.
 *
 * @param array $body
 * @param bool  $requireId
 * @return array{ok:bool,message?:string,data?:array}
 */
function normalizeMemberWritePayload(array $body, $requireId = false)
{
    $memberId = null;
    if ($requireId) {
        if (!array_key_exists('id', $body)) {
            return ['ok' => false, 'message' => 'Member id is required.'];
        }
        $memberId = parseMemberIdFromRequest($body['id']);
        if ($memberId === null) {
            return ['ok' => false, 'message' => 'Invalid member id.'];
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

    $membershipType = '';
    if (isset($body['membership_type'])) {
        $membershipType = trim((string) $body['membership_type']);
    } elseif (isset($body['type'])) {
        $membershipType = trim((string) $body['type']);
    } elseif (isset($body['membershipType'])) {
        $membershipType = trim((string) $body['membershipType']);
    }

    $allowedTypes = ['Basic', 'Premium', 'VIP'];
    if (!in_array($membershipType, $allowedTypes, true)) {
        return ['ok' => false, 'message' => 'Choose a valid membership type.'];
    }

    $startDate = null;
    if (isset($body['start_date']) && trim((string) $body['start_date']) !== '') {
        $startDate = trim((string) $body['start_date']);
    } elseif (isset($body['startDate']) && trim((string) $body['startDate']) !== '') {
        $startDate = trim((string) $body['startDate']);
    }

    if ($startDate === null || $startDate === '') {
        return ['ok' => false, 'message' => 'Start date is required.'];
    }

    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $startDate)) {
        return ['ok' => false, 'message' => 'Start date must use YYYY-MM-DD format.'];
    }

    $phone = null;
    if (isset($body['phone']) && trim((string) $body['phone']) !== '') {
        $phone = trim((string) $body['phone']);
    }

    $assignedTrainerId = null;
    if (array_key_exists('assigned_trainer_id', $body)) {
        $assignedTrainerId = parseTrainerIdFromRequest($body['assigned_trainer_id']);
        if ($body['assigned_trainer_id'] !== null && $body['assigned_trainer_id'] !== '' && $assignedTrainerId === null) {
            return ['ok' => false, 'message' => 'Invalid assigned trainer id.'];
        }
    } elseif (array_key_exists('trainerId', $body)) {
        $assignedTrainerId = parseTrainerIdFromRequest($body['trainerId']);
        if ($body['trainerId'] !== null && $body['trainerId'] !== '' && $assignedTrainerId === null) {
            return ['ok' => false, 'message' => 'Invalid assigned trainer id.'];
        }
    }

    $status = 'active';
    if (isset($body['status']) && trim((string) $body['status']) !== '') {
        $status = trim((string) $body['status']);
    }

    $allowedStatuses = ['active', 'inactive', 'suspended'];
    if (!in_array($status, $allowedStatuses, true)) {
        return ['ok' => false, 'message' => 'Invalid member status.'];
    }

    $data = [
        'full_name'            => $fullName,
        'email'                => $email,
        'phone'                => $phone,
        'membership_type'      => $membershipType,
        'start_date'           => $startDate,
        'assigned_trainer_id'  => $assignedTrainerId,
        'status'               => $status,
    ];

    if ($requireId) {
        $data['id'] = $memberId;
    }

    return ['ok' => true, 'data' => $data];
}

/**
 * Load a member row with trainer name for JSON output.
 *
 * @param PDO $pdo
 * @param int $memberId
 * @return array|null
 */
function fetchMemberRowById(PDO $pdo, $memberId)
{
    $sql = 'SELECT m.id, m.full_name, m.email, m.phone, m.membership_type, m.start_date,
                   m.assigned_trainer_id, t.full_name AS assigned_trainer_name,
                   m.status, m.created_at, m.updated_at,
                   u.id AS account_user_id,
                   u.email AS account_email,
                   u.role AS account_role,
                   u.needs_password_setup AS account_needs_password_setup,
                   u.is_active AS account_is_active
            FROM members m
            LEFT JOIN trainers t ON t.id = m.assigned_trainer_id
            LEFT JOIN users u ON u.linked_member_id = m.id AND u.role = \'member\'
            WHERE m.id = :id
            LIMIT 1';

    $stmt = $pdo->prepare($sql);
    $stmt->execute(['id' => $memberId]);
    $row = $stmt->fetch();

    return $row ?: null;
}

/**
 * Verify that a trainer id exists when provided.
 *
 * @param PDO   $pdo
 * @param int|null $trainerId
 * @return bool
 */
function trainerExists(PDO $pdo, $trainerId)
{
    if ($trainerId === null) {
        return true;
    }

    $stmt = $pdo->prepare('SELECT id FROM trainers WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => $trainerId]);

    return (bool) $stmt->fetch();
}
