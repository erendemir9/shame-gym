<?php
/**
 * profile_input.php — validation helpers for profile self-edit.
 */

declare(strict_types=1);

/**
 * Normalize profile update JSON into database-ready fields.
 *
 * @param array $body
 * @return array{ok:bool,message?:string,data?:array}
 */
function normalizeProfileUpdatePayload(array $body)
{
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

    $phone = null;
    if (isset($body['phone']) && trim((string) $body['phone']) !== '') {
        $phone = trim((string) $body['phone']);
        if (strlen($phone) > 40) {
            return ['ok' => false, 'message' => 'Phone number is too long.'];
        }
    }

    return [
        'ok'   => true,
        'data' => [
            'full_name' => $fullName,
            'email'     => $email,
            'phone'     => $phone,
        ],
    ];
}

/**
 * Load a user row from the database by id.
 *
 * @param PDO $pdo
 * @param int $userId
 * @return array|null
 */
function fetchUserRowById(PDO $pdo, $userId)
{
    $sql = 'SELECT id, email, full_name, role, linked_member_id, linked_trainer_id,
                   needs_password_setup, is_active
            FROM users
            WHERE id = :id
            LIMIT 1';

    $stmt = $pdo->prepare($sql);
    $stmt->execute(['id' => $userId]);
    $row = $stmt->fetch();

    return $row ?: null;
}

/**
 * Build safe user payload for profile API responses.
 *
 * @param array $userRow
 * @return array
 */
function formatProfileUserPayload(array $userRow)
{
    return [
        'id'                   => (int) $userRow['id'],
        'email'                => (string) $userRow['email'],
        'full_name'            => (string) $userRow['full_name'],
        'role'                 => (string) $userRow['role'],
        'linked_member_id'     => $userRow['linked_member_id'] !== null ? (int) $userRow['linked_member_id'] : null,
        'linked_trainer_id'    => $userRow['linked_trainer_id'] !== null ? (int) $userRow['linked_trainer_id'] : null,
        'needs_password_setup' => (int) $userRow['needs_password_setup'],
        'is_active'            => (int) $userRow['is_active'],
    ];
}

/**
 * Build profile details for the logged-in user.
 *
 * @param PDO   $pdo
 * @param array $userRow
 * @return array
 */
function buildProfileDetails(PDO $pdo, array $userRow)
{
    $role = (string) $userRow['role'];
    $profile = [
        'full_name'        => (string) $userRow['full_name'],
        'email'            => (string) $userRow['email'],
        'phone'            => null,
        'membership_type'  => null,
        'start_date'       => null,
        'specialization'   => null,
        'availability'     => null,
    ];

    if ($role === 'member' && $userRow['linked_member_id'] !== null) {
        $memberId = (int) $userRow['linked_member_id'];
        $stmt = $pdo->prepare(
            'SELECT full_name, email, phone, membership_type, start_date, status
             FROM members
             WHERE id = :id
             LIMIT 1'
        );
        $stmt->execute(['id' => $memberId]);
        $member = $stmt->fetch();

        if ($member) {
            $profile['full_name'] = (string) $member['full_name'];
            $profile['email'] = (string) $member['email'];
            $profile['phone'] = $member['phone'] !== null ? (string) $member['phone'] : null;
            $profile['membership_type'] = (string) $member['membership_type'];
            $profile['start_date'] = $member['start_date'] !== null ? (string) $member['start_date'] : null;
            $profile['member_status'] = (string) $member['status'];
        }
    } elseif ($role === 'trainer' && $userRow['linked_trainer_id'] !== null) {
        $trainerId = (int) $userRow['linked_trainer_id'];
        $stmt = $pdo->prepare(
            'SELECT full_name, email, phone, specialization, availability, status
             FROM trainers
             WHERE id = :id
             LIMIT 1'
        );
        $stmt->execute(['id' => $trainerId]);
        $trainer = $stmt->fetch();

        if ($trainer) {
            $profile['full_name'] = (string) $trainer['full_name'];
            $profile['email'] = (string) $trainer['email'];
            $profile['phone'] = $trainer['phone'] !== null ? (string) $trainer['phone'] : null;
            $profile['specialization'] = $trainer['specialization'] !== null ? (string) $trainer['specialization'] : null;
            $profile['availability'] = $trainer['availability'] !== null ? (string) $trainer['availability'] : null;
            $profile['trainer_status'] = (string) $trainer['status'];
        }
    }

    return $profile;
}
