<?php
/**
 * dashboard_helpers.php — role-aware dashboard stats from MySQL.
 */

declare(strict_types=1);

require_once __DIR__ . '/../users/account_provisioning.php';

/**
 * Count rows using a simple prepared count query.
 *
 * @param PDO    $pdo
 * @param string $sql
 * @param array  $params
 * @return int
 */
function countDashboardRows(PDO $pdo, $sql, array $params = [])
{
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $row = $stmt->fetch();

    return (int) ($row['total'] ?? 0);
}

/**
 * Build admin dashboard stats.
 *
 * @param PDO $pdo
 * @return array
 */
function buildAdminDashboardStats(PDO $pdo)
{
    $activeMembers = countDashboardRows(
        $pdo,
        'SELECT COUNT(*) AS total FROM members WHERE status = :status',
        ['status' => 'active']
    );
    $activeTrainers = countDashboardRows(
        $pdo,
        'SELECT COUNT(*) AS total FROM trainers WHERE status = :status',
        ['status' => 'active']
    );
    $scheduledClasses = countDashboardRows(
        $pdo,
        'SELECT COUNT(*) AS total FROM classes WHERE status = :status',
        ['status' => 'scheduled']
    );
    $activeEnrollments = countDashboardRows(
        $pdo,
        'SELECT COUNT(*) AS total FROM enrollments WHERE status = :status',
        ['status' => 'enrolled']
    );
    $upcomingMeetingsCount = countDashboardRows(
        $pdo,
        'SELECT COUNT(*) AS total FROM meetings
         WHERE status = :status AND meeting_date >= CURDATE()',
        ['status' => 'scheduled']
    );

    $meetingsSql = 'SELECT id, title, meeting_date, meeting_time, location
                    FROM meetings
                    WHERE status = :status AND meeting_date >= CURDATE()
                    ORDER BY meeting_date ASC, meeting_time ASC
                    LIMIT 3';
    $meetingsStmt = $pdo->prepare($meetingsSql);
    $meetingsStmt->execute(['status' => 'scheduled']);
    $meetingRows = $meetingsStmt->fetchAll();

    $upcomingMeetings = [];
    foreach ($meetingRows as $row) {
        $upcomingMeetings[] = [
            'id'       => (int) $row['id'],
            'title'    => (string) $row['title'],
            'date'     => (string) $row['meeting_date'],
            'time'     => substr((string) $row['meeting_time'], 0, 5),
            'location' => $row['location'] !== null ? (string) $row['location'] : '',
        ];
    }

    return [
        'role'  => 'admin',
        'stats' => [
            'active_members'       => $activeMembers,
            'active_trainers'      => $activeTrainers,
            'scheduled_classes'    => $scheduledClasses,
            'active_enrollments'   => $activeEnrollments,
            'upcoming_meetings'    => $upcomingMeetingsCount,
        ],
        'upcoming_meetings' => $upcomingMeetings,
    ];
}

/**
 * Build trainer dashboard stats.
 *
 * @param PDO   $pdo
 * @param array $user
 * @return array
 */
function buildTrainerDashboardStats(PDO $pdo, array $user)
{
    $trainerId = getLinkedTrainerId($user);
    if ($trainerId === null) {
        return [
            'role'  => 'trainer',
            'stats' => [
                'assigned_members'    => 0,
                'scheduled_classes'   => 0,
                'active_enrollments'  => 0,
            ],
            'trainer_profile'   => null,
            'upcoming_classes'  => [],
        ];
    }

    $trainerStmt = $pdo->prepare(
        'SELECT id, full_name, email, specialization, availability, status
         FROM trainers
         WHERE id = :id
         LIMIT 1'
    );
    $trainerStmt->execute(['id' => $trainerId]);
    $trainerRow = $trainerStmt->fetch();

    $assignedMembers = countDashboardRows(
        $pdo,
        'SELECT COUNT(*) AS total FROM members
         WHERE assigned_trainer_id = :trainer_id AND status = :status',
        ['trainer_id' => $trainerId, 'status' => 'active']
    );

    $scheduledClasses = countDashboardRows(
        $pdo,
        'SELECT COUNT(*) AS total FROM classes
         WHERE trainer_id = :trainer_id AND status = :status',
        ['trainer_id' => $trainerId, 'status' => 'scheduled']
    );

    $activeEnrollments = countDashboardRows(
        $pdo,
        'SELECT COUNT(*) AS total
         FROM enrollments e
         INNER JOIN classes c ON c.id = e.class_id
         WHERE c.trainer_id = :trainer_id
           AND e.status = :enrollment_status
           AND c.status = :class_status',
        [
            'trainer_id'         => $trainerId,
            'enrollment_status'  => 'enrolled',
            'class_status'       => 'scheduled',
        ]
    );

    $classesSql = 'SELECT c.id, c.class_name, c.class_date, c.class_time, c.capacity,
                          (SELECT COUNT(*)
                           FROM enrollments e
                           WHERE e.class_id = c.id AND e.status = \'enrolled\') AS enrolled_count
                   FROM classes c
                   WHERE c.trainer_id = :trainer_id
                     AND c.status = :status
                     AND c.class_date >= CURDATE()
                   ORDER BY c.class_date ASC, c.class_time ASC
                   LIMIT 5';
    $classesStmt = $pdo->prepare($classesSql);
    $classesStmt->execute([
        'trainer_id' => $trainerId,
        'status'     => 'scheduled',
    ]);
    $classRows = $classesStmt->fetchAll();

    $upcomingClasses = [];
    foreach ($classRows as $row) {
        $upcomingClasses[] = [
            'id'             => (int) $row['id'],
            'class_name'     => (string) $row['class_name'],
            'date'           => (string) $row['class_date'],
            'time'           => substr((string) $row['class_time'], 0, 5),
            'capacity'       => (int) $row['capacity'],
            'enrolled_count' => (int) $row['enrolled_count'],
        ];
    }

    $trainerProfile = null;
    if ($trainerRow) {
        $trainerProfile = [
            'full_name'       => (string) $trainerRow['full_name'],
            'email'           => (string) $trainerRow['email'],
            'specialization'  => $trainerRow['specialization'] !== null ? (string) $trainerRow['specialization'] : null,
            'availability'    => $trainerRow['availability'] !== null ? (string) $trainerRow['availability'] : null,
            'status'          => (string) $trainerRow['status'],
        ];
    }

    return [
        'role'  => 'trainer',
        'stats' => [
            'assigned_members'   => $assignedMembers,
            'scheduled_classes'  => $scheduledClasses,
            'active_enrollments' => $activeEnrollments,
        ],
        'trainer_profile'  => $trainerProfile,
        'upcoming_classes' => $upcomingClasses,
    ];
}

/**
 * Build member dashboard stats.
 *
 * @param PDO   $pdo
 * @param array $user
 * @return array
 */
function buildMemberDashboardStats(PDO $pdo, array $user)
{
    $memberId = getLinkedMemberId($user);
    if ($memberId === null) {
        return [
            'role'               => 'member',
            'membership'         => null,
            'account_status_label' => 'No account',
            'enrolled_classes'   => [],
            'workout_preview'    => null,
        ];
    }

    $memberStmt = $pdo->prepare(
        'SELECT id, full_name, email, phone, membership_type, start_date, status
         FROM members
         WHERE id = :id
         LIMIT 1'
    );
    $memberStmt->execute(['id' => $memberId]);
    $memberRow = $memberStmt->fetch();

    $userStmt = $pdo->prepare(
        'SELECT needs_password_setup, is_active
         FROM users
         WHERE id = :id
         LIMIT 1'
    );
    $userStmt->execute(['id' => (int) $user['id']]);
    $userAccountRow = $userStmt->fetch();

    $accountStatusLabel = buildMemberAccountStatusLabel([
        'id'                   => (int) $user['id'],
        'needs_password_setup' => $userAccountRow ? (int) $userAccountRow['needs_password_setup'] : 0,
        'is_active'            => $userAccountRow ? (int) $userAccountRow['is_active'] : 0,
    ]);

    $classesSql = 'SELECT c.id, c.class_name, c.class_date, c.class_time, t.full_name AS trainer_name
                   FROM enrollments e
                   INNER JOIN classes c ON c.id = e.class_id
                   INNER JOIN trainers t ON t.id = c.trainer_id
                   WHERE e.member_id = :member_id
                     AND e.status = :enrollment_status
                     AND c.status = :class_status
                   ORDER BY c.class_date ASC, c.class_time ASC';
    $classesStmt = $pdo->prepare($classesSql);
    $classesStmt->execute([
        'member_id'          => $memberId,
        'enrollment_status'  => 'enrolled',
        'class_status'       => 'scheduled',
    ]);
    $classRows = $classesStmt->fetchAll();

    $enrolledClasses = [];
    foreach ($classRows as $row) {
        $enrolledClasses[] = [
            'id'           => (int) $row['id'],
            'class_name'   => (string) $row['class_name'],
            'date'         => (string) $row['class_date'],
            'time'         => substr((string) $row['class_time'], 0, 5),
            'trainer_name' => (string) $row['trainer_name'],
        ];
    }

    $workoutPreview = null;
    $workoutSql = 'SELECT id, plan_name, notes
                   FROM workout_plans
                   WHERE member_id = :member_id AND status = :status
                   ORDER BY updated_at DESC
                   LIMIT 1';
    $workoutStmt = $pdo->prepare($workoutSql);
    $workoutStmt->execute([
        'member_id' => $memberId,
        'status'    => 'active',
    ]);
    $workoutRow = $workoutStmt->fetch();
    if ($workoutRow) {
        $workoutPreview = [
            'plan_name' => (string) $workoutRow['plan_name'],
            'notes'     => $workoutRow['notes'] !== null ? (string) $workoutRow['notes'] : null,
        ];
    }

    $membership = null;
    if ($memberRow) {
        $membership = [
            'full_name'       => (string) $memberRow['full_name'],
            'email'           => (string) $memberRow['email'],
            'membership_type' => (string) $memberRow['membership_type'],
            'start_date'      => $memberRow['start_date'] !== null ? (string) $memberRow['start_date'] : null,
            'status'          => (string) $memberRow['status'],
        ];
    }

    return [
        'role'                 => 'member',
        'membership'           => $membership,
        'account_status_label' => $accountStatusLabel,
        'enrolled_classes'     => $enrolledClasses,
        'workout_preview'      => $workoutPreview,
    ];
}
