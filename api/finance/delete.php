<?php
/**
 * finance/delete.php — delete a finance transaction (admin only).
 *
 * POST api/finance/delete.php
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

    $financeId = parseFinanceIdFromRequest($body['id'] ?? null);
    if ($financeId === null) {
        errorResponse('Transaction id is required.', 400);
    }

    $pdo = getDatabaseConnection();
    $existing = fetchFinanceRowById($pdo, $financeId);

    if (!$existing) {
        errorResponse('Transaction not found.', 404);
    }

    $stmt = $pdo->prepare('DELETE FROM finance_transactions WHERE id = :id');
    $stmt->execute(['id' => $financeId]);

    successResponse([
        'id' => $financeId,
    ], 'Transaction deleted successfully', 200);
} catch (Throwable $e) {
    errorResponse('Failed to delete transaction.', 500, [
        'error' => $e->getMessage(),
    ]);
}
