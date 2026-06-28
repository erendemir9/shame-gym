<?php
/**
 * workouts/create.php — create a workout plan for a member.
 *
 * POST api/workouts/create.php
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
        errorResponse('You do not have permission to create workout plans.', 403);
    }

    $body = getJsonRequestBody();
    if ($body === null) {
        errorResponse('Request body is required.', 400);
    }

    $normalized = normalizeWorkoutWritePayload($body, false);
    if (!$normalized['ok']) {
        errorResponse($normalized['message'], 400);
    }

    $planData = $normalized['data'];
    $pdo = getDatabaseConnection();

    $memberResult = resolveWorkoutMemberFromPayload($pdo, $planData['member_id'], $planData['member_email']);
    if (!$memberResult['ok']) {
        errorResponse($memberResult['message'], 400);
    }

    $member = $memberResult['member'];
    if ($member['status'] !== 'active') {
        errorResponse('Cannot assign a workout plan to an inactive member.', 400);
    }

    if (!canManageWorkoutMember($user, $member)) {
        errorResponse('You do not have permission to create a plan for this member.', 403);
    }

    $trainerResult = resolveWorkoutTrainerId($pdo, $user, $member, $planData['trainer_id']);
    if (!$trainerResult['ok']) {
        errorResponse($trainerResult['message'], 400);
    }

    $trainerId = $trainerResult['trainer_id'];
    $planDetailsJson = encodeWorkoutPlanDetails($planData['days']);

    $pdo->beginTransaction();

    archiveOtherActivePlansForMember($pdo, (int) $member['id']);

    $insertSql = 'INSERT INTO workout_plans
        (member_id, trainer_id, plan_name, notes, plan_details, status)
        VALUES
        (:member_id, :trainer_id, :plan_name, :notes, :plan_details, :status)';

    $insertStmt = $pdo->prepare($insertSql);
    $insertStmt->execute([
        'member_id'     => (int) $member['id'],
        'trainer_id'    => $trainerId,
        'plan_name'     => $planData['plan_name'],
        'notes'         => $planData['notes'],
        'plan_details'  => $planDetailsJson,
        'status'        => 'active',
    ]);

    $planId = (int) $pdo->lastInsertId();
    $pdo->commit();

    $row = fetchWorkoutPlanRowById($pdo, $planId);
    if (!$row) {
        errorResponse('Workout plan was created but could not be loaded.', 500);
    }

    successResponse([
        'workout_plan' => formatWorkoutPlanRow($pdo, $row),
    ], 'Workout plan created successfully', 200);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    errorResponse('Failed to create workout plan.', 500, [
        'error' => $e->getMessage(),
    ]);
}
