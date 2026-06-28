<?php
/**
 * documents/upload.php — upload a new document (admin only).
 *
 * POST multipart/form-data
 * Fields: title, category, description, keywords, access_roles (JSON array), file
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

    if (!isset($_FILES['file']) || !is_array($_FILES['file'])) {
        errorResponse('File is required.', 400);
    }

    $fileValidation = validateUploadedDocumentFile($_FILES['file']);
    if (!$fileValidation['ok']) {
        errorResponse($fileValidation['message'], 400);
    }

    $body = [
        'title'       => $_POST['title'] ?? '',
        'category'    => $_POST['category'] ?? 'General',
        'description' => $_POST['description'] ?? '',
        'keywords'    => $_POST['keywords'] ?? '',
    ];

    if (isset($_POST['access_roles']) && trim((string) $_POST['access_roles']) !== '') {
        $decodedRoles = json_decode((string) $_POST['access_roles'], true);
        if (is_array($decodedRoles)) {
            $body['access_roles'] = $decodedRoles;
        }
    }

    $normalized = normalizeDocumentWritePayload($body, false);
    if (!$normalized['ok']) {
        errorResponse($normalized['message'], 400);
    }

    $meta = $normalized['data'];
    ensureDocumentsUploadDir();

    $storedFilename = generateStoredFilename($fileValidation['extension']);
    $relativePath = 'uploads/documents/' . $storedFilename;
    $absolutePath = getDocumentsUploadDir() . '/' . $storedFilename;

    if (!move_uploaded_file($_FILES['file']['tmp_name'], $absolutePath)) {
        errorResponse('Failed to store uploaded file.', 500);
    }

    $pdo = getDatabaseConnection();
    $pdo->beginTransaction();

    $insertSql = 'INSERT INTO documents
        (title, description, category, keywords, original_filename, stored_filename, file_path,
         file_type, file_size, uploaded_by_user_id, is_available)
        VALUES
        (:title, :description, :category, :keywords, :original_filename, :stored_filename, :file_path,
         :file_type, :file_size, :uploaded_by_user_id, :is_available)';

    $insertStmt = $pdo->prepare($insertSql);
    $insertStmt->execute([
        'title'               => $meta['title'],
        'description'         => $meta['description'],
        'category'            => $meta['category'],
        'keywords'            => $meta['keywords'],
        'original_filename'   => $fileValidation['original'],
        'stored_filename'     => $storedFilename,
        'file_path'           => $relativePath,
        'file_type'           => $fileValidation['mime'],
        'file_size'           => $fileValidation['size'],
        'uploaded_by_user_id' => (int) $user['id'],
        'is_available'        => 1,
    ]);

    $documentId = (int) $pdo->lastInsertId();
    replaceDocumentAccessRoles($pdo, $documentId, $meta['access_roles']);
    $pdo->commit();

    $row = fetchDocumentRowById($pdo, $documentId);
    if (!$row) {
        errorResponse('Document was uploaded but could not be loaded.', 500);
    }

    successResponse([
        'document' => formatDocumentRow($pdo, $row),
        'id'       => $documentId,
    ], 'Document uploaded successfully', 200);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    if (isset($absolutePath) && is_string($absolutePath) && is_file($absolutePath)) {
        @unlink($absolutePath);
    }

    errorResponse('Failed to upload document.', 500, [
        'error' => $e->getMessage(),
    ]);
}
