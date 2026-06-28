<?php
/**
 * workouts/delete.php — archive (soft delete) a workout plan.
 *
 * POST api/workouts/delete.php
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
        errorResponse('You do not have permission to delete workout plans.', 403);
    }

    $body = getJsonRequestBody();
    if ($body === null) {
        errorResponse('Request body is required.', 400);
    }

    $planId = parseWorkoutPlanIdFromRequest($body['id'] ?? null);
    if ($planId === null) {
        errorResponse('Workout plan id is required.', 400);
    }

    $pdo = getDatabaseConnection();
    $existing = fetchWorkoutPlanRowById($pdo, $planId);

    if (!$existing) {
        errorResponse('Workout plan not found.', 404);
    }

    if (!canAccessWorkoutPlan($user, $existing)) {
        errorResponse('You do not have permission to delete this workout plan.', 403);
    }

    $stmt = $pdo->prepare(
        'UPDATE workout_plans
         SET status = :status, updated_at = CURRENT_TIMESTAMP
         WHERE id = :id'
    );
    $stmt->execute([
        'status' => 'archived',
        'id'     => $planId,
    ]);

    successResponse([
        'id' => $planId,
    ], 'Workout plan archived successfully', 200);
} catch (Throwable $e) {
    errorResponse('Failed to delete workout plan.', 500, [
        'error' => $e->getMessage(),
    ]);
}
