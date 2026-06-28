<?php
/**
 * enrollments/enroll.php — enroll a member in a class.
 *
 * POST api/enrollments/enroll.php
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

    $class = fetchClassForEnrollment($pdo, $classId);
    if (!$class) {
        errorResponse('Class not found.', 404);
    }

    if ($class['status'] !== 'scheduled') {
        errorResponse('This class is not open for enrollment.', 400);
    }

    $member = fetchMemberForEnrollment($pdo, $memberId);
    if (!$member) {
        errorResponse('Member not found.', 404);
    }

    if ($member['status'] !== 'active') {
        errorResponse('This member is not active.', 400);
    }

    $existingEnrollment = fetchEnrollmentForClassMember($pdo, $classId, $memberId);

    if ($existingEnrollment && $existingEnrollment['status'] === 'enrolled') {
        errorResponse('Member is already enrolled in this class.', 409);
    }

    if ($existingEnrollment && in_array($existingEnrollment['status'], ['cancelled', 'attended'], true)) {
        $activeCount = countActiveEnrollmentsForClass($pdo, $classId);
        if ($activeCount >= (int) $class['capacity']) {
            errorResponse('Class is full.', 409);
        }

        $reactivateSql = 'UPDATE enrollments
                          SET status = :status, enrolled_at = CURRENT_TIMESTAMP
                          WHERE id = :id';
        $reactivateStmt = $pdo->prepare($reactivateSql);
        $reactivateStmt->execute([
            'status' => 'enrolled',
            'id'     => (int) $existingEnrollment['id'],
        ]);

        $updatedEnrollment = fetchEnrollmentForClassMember($pdo, $classId, $memberId);
        successResponse([
            'enrollment' => formatEnrollmentWriteRow($updatedEnrollment),
        ], 'Enrollment successful');
    }

    $activeCount = countActiveEnrollmentsForClass($pdo, $classId);
    if ($activeCount >= (int) $class['capacity']) {
        errorResponse('Class is full.', 409);
    }

    $insertSql = 'INSERT INTO enrollments (class_id, member_id, status)
                  VALUES (:class_id, :member_id, :status)';
    $insertStmt = $pdo->prepare($insertSql);
    $insertStmt->execute([
        'class_id'  => $classId,
        'member_id' => $memberId,
        'status'    => 'enrolled',
    ]);

    $enrollmentId = (int) $pdo->lastInsertId();
    $newEnrollment = fetchEnrollmentForClassMember($pdo, $classId, $memberId);
    if (!$newEnrollment) {
        errorResponse('Enrollment was created but could not be loaded.', 500);
    }

    successResponse([
        'enrollment' => formatEnrollmentWriteRow($newEnrollment),
    ], 'Enrollment successful');
} catch (Throwable $e) {
    errorResponse('Failed to enroll member.', 500, [
        'error' => $e->getMessage(),
    ]);
}
