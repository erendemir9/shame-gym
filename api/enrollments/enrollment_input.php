<?php
/**
 * enrollment_input.php — shared helpers for enrollment write payloads.
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
 * Resolve which member id the current user may enroll or unenroll.
 *
 * @param array      $user
 * @param array|null $body
 * @return array{ok:bool,message?:string,member_id?:int}
 */
function resolveEnrollmentMemberId(array $user, $body)
{
    $role = $user['role'];

    if ($role === 'trainer') {
        return ['ok' => false, 'message' => 'You do not have permission to manage enrollments.'];
    }

    if ($role === 'member') {
        $linkedMemberId = getLinkedMemberId($user);
        if ($linkedMemberId === null) {
            return ['ok' => false, 'message' => 'Your account is not linked to a member profile.'];
        }

        if (is_array($body) && array_key_exists('member_id', $body) && $body['member_id'] !== null && $body['member_id'] !== '') {
            $requestedMemberId = parseMemberIdFromRequest($body['member_id']);
            if ($requestedMemberId === null) {
                return ['ok' => false, 'message' => 'Invalid member id.'];
            }
            if ($requestedMemberId !== $linkedMemberId) {
                return ['ok' => false, 'message' => 'You do not have permission to manage this enrollment.'];
            }
        }

        return ['ok' => true, 'member_id' => $linkedMemberId];
    }

    if ($role === 'admin') {
        if (!is_array($body) || !array_key_exists('member_id', $body) || $body['member_id'] === null || $body['member_id'] === '') {
            return ['ok' => false, 'message' => 'Member id is required.'];
        }

        $memberId = parseMemberIdFromRequest($body['member_id']);
        if ($memberId === null) {
            return ['ok' => false, 'message' => 'Invalid member id.'];
        }

        return ['ok' => true, 'member_id' => $memberId];
    }

    return ['ok' => false, 'message' => 'You do not have permission to manage enrollments.'];
}

/**
 * Parse class_id from request body.
 *
 * @param array|null $body
 * @return array{ok:bool,message?:string,class_id?:int}
 */
function parseEnrollmentClassIdFromBody($body)
{
    if (!is_array($body) || !array_key_exists('class_id', $body)) {
        return ['ok' => false, 'message' => 'Class id is required.'];
    }

    $classId = parseClassIdFromRequest($body['class_id']);
    if ($classId === null) {
        return ['ok' => false, 'message' => 'Invalid class id.'];
    }

    return ['ok' => true, 'class_id' => $classId];
}

/**
 * Load a class row for enrollment validation.
 *
 * @param PDO $pdo
 * @param int $classId
 * @return array|null
 */
function fetchClassForEnrollment(PDO $pdo, $classId)
{
    $sql = 'SELECT id, class_name, capacity, status
            FROM classes
            WHERE id = :id
            LIMIT 1';

    $stmt = $pdo->prepare($sql);
    $stmt->execute(['id' => $classId]);
    $row = $stmt->fetch();

    return $row ?: null;
}

/**
 * Load a member row for enrollment validation.
 *
 * @param PDO $pdo
 * @param int $memberId
 * @return array|null
 */
function fetchMemberForEnrollment(PDO $pdo, $memberId)
{
    $sql = 'SELECT id, full_name, email, status
            FROM members
            WHERE id = :id
            LIMIT 1';

    $stmt = $pdo->prepare($sql);
    $stmt->execute(['id' => $memberId]);
    $row = $stmt->fetch();

    return $row ?: null;
}

/**
 * Count active enrollments for a class.
 *
 * @param PDO $pdo
 * @param int $classId
 * @return int
 */
function countActiveEnrollmentsForClass(PDO $pdo, $classId)
{
    $sql = 'SELECT COUNT(*)
            FROM enrollments
            WHERE class_id = :class_id AND status = :status';

    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        'class_id' => $classId,
        'status'   => 'enrolled',
    ]);

    return (int) $stmt->fetchColumn();
}

/**
 * Load an enrollment row for a class and member.
 *
 * @param PDO $pdo
 * @param int $classId
 * @param int $memberId
 * @return array|null
 */
function fetchEnrollmentForClassMember(PDO $pdo, $classId, $memberId)
{
    $sql = 'SELECT id, class_id, member_id, status, enrolled_at
            FROM enrollments
            WHERE class_id = :class_id AND member_id = :member_id
            LIMIT 1';

    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        'class_id'  => $classId,
        'member_id' => $memberId,
    ]);
    $row = $stmt->fetch();

    return $row ?: null;
}

/**
 * Format an enrollment row for JSON output.
 *
 * @param array $row
 * @return array
 */
function formatEnrollmentWriteRow($row)
{
    return [
        'id'        => (int) $row['id'],
        'class_id'  => (int) $row['class_id'],
        'member_id' => (int) $row['member_id'],
        'status'    => (string) $row['status'],
    ];
}
