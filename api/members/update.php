<?php
/**
 * members/update.php — admin-only update member.
 *
 * POST api/members/update.php
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

    $normalized = normalizeMemberWritePayload($body, true);
    if (!$normalized['ok']) {
        errorResponse($normalized['message'], 400);
    }

    $memberData = $normalized['data'];
    $memberId = $memberData['id'];
    $pdo = getDatabaseConnection();

    $existingMember = fetchMemberRowById($pdo, $memberId);
    if (!$existingMember) {
        errorResponse('Member not found.', 404);
    }

    if (!trainerExists($pdo, $memberData['assigned_trainer_id'])) {
        errorResponse('Assigned trainer not found.', 400);
    }

    $linkedUser = fetchLinkedUserForMember($pdo, $memberId);
    $ignoreUserId = $linkedUser ? (int) $linkedUser['id'] : null;

    if (isEmailTakenAcrossAccounts($pdo, $memberData['email'], $memberId, null, $ignoreUserId)) {
        errorResponse('Another member, trainer, or user account already uses this email.', 409);
    }

    $pdo->beginTransaction();

    $updateSql = 'UPDATE members
                  SET full_name = :full_name,
                      email = :email,
                      phone = :phone,
                      membership_type = :membership_type,
                      start_date = :start_date,
                      assigned_trainer_id = :assigned_trainer_id,
                      status = :status,
                      updated_at = CURRENT_TIMESTAMP
                  WHERE id = :id';

    $updateStmt = $pdo->prepare($updateSql);
    $updateStmt->execute([
        'full_name'           => $memberData['full_name'],
        'email'               => $memberData['email'],
        'phone'               => $memberData['phone'],
        'membership_type'     => $memberData['membership_type'],
        'start_date'          => $memberData['start_date'],
        'assigned_trainer_id' => $memberData['assigned_trainer_id'],
        'status'              => $memberData['status'],
        'id'                  => $memberId,
    ]);

    syncUserEmailForMember(
        $pdo,
        $memberId,
        $memberData['email'],
        $memberData['full_name']
    );

    $pdo->commit();

    $memberRow = fetchMemberRowById($pdo, $memberId);
    if (!$memberRow) {
        errorResponse('Member was updated but could not be loaded.', 500);
    }

    $memberPayload = appendMemberAccountFields(formatMemberRow($memberRow), $memberRow);

    successResponse([
        'member' => $memberPayload,
    ], 'Member updated successfully', 200);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    errorResponse('Failed to update member.', 500, [
        'error' => $e->getMessage(),
    ]);
}
