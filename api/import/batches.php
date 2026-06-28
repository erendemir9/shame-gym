<?php
/**
 * import/batches.php — list recent legacy import batches (admin only).
 *
 * GET api/import/batches.php
 */

declare(strict_types=1);

ini_set('display_errors', '0');
error_reporting(E_ALL);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/auth.php';
require_once __DIR__ . '/import_input.php';

requireHttpMethod('GET');

try {
    requireRole('admin');

    $pdo = getDatabaseConnection();
    $stmt = $pdo->query(
        'SELECT id, import_type, original_filename, stored_filename, total_rows, valid_rows,
                rejected_rows, imported_rows, status, created_by_user_id, created_at, completed_at
         FROM import_batches
         ORDER BY id DESC
         LIMIT 50'
    );

    $batches = [];
    foreach ($stmt->fetchAll() as $row) {
        $batches[] = formatImportBatchRow($row);
    }

    successResponse(['batches' => $batches], 'Import batches loaded successfully');
} catch (Throwable $e) {
    errorResponse('Failed to load import batches.', 500, [
        'error' => $e->getMessage(),
    ]);
}
