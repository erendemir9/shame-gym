<?php
/**
 * workouts/get.php — fetch one workout plan by id.
 *
 * GET api/workouts/get.php?id=1
 */

declare(strict_types=1);

ini_set('display_errors', '0');
error_reporting(E_ALL);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/auth.php';
require_once __DIR__ . '/../config/request.php';
require_once __DIR__ . '/workout_input.php';

requireHttpMethod('GET');

try {
    $user = requireLogin();
    $planId = parseWorkoutPlanIdFromRequest(getQueryString('id'));

    if ($planId === null) {
        errorResponse('Workout plan id is required.', 400);
    }

    $pdo = getDatabaseConnection();
    $row = fetchWorkoutPlanRowById($pdo, $planId);

    if (!$row) {
        errorResponse('Workout plan not found.', 404);
    }

    if (!canAccessWorkoutPlan($user, $row)) {
        errorResponse('You do not have permission to view this workout plan.', 403);
    }

    successResponse([
        'workout_plan' => formatWorkoutPlanRow($pdo, $row),
    ], 'Workout plan loaded successfully');
} catch (Throwable $e) {
    errorResponse('Failed to load workout plan.', 500, [
        'error' => $e->getMessage(),
    ]);
}
