<?php
/**
 * request.php — small helpers for GET query parameters and access checks.
 * Used by read-only API endpoints in Part 6A.
 */

/**
 * Read an optional integer query parameter.
 *
 * @param string $name
 * @return int|null
 */
function getQueryInt($name)
{
    if (!isset($_GET[$name]) || $_GET[$name] === '') {
        return null;
    }

    if (!ctype_digit((string) $_GET[$name])) {
        return null;
    }

    return (int) $_GET[$name];
}

/**
 * Read an optional trimmed string query parameter.
 *
 * @param string $name
 * @return string|null
 */
function getQueryString($name)
{
    if (!isset($_GET[$name]) || trim((string) $_GET[$name]) === '') {
        return null;
    }

    return trim((string) $_GET[$name]);
}

/**
 * Return the trainer id linked to the logged-in user, if any.
 *
 * @param array $user
 * @return int|null
 */
function getLinkedTrainerId($user)
{
    return isset($user['linked_trainer_id']) && $user['linked_trainer_id'] !== null
        ? (int) $user['linked_trainer_id']
        : null;
}

/**
 * Return the member id linked to the logged-in user, if any.
 *
 * @param array $user
 * @return int|null
 */
function getLinkedMemberId($user)
{
    return isset($user['linked_member_id']) && $user['linked_member_id'] !== null
        ? (int) $user['linked_member_id']
        : null;
}

/**
 * Format a member row for JSON output.
 *
 * @param array $row
 * @return array
 */
function formatMemberRow($row)
{
    return [
        'id'                   => (int) $row['id'],
        'full_name'            => (string) $row['full_name'],
        'email'                => (string) $row['email'],
        'phone'                => $row['phone'] !== null ? (string) $row['phone'] : null,
        'membership_type'      => (string) $row['membership_type'],
        'start_date'           => $row['start_date'] !== null ? (string) $row['start_date'] : null,
        'assigned_trainer_id'  => $row['assigned_trainer_id'] !== null ? (int) $row['assigned_trainer_id'] : null,
        'assigned_trainer_name'=> isset($row['assigned_trainer_name']) && $row['assigned_trainer_name'] !== null
            ? (string) $row['assigned_trainer_name']
            : null,
        'status'               => (string) $row['status'],
        'created_at'           => (string) $row['created_at'],
        'updated_at'           => (string) $row['updated_at'],
    ];
}

/**
 * Format a trainer row for JSON output.
 *
 * @param array $row
 * @return array
 */
function formatTrainerRow($row)
{
    return [
        'id'              => (int) $row['id'],
        'full_name'       => (string) $row['full_name'],
        'email'           => (string) $row['email'],
        'phone'           => $row['phone'] !== null ? (string) $row['phone'] : null,
        'specialization'  => $row['specialization'] !== null ? (string) $row['specialization'] : null,
        'availability'    => $row['availability'] !== null ? (string) $row['availability'] : null,
        'status'          => (string) $row['status'],
        'created_at'      => (string) $row['created_at'],
        'updated_at'      => (string) $row['updated_at'],
    ];
}

/**
 * Format a class row for JSON output.
 *
 * @param array $row
 * @return array
 */
function formatClassRow($row)
{
    return [
        'id'               => (int) $row['id'],
        'class_name'       => (string) $row['class_name'],
        'trainer_id'       => (int) $row['trainer_id'],
        'trainer_name'     => (string) $row['trainer_name'],
        'class_date'       => (string) $row['class_date'],
        'class_time'       => substr((string) $row['class_time'], 0, 5),
        'duration_minutes' => (int) $row['duration_minutes'],
        'capacity'         => (int) $row['capacity'],
        'enrolled_count'   => isset($row['enrolled_count']) ? (int) $row['enrolled_count'] : 0,
        'status'           => (string) $row['status'],
        'created_at'       => (string) $row['created_at'],
        'updated_at'       => (string) $row['updated_at'],
    ];
}

/**
 * Format an enrollment row for JSON output.
 *
 * @param array $row
 * @return array
 */
function formatEnrollmentRow($row)
{
    return [
        'id'           => (int) $row['id'],
        'class_id'     => (int) $row['class_id'],
        'class_name'   => (string) $row['class_name'],
        'member_id'    => (int) $row['member_id'],
        'member_name'  => (string) $row['member_name'],
        'member_email' => (string) $row['member_email'],
        'enrolled_at'  => (string) $row['enrolled_at'],
        'status'       => (string) $row['status'],
    ];
}

/**
 * Load a class row and verify the current user may view it.
 *
 * @param PDO   $pdo
 * @param array $user
 * @param int   $classId
 * @return array|null
 */
function fetchClassForUser(PDO $pdo, $user, $classId)
{
    $sql = 'SELECT c.id, c.class_name, c.trainer_id, t.full_name AS trainer_name,
                   c.class_date, c.class_time, c.duration_minutes, c.capacity, c.status,
                   c.created_at, c.updated_at,
                   (SELECT COUNT(*)
                    FROM enrollments e
                    WHERE e.class_id = c.id AND e.status = \'enrolled\') AS enrolled_count
            FROM classes c
            INNER JOIN trainers t ON t.id = c.trainer_id
            WHERE c.id = :id';

    $params = ['id' => $classId];

    if ($user['role'] === 'trainer') {
        $trainerId = getLinkedTrainerId($user);
        if ($trainerId === null) {
            return null;
        }
        $sql .= ' AND c.trainer_id = :trainer_id';
        $params['trainer_id'] = $trainerId;
    }

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $row = $stmt->fetch();

    return $row ?: null;
}
