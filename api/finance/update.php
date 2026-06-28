<?php
/**
 * finance/update.php — update a finance transaction (admin only).
 *
 * POST api/finance/update.php
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
    requireRole('admin');

    $body = getJsonRequestBody();
    if ($body === null) {
        errorResponse('Request body is required.', 400);
    }

    $normalized = normalizeFinanceWritePayload($body, true);
    if (!$normalized['ok']) {
        errorResponse($normalized['message'], 400);
    }

    $data = $normalized['data'];
    $pdo = getDatabaseConnection();
    $existing = fetchFinanceRowById($pdo, $data['id']);

    if (!$existing) {
        errorResponse('Transaction not found.', 404);
    }

    $updateSql = 'UPDATE finance_transactions
                  SET transaction_type = :transaction_type,
                      category = :category,
                      amount = :amount,
                      description = :description,
                      transaction_date = :transaction_date,
                      updated_at = CURRENT_TIMESTAMP
                  WHERE id = :id';

    $updateStmt = $pdo->prepare($updateSql);
    $updateStmt->execute([
        'transaction_type' => $data['transaction_type'],
        'category'         => $data['category'],
        'amount'           => $data['amount'],
        'description'      => $data['description'],
        'transaction_date' => $data['transaction_date'],
        'id'               => $data['id'],
    ]);

    $row = fetchFinanceRowById($pdo, $data['id']);
    if (!$row) {
        errorResponse('Transaction was updated but could not be loaded.', 500);
    }

    successResponse([
        'transaction' => formatFinanceRow($row),
    ], 'Transaction updated successfully', 200);
} catch (Throwable $e) {
    errorResponse('Failed to update transaction.', 500, [
        'error' => $e->getMessage(),
    ]);
}
