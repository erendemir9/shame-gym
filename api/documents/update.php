<?php
/**
 * documents/update.php — update document metadata (admin only).
 *
 * POST api/documents/update.php
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

    $normalized = normalizeDocumentWritePayload($body, true);
    if (!$normalized['ok']) {
        errorResponse($normalized['message'], 400);
    }

    $meta = $normalized['data'];
    $pdo = getDatabaseConnection();
    $existing = fetchDocumentRowById($pdo, $meta['id']);

    if (!$existing) {
        errorResponse('Document not found.', 404);
    }

    $pdo->beginTransaction();

    $updateSql = 'UPDATE documents
                  SET title = :title,
                      description = :description,
                      category = :category,
                      keywords = :keywords,
                      updated_at = CURRENT_TIMESTAMP
                  WHERE id = :id';

    $updateStmt = $pdo->prepare($updateSql);
    $updateStmt->execute([
        'title'       => $meta['title'],
        'description' => $meta['description'],
        'category'    => $meta['category'],
        'keywords'    => $meta['keywords'],
        'id'          => $meta['id'],
    ]);

    replaceDocumentAccessRoles($pdo, $meta['id'], $meta['access_roles']);
    $pdo->commit();

    $row = fetchDocumentRowById($pdo, $meta['id']);
    if (!$row) {
        errorResponse('Document was updated but could not be loaded.', 500);
    }

    successResponse([
        'document' => formatDocumentRow($pdo, $row),
    ], 'Document updated successfully', 200);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    errorResponse('Failed to update document.', 500, [
        'error' => $e->getMessage(),
    ]);
}
