<?php
/**
 * import/run.php — run legacy member CSV import (admin only).
 *
 * POST multipart/form-data
 * Field: file
 */

declare(strict_types=1);

ini_set('display_errors', '0');
error_reporting(E_ALL);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/auth.php';
require_once __DIR__ . '/import_input.php';

requireHttpMethod('POST');

try {
    $user = requireRole('admin');

    if (!isset($_FILES['file']) || !is_array($_FILES['file'])) {
        errorResponse('CSV file is required.', 400);
    }

    $fileValidation = validateLegacyCsvUploadFile($_FILES['file']);
    if (!$fileValidation['ok']) {
        errorResponse($fileValidation['message'], 400);
    }

    $pdo = getDatabaseConnection();
    $processed = processLegacyCsvFile($fileValidation['tmp_name'], $pdo);

    if (!$processed['ok']) {
        errorResponse($processed['message'], 400);
    }

    ensureLegacyImportUploadDir();
    $storedFilename = generateLegacyImportStoredFilename();
    $absolutePath = getLegacyImportUploadDir() . '/' . $storedFilename;

    if (!move_uploaded_file($fileValidation['tmp_name'], $absolutePath)) {
        errorResponse('Failed to store uploaded file.', 500);
    }

    $summary = executeLegacyImport(
        $pdo,
        $processed,
        $user,
        $fileValidation['original'],
        $storedFilename
    );

    successResponse($summary, 'Legacy import completed successfully');
} catch (Throwable $e) {
    errorResponse('Failed to run legacy import.', 500, [
        'error' => $e->getMessage(),
    ]);
}
