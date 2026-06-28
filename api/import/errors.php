<?php
/**
 * import/errors.php — list import error rows (admin only).
 *
 * GET api/import/errors.php?batch_id=
 */

declare(strict_types=1);

ini_set('display_errors', '0');
error_reporting(E_ALL);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/auth.php';
require_once __DIR__ . '/../config/request.php';
require_once __DIR__ . '/import_input.php';

requireHttpMethod('GET');

try {
    requireRole('admin');

    $batchId = getQueryInt('batch_id');
    $pdo = getDatabaseConnection();

    if ($batchId !== null) {
        $stmt = $pdo->prepare(
            'SELECT id, batch_id, row_number, raw_data, error_message, created_at
             FROM import_errors
             WHERE batch_id = :batch_id
             ORDER BY row_number ASC
             LIMIT 500'
        );
        $stmt->execute(['batch_id' => $batchId]);
    } else {
        $stmt = $pdo->query(
            'SELECT id, batch_id, row_number, raw_data, error_message, created_at
             FROM import_errors
             ORDER BY id DESC
             LIMIT 100'
        );
    }

    $errors = [];
    foreach ($stmt->fetchAll() as $row) {
        $errors[] = formatImportErrorRow($row);
    }

    successResponse(['errors' => $errors], 'Import errors loaded successfully');
} catch (Throwable $e) {
    errorResponse('Failed to load import errors.', 500, [
        'error' => $e->getMessage(),
    ]);
}
