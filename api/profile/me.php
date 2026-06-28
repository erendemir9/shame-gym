<?php
/**
 * profile/me.php — read and update the current user's profile.
 *
 * GET  api/profile/me.php
 * POST api/profile/me.php
 */

declare(strict_types=1);

ini_set('display_errors', '0');
error_reporting(E_ALL);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/auth.php';
require_once __DIR__ . '/../config/request.php';
require_once __DIR__ . '/profile_input.php';
require_once __DIR__ . '/../users/account_provisioning.php';

$method = isset($_SERVER['REQUEST_METHOD']) ? strtoupper($_SERVER['REQUEST_METHOD']) : '';

if ($method !== 'GET' && $method !== 'POST') {
    errorResponse('Method not allowed.', 405, ['allowed' => 'GET, POST']);
}

try {
    $sessionUser = requireLogin();
    $pdo = getDatabaseConnection();
    $userId = (int) $sessionUser['id'];

    $userRow = fetchUserRowById($pdo, $userId);
    if (!$userRow) {
        errorResponse('User account not found.', 404);
    }

    if ((int) $userRow['is_active'] !== 1) {
        errorResponse('This account is inactive.', 403);
    }

    if ($method === 'GET') {
        $profile = buildProfileDetails($pdo, $userRow);

        successResponse([
            'user'    => formatProfileUserPayload($userRow),
            'profile' => $profile,
        ], 'Profile loaded successfully');
    }

    $body = getJsonRequestBody();
    if ($body === null) {
        errorResponse('Request body is required.', 400);
    }

    $normalized = normalizeProfileUpdatePayload($body);
    if (!$normalized['ok']) {
        errorResponse($normalized['message'], 400);
    }

    $profileData = $normalized['data'];
    $role = (string) $userRow['role'];
    $memberId = $userRow['linked_member_id'] !== null ? (int) $userRow['linked_member_id'] : null;
    $trainerId = $userRow['linked_trainer_id'] !== null ? (int) $userRow['linked_trainer_id'] : null;

    if (isEmailTakenAcrossAccounts($pdo, $profileData['email'], $memberId, $trainerId, $userId)) {
        errorResponse('That email is already in use.', 409);
    }

    $pdo->beginTransaction();

    $updateUserSql = 'UPDATE users
                       SET full_name = :full_name,
                           email = :email,
                           updated_at = CURRENT_TIMESTAMP
                       WHERE id = :id';
    $updateUserStmt = $pdo->prepare($updateUserSql);
    $updateUserStmt->execute([
        'full_name' => $profileData['full_name'],
        'email'     => $profileData['email'],
        'id'        => $userId,
    ]);

    if ($role === 'member' && $memberId !== null) {
        $updateMemberSql = 'UPDATE members
                            SET full_name = :full_name,
                                email = :email,
                                phone = :phone,
                                updated_at = CURRENT_TIMESTAMP
                            WHERE id = :id';
        $updateMemberStmt = $pdo->prepare($updateMemberSql);
        $updateMemberStmt->execute([
            'full_name' => $profileData['full_name'],
            'email'     => $profileData['email'],
            'phone'     => $profileData['phone'],
            'id'        => $memberId,
        ]);
    } elseif ($role === 'trainer' && $trainerId !== null) {
        $updateTrainerSql = 'UPDATE trainers
                             SET full_name = :full_name,
                                 email = :email,
                                 phone = :phone,
                                 updated_at = CURRENT_TIMESTAMP
                             WHERE id = :id';
        $updateTrainerStmt = $pdo->prepare($updateTrainerSql);
        $updateTrainerStmt->execute([
            'full_name' => $profileData['full_name'],
            'email'     => $profileData['email'],
            'phone'     => $profileData['phone'],
            'id'        => $trainerId,
        ]);
    }

    $pdo->commit();

    $userRow = fetchUserRowById($pdo, $userId);
    if (!$userRow) {
        errorResponse('Profile was updated but could not be loaded.', 500);
    }

    $updatedSessionUser = sanitizeSessionUser($userRow);
    setCurrentUser($updatedSessionUser);

    $profile = buildProfileDetails($pdo, $userRow);

    successResponse([
        'user'    => formatProfileUserPayload($userRow),
        'profile' => $profile,
    ], 'Profile updated successfully');
} catch (Throwable $e) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    errorResponse('Profile request failed.', 500, [
        'error' => $e->getMessage(),
    ]);
}
