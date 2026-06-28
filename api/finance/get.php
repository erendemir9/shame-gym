<?php
/**
 * finance/get.php — fetch one finance transaction (admin only).
 *
 * GET api/finance/get.php?id=
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
    $financeId = getQueryInt('id');

    if ($financeId === null) {
        errorResponse('Transaction id is required.', 400);
    }

    $pdo = getDatabaseConnection();
    $row = fetchFinanceRowById($pdo, $financeId);

    if (!$row) {
        errorResponse('Transaction not found.', 404);
    }

    successResponse([
        'transaction' => formatFinanceRow($row),
    ], 'Transaction loaded successfully');
} catch (Throwable $e) {
    errorResponse('Failed to load transaction.', 500, [
        'error' => $e->getMessage(),
    ]);
}
