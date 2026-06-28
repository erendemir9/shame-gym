<?php
/**
 * finance/summary.php — finance totals and counts (admin only).
 *
 * GET api/finance/summary.php
 * Optional filters: search, type, category, date_from, date_to
 */

declare(strict_types=1);

ini_set('display_errors', '0');
error_reporting(E_ALL);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/auth.php';
require_once __DIR__ . '/../config/request.php';
require_once __DIR__ . '/finance_input.php';

requireHttpMethod('GET');

try {
    requireRole('admin');
    $pdo = getDatabaseConnection();

    $filters = getFinanceListFilters();
    $params = [];
    $where = buildFinanceListWhereClause($filters, $params);

    $sql = 'SELECT
                COUNT(*) AS transaction_count,
                COALESCE(SUM(CASE WHEN transaction_type = \'income\' THEN amount ELSE 0 END), 0) AS total_income,
                COALESCE(SUM(CASE WHEN transaction_type = \'expense\' THEN amount ELSE 0 END), 0) AS total_expenses
            FROM finance_transactions' . $where;

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $row = $stmt->fetch();

    $totalIncome = round((float) ($row['total_income'] ?? 0), 2);
    $totalExpenses = round((float) ($row['total_expenses'] ?? 0), 2);
    $balance = round($totalIncome - $totalExpenses, 2);

    successResponse([
        'summary' => [
            'transaction_count' => (int) ($row['transaction_count'] ?? 0),
            'total_income'    => $totalIncome,
            'total_expenses'  => $totalExpenses,
            'balance'         => $balance,
        ],
    ], 'Finance summary loaded successfully');
} catch (Throwable $e) {
    errorResponse('Failed to load finance summary.', 500, [
        'error' => $e->getMessage(),
    ]);
}
