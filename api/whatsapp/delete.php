<?php
/**
 * whatsapp/delete.php — delete a WhatsApp import and related data (admin only).
 *
 * POST api/whatsapp/delete.php
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
    requireRole('admin');

    $body = getJsonRequestBody();
    if ($body === null) {
        errorResponse('Request body is required.', 400);
    }

    $importId = parseWhatsAppImportIdFromRequest($body['id'] ?? null);
    if ($importId === null) {
        errorResponse('Import id is required.', 400);
    }

    $pdo = getDatabaseConnection();
    $importRow = fetchWhatsAppImportRowById($pdo, $importId);

    if (!$importRow) {
        errorResponse('Import not found.', 404);
    }

    $filePath = resolveWhatsAppStoredFilePath($importRow);
    if ($filePath !== null && is_file($filePath)) {
        @unlink($filePath);
    }

    $deleteStmt = $pdo->prepare('DELETE FROM whatsapp_imports WHERE id = :id');
    $deleteStmt->execute(['id' => $importId]);

    successResponse([
        'id' => $importId,
    ], 'WhatsApp import deleted successfully', 200);
} catch (Throwable $e) {
    errorResponse('Failed to delete WhatsApp import.', 500, [
        'error' => $e->getMessage(),
    ]);
}
