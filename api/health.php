<?php
/**
 * health.php — database connectivity check for Sprint 3 Part 3.
 *
 * URL: http://localhost/shame-gym/api/health.php
 *
 * Runs safe SELECT queries only and returns JSON with connection status
 * and row counts for key tables. Does not expose credentials.
 */

declare(strict_types=1);

// Prevent PHP warnings/notices from breaking JSON output.
ini_set('display_errors', '0');
error_reporting(E_ALL);

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/config/response.php';

/**
 * Count rows in a table using a prepared statement.
 *
 * @param PDO    $pdo
 * @param string $tableName Whitelist table name only — never from user input
 * @return int
 */
function countTableRows(PDO $pdo, $tableName)
{
    $allowedTables = [
        'users',
        'members',
        'trainers',
        'classes',
        'documents',
        'polls',
        'finance_transactions',
    ];

    if (!in_array($tableName, $allowedTables, true)) {
        throw InvalidArgumentException('Invalid table name.');
    }

    $sql = 'SELECT COUNT(*) AS total FROM `' . $tableName . '`';
    $stmt = $pdo->query($sql);
    $row = $stmt->fetch();

    return (int) ($row['total'] ?? 0);
}

try {
    $pdo = getDatabaseConnection();

    $counts = [
        'users'                => countTableRows($pdo, 'users'),
        'members'              => countTableRows($pdo, 'members'),
        'trainers'             => countTableRows($pdo, 'trainers'),
        'classes'              => countTableRows($pdo, 'classes'),
        'documents'            => countTableRows($pdo, 'documents'),
        'polls'                => countTableRows($pdo, 'polls'),
        'finance_transactions' => countTableRows($pdo, 'finance_transactions'),
    ];

    successResponse([
        'database' => 'shame_gym_db',
        'status'   => 'connected',
        'counts'   => $counts,
    ], 'Database connection successful');
} catch (Throwable $e) {
    errorResponse('Database connection failed.', 500, [
        'error' => $e->getMessage(),
    ]);
}
