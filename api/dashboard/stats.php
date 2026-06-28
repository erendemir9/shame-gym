<?php
/**
 * dashboard/stats.php — role-aware dashboard stats from MySQL.
 *
 * GET api/dashboard/stats.php
 */

declare(strict_types=1);

ini_set('display_errors', '0');
error_reporting(E_ALL);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/auth.php';
require_once __DIR__ . '/../config/request.php';
require_once __DIR__ . '/dashboard_helpers.php';

requireHttpMethod('GET');

try {
    $user = requireLogin();
    $pdo = getDatabaseConnection();
    $role = isset($user['role']) ? (string) $user['role'] : '';

    if ($role === 'admin') {
        $dashboardStats = buildAdminDashboardStats($pdo);
    } elseif ($role === 'trainer') {
        $dashboardStats = buildTrainerDashboardStats($pdo, $user);
    } elseif ($role === 'member') {
        $dashboardStats = buildMemberDashboardStats($pdo, $user);
    } else {
        errorResponse('Unsupported role for dashboard stats.', 403);
    }

    successResponse($dashboardStats, 'Dashboard stats loaded successfully');
} catch (Throwable $e) {
    errorResponse('Failed to load dashboard stats.', 500, [
        'error' => $e->getMessage(),
    ]);
}
