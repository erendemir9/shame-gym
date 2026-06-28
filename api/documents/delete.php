<?php
/**
 * documents/delete.php — archive a document (admin only, soft delete).
 *
 * POST api/documents/delete.php
 */

declare(strict_types=1);

ini_set('display_errors', '0');
error_reporting(E_ALL);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/auth.php';
require_once __DIR__ . '/../config/request.php';
require_once __DIR__ . '/document_input.php';

requireHttpMethod('POST');

try {
    $user = requireRole('admin');

    $body = getJsonRequestBody();
    if ($body === null) {
        errorResponse('Request body is required.', 400);
    }

    $documentId = parseDocumentIdFromRequest($body['id'] ?? null);
    if ($documentId === null) {
        errorResponse('Document id is required.', 400);
    }

    $pdo = getDatabaseConnection();
    $existing = fetchDocumentRowById($pdo, $documentId);

    if (!$existing) {
        errorResponse('Document not found.', 404);
    }

    $stmt = $pdo->prepare(
        'UPDATE documents
         SET is_available = 0, updated_at = CURRENT_TIMESTAMP
         WHERE id = :id'
    );
    $stmt->execute(['id' => $documentId]);

    successResponse([
        'id' => $documentId,
    ], 'Document archived successfully', 200);
} catch (Throwable $e) {
    errorResponse('Failed to archive document.', 500, [
        'error' => $e->getMessage(),
    ]);
}
