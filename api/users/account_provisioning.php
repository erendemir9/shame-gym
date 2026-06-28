<?php
/**
 * account_provisioning.php — create and sync pending user accounts for members/trainers.
 */

declare(strict_types=1);

/**
 * Normalize an email for storage and lookup.
 *
 * @param string $email
 * @return string
 */
function normalizeUserEmail($email)
{
    return strtolower(trim((string) $email));
}

/**
 * Return true when an email is already used in users, members, or trainers.
 *
 * @param PDO    $pdo
 * @param string $email
 * @param int|null $ignoreMemberId
 * @param int|null $ignoreTrainerId
 * @param int|null $ignoreUserId
 * @return bool
 */
function isEmailTakenAcrossAccounts(PDO $pdo, $email, $ignoreMemberId = null, $ignoreTrainerId = null, $ignoreUserId = null)
{
    $normalizedEmail = normalizeUserEmail($email);

    $userSql = 'SELECT id FROM users WHERE email = :email';
    $userParams = ['email' => $normalizedEmail];
    if ($ignoreUserId !== null) {
        $userSql .= ' AND id != :ignore_user_id';
        $userParams['ignore_user_id'] = $ignoreUserId;
    }
    $userSql .= ' LIMIT 1';

    $userStmt = $pdo->prepare($userSql);
    $userStmt->execute($userParams);
    if ($userStmt->fetch()) {
        return true;
    }

    $memberSql = 'SELECT id FROM members WHERE email = :email';
    $memberParams = ['email' => $normalizedEmail];
    if ($ignoreMemberId !== null) {
        $memberSql .= ' AND id != :ignore_member_id';
        $memberParams['ignore_member_id'] = $ignoreMemberId;
    }
    $memberSql .= ' LIMIT 1';

    $memberStmt = $pdo->prepare($memberSql);
    $memberStmt->execute($memberParams);
    if ($memberStmt->fetch()) {
        return true;
    }

    $trainerSql = 'SELECT id FROM trainers WHERE email = :email';
    $trainerParams = ['email' => $normalizedEmail];
    if ($ignoreTrainerId !== null) {
        $trainerSql .= ' AND id != :ignore_trainer_id';
        $trainerParams['ignore_trainer_id'] = $ignoreTrainerId;
    }
    $trainerSql .= ' LIMIT 1';

    $trainerStmt = $pdo->prepare($trainerSql);
    $trainerStmt->execute($trainerParams);
    if ($trainerStmt->fetch()) {
        return true;
    }

    return false;
}

/**
 * Ensure an email is free before creating a new member profile + user account.
 *
 * @param PDO    $pdo
 * @param string $email
 * @return void
 */
function assertEmailAvailableForNewMember(PDO $pdo, $email)
{
    if (isEmailTakenAcrossAccounts($pdo, $email)) {
        errorResponse('A member, trainer, or user account with this email already exists.', 409);
    }
}

/**
 * Ensure an email is free before creating a new trainer profile + user account.
 *
 * @param PDO    $pdo
 * @param string $email
 * @return void
 */
function assertEmailAvailableForNewTrainer(PDO $pdo, $email)
{
    if (isEmailTakenAcrossAccounts($pdo, $email)) {
        errorResponse('A trainer, member, or user account with this email already exists.', 409);
    }
}

/**
 * Insert a pending member login account linked to a member profile.
 *
 * @param PDO    $pdo
 * @param int    $memberId
 * @param string $email
 * @param string $fullName
 * @return void
 */
function createPendingUserForMember(PDO $pdo, $memberId, $email, $fullName)
{
    $insertSql = 'INSERT INTO users
        (email, password_hash, full_name, role, linked_member_id, linked_trainer_id, needs_password_setup, is_active)
        VALUES
        (:email, NULL, :full_name, :role, :linked_member_id, NULL, 1, 1)';

    $insertStmt = $pdo->prepare($insertSql);
    $insertStmt->execute([
        'email'             => normalizeUserEmail($email),
        'full_name'         => trim((string) $fullName),
        'role'              => 'member',
        'linked_member_id'  => $memberId,
    ]);
}

/**
 * Insert a pending trainer login account linked to a trainer profile.
 *
 * @param PDO    $pdo
 * @param int    $trainerId
 * @param string $email
 * @param string $fullName
 * @return void
 */
function createPendingUserForTrainer(PDO $pdo, $trainerId, $email, $fullName)
{
    $insertSql = 'INSERT INTO users
        (email, password_hash, full_name, role, linked_member_id, linked_trainer_id, needs_password_setup, is_active)
        VALUES
        (:email, NULL, :full_name, :role, NULL, :linked_trainer_id, 1, 1)';

    $insertStmt = $pdo->prepare($insertSql);
    $insertStmt->execute([
        'email'              => normalizeUserEmail($email),
        'full_name'          => trim((string) $fullName),
        'role'               => 'trainer',
        'linked_trainer_id'  => $trainerId,
    ]);
}

/**
 * Keep linked member user email/name in sync after an admin update.
 *
 * @param PDO    $pdo
 * @param int    $memberId
 * @param string $email
 * @param string $fullName
 * @return void
 */
function syncUserEmailForMember(PDO $pdo, $memberId, $email, $fullName)
{
    $linkedUser = fetchLinkedUserForMember($pdo, $memberId);
    if (!$linkedUser) {
        return;
    }

    $updateSql = 'UPDATE users
                  SET email = :email,
                      full_name = :full_name,
                      updated_at = CURRENT_TIMESTAMP
                  WHERE id = :id';
    $updateStmt = $pdo->prepare($updateSql);
    $updateStmt->execute([
        'email'     => normalizeUserEmail($email),
        'full_name' => trim((string) $fullName),
        'id'        => (int) $linkedUser['id'],
    ]);
}

/**
 * Keep linked trainer user email/name in sync after an admin update.
 *
 * @param PDO    $pdo
 * @param int    $trainerId
 * @param string $email
 * @param string $fullName
 * @return void
 */
function syncUserEmailForTrainer(PDO $pdo, $trainerId, $email, $fullName)
{
    $linkedUser = fetchLinkedUserForTrainer($pdo, $trainerId);
    if (!$linkedUser) {
        return;
    }

    $updateSql = 'UPDATE users
                  SET email = :email,
                      full_name = :full_name,
                      updated_at = CURRENT_TIMESTAMP
                  WHERE id = :id';
    $updateStmt = $pdo->prepare($updateSql);
    $updateStmt->execute([
        'email'     => normalizeUserEmail($email),
        'full_name' => trim((string) $fullName),
        'id'        => (int) $linkedUser['id'],
    ]);
}

/**
 * Deactivate the login account linked to a member profile.
 *
 * @param PDO $pdo
 * @param int $memberId
 * @return void
 */
function deactivateLinkedUserForMember(PDO $pdo, $memberId)
{
    $updateSql = 'UPDATE users
                  SET is_active = 0,
                      updated_at = CURRENT_TIMESTAMP
                  WHERE linked_member_id = :linked_member_id
                    AND role = :role';
    $updateStmt = $pdo->prepare($updateSql);
    $updateStmt->execute([
        'linked_member_id' => $memberId,
        'role'             => 'member',
    ]);
}

/**
 * Deactivate the login account linked to a trainer profile.
 *
 * @param PDO $pdo
 * @param int $trainerId
 * @return void
 */
function deactivateLinkedUserForTrainer(PDO $pdo, $trainerId)
{
    $updateSql = 'UPDATE users
                  SET is_active = 0,
                      updated_at = CURRENT_TIMESTAMP
                  WHERE linked_trainer_id = :linked_trainer_id
                    AND role = :role';
    $updateStmt = $pdo->prepare($updateSql);
    $updateStmt->execute([
        'linked_trainer_id' => $trainerId,
        'role'              => 'trainer',
    ]);
}

/**
 * Load the user row linked to a member profile.
 *
 * @param PDO $pdo
 * @param int $memberId
 * @return array|null
 */
function fetchLinkedUserForMember(PDO $pdo, $memberId)
{
    $sql = 'SELECT id, email, role, linked_member_id, linked_trainer_id, needs_password_setup, is_active
            FROM users
            WHERE linked_member_id = :linked_member_id
              AND role = :role
            LIMIT 1';

    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        'linked_member_id' => $memberId,
        'role'             => 'member',
    ]);

    $row = $stmt->fetch();

    return $row ?: null;
}

/**
 * Load the user row linked to a trainer profile.
 *
 * @param PDO $pdo
 * @param int $trainerId
 * @return array|null
 */
function fetchLinkedUserForTrainer(PDO $pdo, $trainerId)
{
    $sql = 'SELECT id, email, role, linked_member_id, linked_trainer_id, needs_password_setup, is_active
            FROM users
            WHERE linked_trainer_id = :linked_trainer_id
              AND role = :role
            LIMIT 1';

    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        'linked_trainer_id' => $trainerId,
        'role'              => 'trainer',
    ]);

    $row = $stmt->fetch();

    return $row ?: null;
}

/**
 * Build a human-readable account status label from linked user data.
 *
 * @param array|null $userRow
 * @return string
 */
function buildMemberAccountStatusLabel($userRow)
{
    if (!$userRow || !isset($userRow['id'])) {
        return 'No account';
    }

    if ((int) ($userRow['is_active'] ?? 0) !== 1) {
        return 'Inactive';
    }

    if ((int) ($userRow['needs_password_setup'] ?? 0) === 1) {
        return 'Pending activation';
    }

    return 'Active';
}

/**
 * Append account fields to a formatted member payload.
 *
 * @param array $member
 * @param array $row
 * @return array
 */
function appendMemberAccountFields(array $member, array $row)
{
    $accountExists = isset($row['account_user_id']) && $row['account_user_id'] !== null;
    $userRow = null;

    if ($accountExists) {
        $userRow = [
            'id'                   => $row['account_user_id'],
            'email'                => $row['account_email'] ?? null,
            'role'                 => $row['account_role'] ?? null,
            'needs_password_setup' => $row['account_needs_password_setup'] ?? null,
            'is_active'            => $row['account_is_active'] ?? null,
        ];
    }

    $member['account_exists'] = $accountExists;
    $member['account_email'] = $accountExists ? (string) $row['account_email'] : null;
    $member['account_role'] = $accountExists ? (string) $row['account_role'] : null;
    $member['needs_password_setup'] = $accountExists ? (int) $row['account_needs_password_setup'] : null;
    $member['account_is_active'] = $accountExists ? (int) $row['account_is_active'] : null;
    $member['account_status_label'] = buildMemberAccountStatusLabel($userRow);

    return $member;
}
