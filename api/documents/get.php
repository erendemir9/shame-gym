<?php
/**
 * documents/get.php — fetch one document by id.
 *
 * GET api/documents/get.php?id=
 */

declare(strict_types=1);

ini_set('display_errors', '0');
error_reporting(E_ALL);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/auth.php';
require_once __DIR__ . '/../config/request.php';
require_once __DIR__ . '/document_input.php';

requireHttpMethod('GET');

try {
    $user = requireLogin();
    $documentId = getQueryInt('id');

    if ($documentId === null) {
        errorResponse('Document id is required.', 400);
    }

    $pdo = getDatabaseConnection();
    $row = fetchDocumentRowById($pdo, $documentId);

    if (!$row) {
        errorResponse('Document not found.', 404);
    }

    if (!canAccessDocument($pdo, $user, $row)) {
        errorResponse('You do not have permission to view this document.', 403);
    }

    successResponse([
        'document' => formatDocumentRow($pdo, $row),
    ], 'Document loaded successfully');
} catch (Throwable $e) {
    errorResponse('Failed to load document.', 500, [
        'error' => $e->getMessage(),
    ]);
}
