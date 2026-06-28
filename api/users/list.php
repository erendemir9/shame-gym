<?php
/**
 * users/list.php — safe active user list for staff attendee selection.
 *
 * GET api/users/list.php
 * Admin only. Returns admin/trainer users without sensitive fields.
 */

declare(strict_types=1);

ini_set('display_errors', '0');
error_reporting(E_ALL);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/auth.php';
require_once __DIR__ . '/../config/request.php';

requireHttpMethod('GET');

try {
    requireRole('admin');

    $pdo = getDatabaseConnection();

    $sql = 'SELECT u.id, u.email, u.full_name, u.role,
                   u.linked_member_id, u.linked_trainer_id, u.is_active,
                   m.full_name AS member_full_name,
                   t.full_name AS trainer_full_name
            FROM users u
            LEFT JOIN members m ON m.id = u.linked_member_id
            LEFT JOIN trainers t ON t.id = u.linked_trainer_id
            WHERE u.is_active = 1
              AND u.role IN (\'admin\', \'trainer\')
            ORDER BY u.full_name ASC, u.email ASC';

    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $rows = $stmt->fetchAll();

    $users = [];
    foreach ($rows as $row) {
        $displayName = (string) $row['full_name'];
        if ($row['trainer_full_name'] !== null && trim((string) $row['trainer_full_name']) !== '') {
            $displayName = (string) $row['trainer_full_name'];
        } elseif ($row['member_full_name'] !== null && trim((string) $row['member_full_name']) !== '') {
            $displayName = (string) $row['member_full_name'];
        }

        $users[] = [
            'id'                 => (int) $row['id'],
            'email'              => (string) $row['email'],
            'role'               => (string) $row['role'],
            'display_name'       => $displayName,
            'linked_member_id'   => $row['linked_member_id'] !== null ? (int) $row['linked_member_id'] : null,
            'linked_trainer_id'  => $row['linked_trainer_id'] !== null ? (int) $row['linked_trainer_id'] : null,
            'is_active'          => (int) $row['is_active'],
        ];
    }

    successResponse(['users' => $users], 'Users loaded successfully');
} catch (Throwable $e) {
    errorResponse('Failed to load users.', 500, [
        'error' => $e->getMessage(),
    ]);
}
