<?php
/**
 * enrollments/unenroll.php — unenroll a member from a class.
 *
 * POST api/enrollments/unenroll.php
 */

declare(strict_types=1);

ini_set('display_errors', '0');
error_reporting(E_ALL);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/auth.php';
require_once __DIR__ . '/../config/request.php';
require_once __DIR__ . '/enrollment_input.php';

requireHttpMethod('POST');

try {
    $user = requireLogin();
    $body = getJsonRequestBody();
    if ($body === null) {
        errorResponse('Request body is required.', 400);
    }

    $classResult = parseEnrollmentClassIdFromBody($body);
    if (!$classResult['ok']) {
        errorResponse($classResult['message'], 400);
    }

    $memberResult = resolveEnrollmentMemberId($user, $body);
    if (!$memberResult['ok']) {
        $statusCode = $user['role'] === 'member' ? 403 : 400;
        if (strpos($memberResult['message'], 'permission') !== false) {
            $statusCode = 403;
        }
        errorResponse($memberResult['message'], $statusCode);
    }

    $classId = $classResult['class_id'];
    $memberId = $memberResult['member_id'];
    $pdo = getDatabaseConnection();

    $existingEnrollment = fetchEnrollmentForClassMember($pdo, $classId, $memberId);
    if (!$existingEnrollment) {
        errorResponse('Enrollment not found.', 404);
    }

    if ($existingEnrollment['status'] === 'cancelled') {
        errorResponse('Member is already unenrolled from this class.', 409);
    }

    if ($existingEnrollment['status'] !== 'enrolled') {
        errorResponse('This enrollment cannot be cancelled.', 409);
    }

    $updateSql = 'UPDATE enrollments
                  SET status = :status
                  WHERE id = :id';
    $updateStmt = $pdo->prepare($updateSql);
    $updateStmt->execute([
        'status' => 'cancelled',
        'id'     => (int) $existingEnrollment['id'],
    ]);

    successResponse([
        'class_id'  => $classId,
        'member_id' => $memberId,
    ], 'Unenrolled successfully');
} catch (Throwable $e) {
    errorResponse('Failed to unenroll member.', 500, [
        'error' => $e->getMessage(),
    ]);
}
