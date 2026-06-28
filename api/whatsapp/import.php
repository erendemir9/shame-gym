<?php
/**
 * whatsapp/import.php — upload and parse a WhatsApp .txt export (admin only).
 *
 * POST multipart/form-data
 * Fields: title, description, file
 */

declare(strict_types=1);

ini_set('display_errors', '0');
error_reporting(E_ALL);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/auth.php';
require_once __DIR__ . '/../config/request.php';
require_once __DIR__ . '/whatsapp_input.php';

requireHttpMethod('POST');

try {
    $user = requireRole('admin');

    if (!isset($_FILES['file']) || !is_array($_FILES['file'])) {
        errorResponse('File is required.', 400);
    }

    $fileValidation = validateWhatsAppUploadFile($_FILES['file']);
    if (!$fileValidation['ok']) {
        errorResponse($fileValidation['message'], 400);
    }

    $title = isset($_POST['title']) ? trim((string) $_POST['title']) : '';
    $originalFilename = $title !== ''
        ? sanitizeWhatsAppOriginalFilename($title . '.txt')
        : $fileValidation['original'];

    ensureWhatsAppUploadDir();
    $storedFilename = generateWhatsAppStoredFilename();
    $absolutePath = getWhatsAppUploadDir() . '/' . $storedFilename;

    if (!move_uploaded_file($_FILES['file']['tmp_name'], $absolutePath)) {
        errorResponse('Failed to store uploaded file.', 500);
    }

    $content = file_get_contents($absolutePath);
    if ($content === false || trim($content) === '') {
        @unlink($absolutePath);
        errorResponse('Uploaded file could not be read or is empty.', 400);
    }

    $parseResult = parseWhatsAppExportText($content);
    if (count($parseResult['messages']) === 0) {
        @unlink($absolutePath);
        errorResponse('No WhatsApp messages could be parsed from this file.', 400, [
            'skipped_lines' => $parseResult['skipped_lines'],
        ]);
    }

    $pdo = getDatabaseConnection();
    $pdo->beginTransaction();

    $insertImport = $pdo->prepare(
        'INSERT INTO whatsapp_imports
            (original_filename, stored_filename, uploaded_by_user_id, status)
         VALUES
            (:original_filename, :stored_filename, :uploaded_by_user_id, :status)'
    );
    $insertImport->execute([
        'original_filename'   => $originalFilename,
        'stored_filename'     => $storedFilename,
        'uploaded_by_user_id' => (int) $user['id'],
        'status'              => 'processing',
    ]);

    $importId = (int) $pdo->lastInsertId();
    $extendedSummary = storeWhatsAppParsedImport($pdo, $importId, $parseResult);

    $updateImport = $pdo->prepare(
        'UPDATE whatsapp_imports SET status = :status WHERE id = :id'
    );
    $updateImport->execute([
        'status' => 'completed',
        'id'     => $importId,
    ]);

    $pdo->commit();

    $importRow = fetchWhatsAppImportRowById($pdo, $importId);

    successResponse([
        'import' => formatWhatsAppImportRow($pdo, $importRow),
        'id'     => $importId,
        'parsed_message_count' => count($parseResult['messages']),
        'skipped_line_count'   => $parseResult['skipped_lines'],
        'media_message_count'  => $parseResult['media_count'],
        'summary'              => formatWhatsAppSummary($pdo, $importId, $extendedSummary),
    ], 'WhatsApp import completed successfully', 200);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    if (isset($absolutePath) && is_string($absolutePath) && is_file($absolutePath)) {
        @unlink($absolutePath);
    }

    errorResponse('Failed to import WhatsApp export.', 500, [
        'error' => $e->getMessage(),
    ]);
}
