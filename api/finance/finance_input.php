<?php
/**
 * finance_input.php — shared helpers for finance APIs.
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/request.php';

const FINANCE_ALLOWED_TYPES = ['income', 'expense'];

/**
 * Parse finance transaction id from request value.
 *
 * @param mixed $rawId
 * @return int|null
 */
function parseFinanceIdFromRequest($rawId)
{
    if ($rawId === null || $rawId === '') {
        return null;
    }

    if (is_int($rawId) && $rawId > 0) {
        return $rawId;
    }

    if (is_string($rawId) && ctype_digit($rawId)) {
        $financeId = (int) $rawId;
        return $financeId > 0 ? $financeId : null;
    }

    return null;
}

/**
 * Format finance row for JSON output.
 *
 * @param array $row
 * @return array
 */
function formatFinanceRow(array $row)
{
    return [
        'id'                 => (int) $row['id'],
        'transaction_type'   => (string) $row['transaction_type'],
        'type'               => (string) $row['transaction_type'],
        'category'           => (string) $row['category'],
        'amount'             => round((float) $row['amount'], 2),
        'description'        => $row['description'] !== null ? (string) $row['description'] : '',
        'transaction_date'   => (string) $row['transaction_date'],
        'date'               => (string) $row['transaction_date'],
        'created_by_user_id' => $row['created_by_user_id'] !== null ? (int) $row['created_by_user_id'] : null,
        'created_at'         => (string) $row['created_at'],
        'updated_at'         => (string) $row['updated_at'],
    ];
}

/**
 * Load one finance row by id.
 *
 * @param PDO $pdo
 * @param int $financeId
 * @return array|null
 */
function fetchFinanceRowById(PDO $pdo, $financeId)
{
    $stmt = $pdo->prepare(
        'SELECT id, transaction_type, category, amount, description, transaction_date,
                created_by_user_id, created_at, updated_at
         FROM finance_transactions
         WHERE id = :id
         LIMIT 1'
    );
    $stmt->execute(['id' => $financeId]);
    $row = $stmt->fetch();

    return $row ?: null;
}

/**
 * Normalize finance write payload.
 *
 * @param array $body
 * @param bool  $requireId
 * @return array{ok:bool,message?:string,data?:array}
 */
function normalizeFinanceWritePayload(array $body, $requireId = false)
{
    $financeId = null;
    if ($requireId) {
        if (!array_key_exists('id', $body)) {
            return ['ok' => false, 'message' => 'Transaction id is required.'];
        }
        $financeId = parseFinanceIdFromRequest($body['id']);
        if ($financeId === null) {
            return ['ok' => false, 'message' => 'Invalid transaction id.'];
        }
    }

    $transactionType = null;
    if (isset($body['transaction_type']) && trim((string) $body['transaction_type']) !== '') {
        $transactionType = strtolower(trim((string) $body['transaction_type']));
    } elseif (isset($body['type']) && trim((string) $body['type']) !== '') {
        $transactionType = strtolower(trim((string) $body['type']));
    }

    if ($transactionType === null || !in_array($transactionType, FINANCE_ALLOWED_TYPES, true)) {
        return ['ok' => false, 'message' => 'Valid transaction type is required (income or expense).'];
    }

    $category = isset($body['category']) ? trim((string) $body['category']) : '';
    if ($category === '') {
        return ['ok' => false, 'message' => 'Category is required.'];
    }

    if (!isset($body['amount'])) {
        return ['ok' => false, 'message' => 'Amount is required.'];
    }

    if (!is_numeric($body['amount'])) {
        return ['ok' => false, 'message' => 'Amount must be a number.'];
    }

    $amount = round((float) $body['amount'], 2);
    if ($amount <= 0) {
        return ['ok' => false, 'message' => 'Amount must be greater than zero.'];
    }

    $transactionDate = null;
    if (isset($body['transaction_date']) && trim((string) $body['transaction_date']) !== '') {
        $transactionDate = trim((string) $body['transaction_date']);
    } elseif (isset($body['date']) && trim((string) $body['date']) !== '') {
        $transactionDate = trim((string) $body['date']);
    }

    if ($transactionDate === null || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $transactionDate)) {
        return ['ok' => false, 'message' => 'Valid transaction date is required (YYYY-MM-DD).'];
    }

    $description = null;
    if (isset($body['description']) && trim((string) $body['description']) !== '') {
        $description = trim((string) $body['description']);
    }

    $data = [
        'transaction_type' => $transactionType,
        'category'         => substr($category, 0, 80),
        'amount'           => $amount,
        'description'      => $description !== null ? substr($description, 0, 255) : null,
        'transaction_date' => $transactionDate,
    ];

    if ($requireId) {
        $data['id'] = $financeId;
    }

    return ['ok' => true, 'data' => $data];
}

/**
 * Build optional list filters from query string.
 *
 * @return array
 */
function getFinanceListFilters()
{
    $filters = [
        'search' => getQueryString('search'),
        'type'   => getQueryString('type'),
        'category' => getQueryString('category'),
        'date_from' => getQueryString('date_from'),
        'date_to' => getQueryString('date_to'),
    ];

    if ($filters['type'] !== null) {
        $filters['type'] = strtolower($filters['type']);
        if (!in_array($filters['type'], FINANCE_ALLOWED_TYPES, true)) {
            $filters['type'] = null;
        }
    }

    return $filters;
}

/**
 * Append finance list filter SQL.
 *
 * @param array $filters
 * @param array $params
 * @return string
 */
function buildFinanceListWhereClause(array $filters, array &$params)
{
    $conditions = ['1 = 1'];

    if ($filters['search'] !== null) {
        $searchValue = '%' . $filters['search'] . '%';
        $conditions[] = '(category LIKE :search_category OR description LIKE :search_description)';
        $params['search_category'] = $searchValue;
        $params['search_description'] = $searchValue;
    }

    if ($filters['type'] !== null) {
        $conditions[] = 'transaction_type = :transaction_type';
        $params['transaction_type'] = $filters['type'];
    }

    if ($filters['category'] !== null) {
        $conditions[] = 'category = :category';
        $params['category'] = $filters['category'];
    }

    if ($filters['date_from'] !== null && preg_match('/^\d{4}-\d{2}-\d{2}$/', $filters['date_from'])) {
        $conditions[] = 'transaction_date >= :date_from';
        $params['date_from'] = $filters['date_from'];
    }

    if ($filters['date_to'] !== null && preg_match('/^\d{4}-\d{2}-\d{2}$/', $filters['date_to'])) {
        $conditions[] = 'transaction_date <= :date_to';
        $params['date_to'] = $filters['date_to'];
    }

    return ' WHERE ' . implode(' AND ', $conditions);
}
