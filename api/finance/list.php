<?php
/**
 * finance/list.php — list finance transactions (admin only).
 *
 * GET api/finance/list.php
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

    $sql = 'SELECT id, transaction_type, category, amount, description, transaction_date,
                   created_by_user_id, created_at, updated_at
            FROM finance_transactions' . $where . '
            ORDER BY transaction_date DESC, id DESC';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    $transactions = [];
    foreach ($rows as $row) {
        $transactions[] = formatFinanceRow($row);
    }

    successResponse(['transactions' => $transactions], 'Finance transactions loaded successfully');
} catch (Throwable $e) {
    errorResponse('Failed to load finance transactions.', 500, [
        'error' => $e->getMessage(),
    ]);
}
