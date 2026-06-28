<?php
/**
 * whatsapp/list.php — list WhatsApp imports (admin only).
 *
 * GET api/whatsapp/list.php
 */

declare(strict_types=1);

ini_set('display_errors', '0');
error_reporting(E_ALL);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/auth.php';
require_once __DIR__ . '/../config/request.php';
require_once __DIR__ . '/whatsapp_input.php';

requireHttpMethod('GET');

try {
    requireRole('admin');
    $pdo = getDatabaseConnection();

    $sql = 'SELECT id, original_filename, stored_filename, uploaded_by_user_id, imported_at, status
            FROM whatsapp_imports
            ORDER BY imported_at DESC, id DESC';

    $stmt = $pdo->query($sql);
    $rows = $stmt->fetchAll();

    $imports = [];
    foreach ($rows as $row) {
        $imports[] = formatWhatsAppImportRow($pdo, $row);
    }

    successResponse(['imports' => $imports], 'WhatsApp imports loaded successfully');
} catch (Throwable $e) {
    errorResponse('Failed to load WhatsApp imports.', 500, [
        'error' => $e->getMessage(),
    ]);
}
