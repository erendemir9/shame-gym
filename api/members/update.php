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

    $duplicateSql = 'SELECT id FROM members WHERE email = :email AND id != :id LIMIT 1';
    $duplicateStmt = $pdo->prepare($duplicateSql);
    $duplicateStmt->execute([
        'email' => $memberData['email'],
        'id'    => $memberId,
    ]);
    if ($duplicateStmt->fetch()) {
        errorResponse('Another member already uses this email.', 409);
    }

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

    $memberRow = fetchMemberRowById($pdo, $memberId);
    if (!$memberRow) {
        errorResponse('Member was updated but could not be loaded.', 500);
    }

    successResponse([
        'member' => formatMemberRow($memberRow),
    ], 'Member updated successfully', 200);
} catch (Throwable $e) {
    errorResponse('Failed to update member.', 500, [
        'error' => $e->getMessage(),
    ]);
}
