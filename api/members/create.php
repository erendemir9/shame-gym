<?php
/**
 * members/create.php — admin-only create member.
 *
 * POST api/members/create.php
 */

declare(strict_types=1);

ini_set('display_errors', '0');
error_reporting(E_ALL);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/auth.php';
require_once __DIR__ . '/../config/request.php';
require_once __DIR__ . '/member_input.php';
require_once __DIR__ . '/../users/account_provisioning.php';

requireHttpMethod('POST');

try {
    requireRole('admin');

    $body = getJsonRequestBody();
    if ($body === null) {
        errorResponse('Request body is required.', 400);
    }

    $normalized = normalizeMemberWritePayload($body, false);
    if (!$normalized['ok']) {
        errorResponse($normalized['message'], 400);
    }

    $memberData = $normalized['data'];
    $pdo = getDatabaseConnection();

    if (!trainerExists($pdo, $memberData['assigned_trainer_id'])) {
        errorResponse('Assigned trainer not found.', 400);
    }

    assertEmailAvailableForNewMember($pdo, $memberData['email']);

    $pdo->beginTransaction();

    $insertSql = 'INSERT INTO members
        (full_name, email, phone, membership_type, start_date, assigned_trainer_id, status)
        VALUES
        (:full_name, :email, :phone, :membership_type, :start_date, :assigned_trainer_id, :status)';

    $insertStmt = $pdo->prepare($insertSql);
    $insertStmt->execute([
        'full_name'           => $memberData['full_name'],
        'email'               => $memberData['email'],
        'phone'               => $memberData['phone'],
        'membership_type'     => $memberData['membership_type'],
        'start_date'          => $memberData['start_date'],
        'assigned_trainer_id' => $memberData['assigned_trainer_id'],
        'status'              => $memberData['status'],
    ]);

    $memberId = (int) $pdo->lastInsertId();
    createPendingUserForMember(
        $pdo,
        $memberId,
        $memberData['email'],
        $memberData['full_name']
    );

    $pdo->commit();

    $memberRow = fetchMemberRowById($pdo, $memberId);

    if (!$memberRow) {
        errorResponse('Member was created but could not be loaded.', 500);
    }

    $memberPayload = appendMemberAccountFields(formatMemberRow($memberRow), $memberRow);

    successResponse([
        'member' => $memberPayload,
    ], 'Member created successfully', 200);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    errorResponse('Failed to create member.', 500, [
        'error' => $e->getMessage(),
    ]);
}
