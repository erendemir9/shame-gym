<?php
/**
 * finance/create.php — create a finance transaction (admin only).
 *
 * POST api/finance/create.php
 */

declare(strict_types=1);

ini_set('display_errors', '0');
error_reporting(E_ALL);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/auth.php';
require_once __DIR__ . '/../config/request.php';
require_once __DIR__ . '/finance_input.php';

requireHttpMethod('POST');

try {
    $user = requireRole('admin');

    $body = getJsonRequestBody();
    if ($body === null) {
        errorResponse('Request body is required.', 400);
    }

    $normalized = normalizeFinanceWritePayload($body, false);
    if (!$normalized['ok']) {
        errorResponse($normalized['message'], 400);
    }

    $data = $normalized['data'];
    $pdo = getDatabaseConnection();

    $insertSql = 'INSERT INTO finance_transactions
        (transaction_type, category, amount, description, transaction_date, created_by_user_id)
        VALUES
        (:transaction_type, :category, :amount, :description, :transaction_date, :created_by_user_id)';

    $insertStmt = $pdo->prepare($insertSql);
    $insertStmt->execute([
        'transaction_type'   => $data['transaction_type'],
        'category'           => $data['category'],
        'amount'             => $data['amount'],
        'description'        => $data['description'],
        'transaction_date'   => $data['transaction_date'],
        'created_by_user_id' => (int) $user['id'],
    ]);

    $financeId = (int) $pdo->lastInsertId();
    $row = fetchFinanceRowById($pdo, $financeId);

    if (!$row) {
        errorResponse('Transaction was created but could not be loaded.', 500);
    }

    successResponse([
        'transaction' => formatFinanceRow($row),
        'id'          => $financeId,
    ], 'Transaction created successfully', 200);
} catch (Throwable $e) {
    errorResponse('Failed to create transaction.', 500, [
        'error' => $e->getMessage(),
    ]);
}
