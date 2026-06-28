<?php
/**
 * workout_input.php — shared helpers for workout plan APIs.
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/request.php';

/**
 * Parse workout plan id from request value.
 *
 * @param mixed $rawId
 * @return int|null
 */
function parseWorkoutPlanIdFromRequest($rawId)
{
    if ($rawId === null || $rawId === '') {
        return null;
    }

    if (is_int($rawId) && $rawId > 0) {
        return $rawId;
    }

    if (is_string($rawId) && ctype_digit($rawId)) {
        $planId = (int) $rawId;
        return $planId > 0 ? $planId : null;
    }

    if (is_string($rawId) && preg_match('/^wp(\d+)$/i', $rawId, $matches)) {
        return (int) $matches[1];
    }

    return null;
}

/**
 * Decode plan_details JSON into frontend-style days array.
 *
 * @param mixed $planDetailsJson
 * @return array
 */
function decodeWorkoutPlanDays($planDetailsJson)
{
    if ($planDetailsJson === null || $planDetailsJson === '') {
        return [];
    }

    $decoded = is_array($planDetailsJson) ? $planDetailsJson : json_decode((string) $planDetailsJson, true);
    if (!is_array($decoded)) {
        return [];
    }

    if (isset($decoded['days']) && is_array($decoded['days'])) {
        return $decoded['days'];
    }

    return [];
}

/**
 * Encode days array into JSON for plan_details column.
 *
 * @param array $days
 * @return string
 */
function encodeWorkoutPlanDetails(array $days)
{
    return json_encode(['days' => $days], JSON_UNESCAPED_UNICODE);
}

/**
 * Normalize create/update workout payload.
 *
 * @param array $body
 * @param bool  $requireId
 * @return array{ok:bool,message?:string,data?:array}
 */
function normalizeWorkoutWritePayload(array $body, $requireId = false)
{
    $planId = null;
    if ($requireId) {
        if (!array_key_exists('id', $body)) {
            return ['ok' => false, 'message' => 'Workout plan id is required.'];
        }
        $planId = parseWorkoutPlanIdFromRequest($body['id']);
        if ($planId === null) {
            return ['ok' => false, 'message' => 'Invalid workout plan id.'];
        }
    }

    $memberId = null;
    if (isset($body['member_id'])) {
        $memberId = (int) $body['member_id'];
        if ($memberId <= 0) {
            return ['ok' => false, 'message' => 'Invalid member id.'];
        }
    }

    $memberEmail = null;
    if (isset($body['member_email']) && trim((string) $body['member_email']) !== '') {
        $memberEmail = strtolower(trim((string) $body['member_email']));
    }

    $planName = '';
    if (isset($body['plan_name'])) {
        $planName = trim((string) $body['plan_name']);
    } elseif (isset($body['planName'])) {
        $planName = trim((string) $body['planName']);
    }

    if ($planName === '') {
        return ['ok' => false, 'message' => 'Plan name is required.'];
    }

    $notes = null;
    if (isset($body['notes']) && trim((string) $body['notes']) !== '') {
        $notes = trim((string) $body['notes']);
    }

    $days = [];
    if (isset($body['plan_details']) && is_array($body['plan_details'])) {
        $days = decodeWorkoutPlanDays($body['plan_details']);
    } elseif (isset($body['days']) && is_array($body['days'])) {
        $days = $body['days'];
    }

    if (count($days) === 0) {
        return ['ok' => false, 'message' => 'At least one workout day is required.'];
    }

    $trainerId = null;
    if (isset($body['trainer_id'])) {
        $trainerId = (int) $body['trainer_id'];
        if ($trainerId <= 0) {
            return ['ok' => false, 'message' => 'Invalid trainer id.'];
        }
    }

    $data = [
        'plan_name'    => $planName,
        'notes'        => $notes,
        'days'         => $days,
        'member_id'    => $memberId,
        'member_email' => $memberEmail,
        'trainer_id'   => $trainerId,
    ];

    if ($requireId) {
        $data['id'] = $planId;
    }

    return ['ok' => true, 'data' => $data];
}

/**
 * Load member row by id.
 *
 * @param PDO $pdo
 * @param int $memberId
 * @return array|null
 */
function fetchWorkoutMemberById(PDO $pdo, $memberId)
{
    $stmt = $pdo->prepare(
        'SELECT id, full_name, email, assigned_trainer_id, status
         FROM members
         WHERE id = :id
         LIMIT 1'
    );
    $stmt->execute(['id' => $memberId]);
    $row = $stmt->fetch();

    return $row ?: null;
}

/**
 * Resolve member id from payload fields.
 *
 * @param PDO        $pdo
 * @param array|null $memberId
 * @param string|null $memberEmail
 * @return array{ok:bool,message?:string,member?:array}
 */
function resolveWorkoutMemberFromPayload(PDO $pdo, $memberId, $memberEmail)
{
    if ($memberId !== null) {
        $member = fetchWorkoutMemberById($pdo, $memberId);
        if (!$member) {
            return ['ok' => false, 'message' => 'Member not found.'];
        }
        return ['ok' => true, 'member' => $member];
    }

    if ($memberEmail !== null && $memberEmail !== '') {
        $stmt = $pdo->prepare('SELECT id, full_name, email, assigned_trainer_id, status FROM members WHERE email = :email LIMIT 1');
        $stmt->execute(['email' => $memberEmail]);
        $member = $stmt->fetch();
        if (!$member) {
            return ['ok' => false, 'message' => 'Member not found.'];
        }
        return ['ok' => true, 'member' => $member];
    }

    return ['ok' => false, 'message' => 'Member is required.'];
}

/**
 * Load completed day labels for a workout plan.
 *
 * @param PDO $pdo
 * @param int $planId
 * @return array
 */
function fetchCompletedDayLabelsForPlan(PDO $pdo, $planId)
{
    $stmt = $pdo->prepare(
        'SELECT day_label
         FROM workout_progress
         WHERE workout_plan_id = :workout_plan_id
         ORDER BY day_label ASC'
    );
    $stmt->execute(['workout_plan_id' => $planId]);
    $rows = $stmt->fetchAll();

    $labels = [];
    foreach ($rows as $row) {
        $labels[] = (string) $row['day_label'];
    }

    return $labels;
}

/**
 * Format workout plan row for JSON output.
 *
 * @param PDO   $pdo
 * @param array $row
 * @return array
 */
function formatWorkoutPlanRow(PDO $pdo, array $row)
{
    $days = decodeWorkoutPlanDays($row['plan_details'] ?? null);
    $completedDays = fetchCompletedDayLabelsForPlan($pdo, (int) $row['id']);

    return [
        'id'             => (int) $row['id'],
        'frontend_id'    => 'wp' . $row['id'],
        'member_id'      => (int) $row['member_id'],
        'member_email'   => (string) $row['member_email'],
        'member_name'    => (string) $row['member_name'],
        'trainer_id'     => (int) $row['trainer_id'],
        'trainer_name'   => (string) $row['trainer_name'],
        'plan_name'      => (string) $row['plan_name'],
        'notes'          => $row['notes'] !== null ? (string) $row['notes'] : null,
        'days'           => $days,
        'completed_days' => $completedDays,
        'status'         => (string) $row['status'],
        'created_at'     => (string) $row['created_at'],
        'updated_at'     => (string) $row['updated_at'],
    ];
}

/**
 * Load one workout plan with joins.
 *
 * @param PDO $pdo
 * @param int $planId
 * @return array|null
 */
function fetchWorkoutPlanRowById(PDO $pdo, $planId)
{
    $sql = 'SELECT wp.id, wp.member_id, wp.trainer_id, wp.plan_name, wp.notes, wp.plan_details,
                   wp.status, wp.created_at, wp.updated_at,
                   m.full_name AS member_name, m.email AS member_email,
                   t.full_name AS trainer_name
            FROM workout_plans wp
            INNER JOIN members m ON m.id = wp.member_id
            INNER JOIN trainers t ON t.id = wp.trainer_id
            WHERE wp.id = :id
            LIMIT 1';

    $stmt = $pdo->prepare($sql);
    $stmt->execute(['id' => $planId]);
    $row = $stmt->fetch();

    return $row ?: null;
}

/**
 * Check whether user may manage a member for workout writes.
 *
 * @param array $user
 * @param array $member
 * @return bool
 */
function canManageWorkoutMember(array $user, array $member)
{
    $role = $user['role'];

    if ($role === 'admin') {
        return true;
    }

    if ($role !== 'trainer') {
        return false;
    }

    $linkedTrainerId = getLinkedTrainerId($user);
    if ($linkedTrainerId === null) {
        return false;
    }

    return (int) $member['assigned_trainer_id'] === $linkedTrainerId;
}

/**
 * Check whether user may access a workout plan row.
 *
 * @param array $user
 * @param array $planRow
 * @return bool
 */
function canAccessWorkoutPlan(array $user, array $planRow)
{
    $role = $user['role'];

    if ($role === 'admin') {
        return true;
    }

    if ($role === 'member') {
        $linkedMemberId = getLinkedMemberId($user);
        return $linkedMemberId !== null && (int) $planRow['member_id'] === $linkedMemberId;
    }

    if ($role === 'trainer') {
        $linkedTrainerId = getLinkedTrainerId($user);
        if ($linkedTrainerId === null) {
            return false;
        }

        return (int) $planRow['trainer_id'] === $linkedTrainerId;
    }

    return false;
}

/**
 * Resolve trainer id for workout write operations.
 *
 * @param PDO   $pdo
 * @param array $user
 * @param array $member
 * @param int|null $requestedTrainerId
 * @return array{ok:bool,message?:string,trainer_id?:int}
 */
function resolveWorkoutTrainerId(PDO $pdo, array $user, array $member, $requestedTrainerId)
{
    if ($user['role'] === 'admin') {
        if ($requestedTrainerId !== null) {
            $stmt = $pdo->prepare('SELECT id FROM trainers WHERE id = :id AND status = :status LIMIT 1');
            $stmt->execute(['id' => $requestedTrainerId, 'status' => 'active']);
            if (!$stmt->fetch()) {
                return ['ok' => false, 'message' => 'Trainer not found or inactive.'];
            }
            return ['ok' => true, 'trainer_id' => $requestedTrainerId];
        }

        if ($member['assigned_trainer_id'] !== null) {
            return ['ok' => true, 'trainer_id' => (int) $member['assigned_trainer_id']];
        }

        return ['ok' => false, 'message' => 'Trainer id is required for this member.'];
    }

    if ($user['role'] === 'trainer') {
        $linkedTrainerId = getLinkedTrainerId($user);
        if ($linkedTrainerId === null) {
            return ['ok' => false, 'message' => 'Trainer profile is not linked to your account.'];
        }
        return ['ok' => true, 'trainer_id' => $linkedTrainerId];
    }

    return ['ok' => false, 'message' => 'You do not have permission to manage workout plans.'];
}

/**
 * Archive other active plans for the same member.
 *
 * @param PDO $pdo
 * @param int $memberId
 * @param int|null $ignorePlanId
 * @return void
 */
function archiveOtherActivePlansForMember(PDO $pdo, $memberId, $ignorePlanId = null)
{
    $sql = 'UPDATE workout_plans
            SET status = :archived, updated_at = CURRENT_TIMESTAMP
            WHERE member_id = :member_id AND status = :active';
    $params = [
        'archived'  => 'archived',
        'member_id' => $memberId,
        'active'    => 'active',
    ];

    if ($ignorePlanId !== null) {
        $sql .= ' AND id != :ignore_id';
        $params['ignore_id'] = $ignorePlanId;
    }

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
}
