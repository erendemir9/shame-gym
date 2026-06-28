<?php
/**
 * workouts/progress.php — mark a workout day complete or incomplete.
 *
 * POST api/workouts/progress.php
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
    $body = getJsonRequestBody();

    if ($body === null) {
        errorResponse('Request body is required.', 400);
    }

    $planId = parseWorkoutPlanIdFromRequest($body['workout_plan_id'] ?? ($body['id'] ?? null));
    if ($planId === null) {
        errorResponse('Workout plan id is required.', 400);
    }

    $dayLabel = null;
    if (isset($body['progress_key']) && trim((string) $body['progress_key']) !== '') {
        $dayLabel = trim((string) $body['progress_key']);
    } elseif (isset($body['day_label']) && trim((string) $body['day_label']) !== '') {
        $dayLabel = trim((string) $body['day_label']);
    }

    if ($dayLabel === null || $dayLabel === '') {
        errorResponse('Day label is required.', 400);
    }

    $isCompleted = true;
    if (array_key_exists('is_completed', $body)) {
        $isCompleted = (bool) $body['is_completed'];
    }

    $pdo = getDatabaseConnection();
    $planRow = fetchWorkoutPlanRowById($pdo, $planId);

    if (!$planRow) {
        errorResponse('Workout plan not found.', 404);
    }

    if ($user['role'] === 'admin') {
        // Admin may update progress on behalf of testing; still tied to plan member.
    } elseif ($user['role'] === 'member') {
        $linkedMemberId = getLinkedMemberId($user);
        if ($linkedMemberId === null || (int) $planRow['member_id'] !== $linkedMemberId) {
            errorResponse('You do not have permission to update progress for this plan.', 403);
        }
    } else {
        errorResponse('You do not have permission to update workout progress.', 403);
    }

    $memberId = (int) $planRow['member_id'];

    if ($isCompleted) {
        $insertSql = 'INSERT INTO workout_progress
            (workout_plan_id, member_id, day_label)
            VALUES
            (:workout_plan_id, :member_id, :day_label)
            ON DUPLICATE KEY UPDATE completed_at = CURRENT_TIMESTAMP';

        $insertStmt = $pdo->prepare($insertSql);
        $insertStmt->execute([
            'workout_plan_id' => $planId,
            'member_id'       => $memberId,
            'day_label'       => $dayLabel,
        ]);
    } else {
        $deleteStmt = $pdo->prepare(
            'DELETE FROM workout_progress
             WHERE workout_plan_id = :workout_plan_id AND day_label = :day_label'
        );
        $deleteStmt->execute([
            'workout_plan_id' => $planId,
            'day_label'       => $dayLabel,
        ]);
    }

    $completedDays = fetchCompletedDayLabelsForPlan($pdo, $planId);

    successResponse([
        'workout_plan_id' => $planId,
        'day_label'       => $dayLabel,
        'is_completed'    => $isCompleted,
        'completed_days'  => $completedDays,
    ], 'Workout progress updated successfully', 200);
} catch (Throwable $e) {
    errorResponse('Failed to update workout progress.', 500, [
        'error' => $e->getMessage(),
    ]);
}
