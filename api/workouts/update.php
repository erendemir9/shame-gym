<?php
/**
 * workouts/update.php — update an existing workout plan.
 *
 * POST api/workouts/update.php
 */

declare(strict_types=1);

ini_set('display_errors', '0');
error_reporting(E_ALL);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/auth.php';
require_once __DIR__ . '/../config/request.php';
require_once __DIR__ . '/workout_input.php';

requireHttpMethod('POST');

try {
    $user = requireLogin();

    if ($user['role'] === 'member') {
        errorResponse('You do not have permission to update workout plans.', 403);
    }

    $body = getJsonRequestBody();
    if ($body === null) {
        errorResponse('Request body is required.', 400);
    }

    $normalized = normalizeWorkoutWritePayload($body, true);
    if (!$normalized['ok']) {
        errorResponse($normalized['message'], 400);
    }

    $planData = $normalized['data'];
    $planId = (int) $planData['id'];
    $pdo = getDatabaseConnection();

    $existing = fetchWorkoutPlanRowById($pdo, $planId);
    if (!$existing) {
        errorResponse('Workout plan not found.', 404);
    }

    if (!canAccessWorkoutPlan($user, $existing)) {
        errorResponse('You do not have permission to update this workout plan.', 403);
    }

    $memberResult = resolveWorkoutMemberFromPayload($pdo, $planData['member_id'], $planData['member_email']);
    if (!$memberResult['ok']) {
        $member = fetchWorkoutMemberById($pdo, (int) $existing['member_id']);
        if (!$member) {
            errorResponse('Member not found.', 400);
        }
    } else {
        $member = $memberResult['member'];
    }

    if (!canManageWorkoutMember($user, $member)) {
        errorResponse('You do not have permission to update a plan for this member.', 403);
    }

    $trainerResult = resolveWorkoutTrainerId($pdo, $user, $member, $planData['trainer_id']);
    if (!$trainerResult['ok']) {
        errorResponse($trainerResult['message'], 400);
    }

    $trainerId = $trainerResult['trainer_id'];
    $planDetailsJson = encodeWorkoutPlanDetails($planData['days']);

    $pdo->beginTransaction();

    if ((int) $member['id'] !== (int) $existing['member_id']) {
        archiveOtherActivePlansForMember($pdo, (int) $member['id'], $planId);
    }

    $updateSql = 'UPDATE workout_plans
                  SET member_id = :member_id,
                      trainer_id = :trainer_id,
                      plan_name = :plan_name,
                      notes = :notes,
                      plan_details = :plan_details,
                      status = :status,
                      updated_at = CURRENT_TIMESTAMP
                  WHERE id = :id';

    $updateStmt = $pdo->prepare($updateSql);
    $updateStmt->execute([
        'member_id'    => (int) $member['id'],
        'trainer_id'   => $trainerId,
        'plan_name'    => $planData['plan_name'],
        'notes'        => $planData['notes'],
        'plan_details' => $planDetailsJson,
        'status'       => 'active',
        'id'           => $planId,
    ]);

    $pdo->commit();

    $row = fetchWorkoutPlanRowById($pdo, $planId);
    if (!$row) {
        errorResponse('Workout plan was updated but could not be loaded.', 500);
    }

    successResponse([
        'workout_plan' => formatWorkoutPlanRow($pdo, $row),
    ], 'Workout plan updated successfully', 200);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    errorResponse('Failed to update workout plan.', 500, [
        'error' => $e->getMessage(),
    ]);
}
