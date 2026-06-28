<?php
/**
 * documents/download.php — download a document file after access check.
 *
 * GET api/documents/download.php?id=
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
        errorResponse('You do not have permission to download this document.', 403);
    }

    $absolutePath = resolveDocumentAbsolutePath($row);
    if ($absolutePath === null || !is_file($absolutePath)) {
        errorResponse('Document file is not available on the server.', 404);
    }

    $originalName = sanitizeOriginalFilename($row['original_filename']);
    $mimeType = $row['file_type'] !== null ? (string) $row['file_type'] : 'application/octet-stream';
    $fileSize = filesize($absolutePath);

    header('Content-Type: ' . $mimeType);
    header('Content-Disposition: attachment; filename="' . str_replace('"', '', $originalName) . '"');
    header('Content-Length: ' . (string) $fileSize);
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: private, max-age=0, must-revalidate');

    readfile($absolutePath);
    exit;
} catch (Throwable $e) {
    errorResponse('Failed to download document.', 500, [
        'error' => $e->getMessage(),
    ]);
}
