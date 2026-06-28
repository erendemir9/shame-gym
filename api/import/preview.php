<?php
/**
 * import/preview.php — preview legacy member CSV without database writes.
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
    requireRole('admin');

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

    successResponse(
        buildLegacyImportPreviewResponse($processed),
        'Import preview generated successfully'
    );
} catch (Throwable $e) {
    errorResponse('Failed to preview import file.', 500, [
        'error' => $e->getMessage(),
    ]);
}
