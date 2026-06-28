<?php
/**
 * whatsapp/get.php — fetch one WhatsApp import (admin only).
 *
 * GET api/whatsapp/get.php?id=
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
    $importId = getQueryInt('id');

    if ($importId === null) {
        errorResponse('Import id is required.', 400);
    }

    $pdo = getDatabaseConnection();
    $row = fetchWhatsAppImportRowById($pdo, $importId);

    if (!$row) {
        errorResponse('Import not found.', 404);
    }

    $summaryRow = fetchWhatsAppSummaryRow($pdo, $importId);
    $extended = null;

    if ($summaryRow) {
        $extended = [
            'most_active_participant' => null,
            'most_active_count'       => 0,
            'first_message_date'      => null,
            'last_message_date'       => null,
            'busiest_day'             => null,
            'media_message_count'     => 0,
            'skipped_line_count'      => 0,
        ];

        $participantStmt = $pdo->prepare(
            'SELECT sender_name, COUNT(*) AS message_count
             FROM whatsapp_messages
             WHERE import_id = :import_id
             GROUP BY sender_name
             ORDER BY message_count DESC, sender_name ASC'
        );
        $participantStmt->execute(['import_id' => $importId]);
        $participants = [];
        $topSender = null;
        $topCount = 0;

        foreach ($participantStmt->fetchAll() as $participantRow) {
            $count = (int) $participantRow['message_count'];
            $participants[$participantRow['sender_name']] = $count;
            if ($count > $topCount) {
                $topSender = (string) $participantRow['sender_name'];
                $topCount = $count;
            }
        }

        $dateStmt = $pdo->prepare(
            'SELECT MIN(message_date) AS first_date, MAX(message_date) AS last_date
             FROM whatsapp_messages
             WHERE import_id = :import_id'
        );
        $dateStmt->execute(['import_id' => $importId]);
        $dateRow = $dateStmt->fetch();

        $dayStmt = $pdo->prepare(
            'SELECT message_date, COUNT(*) AS day_count
             FROM whatsapp_messages
             WHERE import_id = :import_id
             GROUP BY message_date
             ORDER BY day_count DESC
             LIMIT 1'
        );
        $dayStmt->execute(['import_id' => $importId]);
        $dayRow = $dayStmt->fetch();

        $mediaStmt = $pdo->prepare(
            'SELECT COUNT(*) AS media_count
             FROM whatsapp_messages
             WHERE import_id = :import_id
               AND (message_text LIKE :media1 OR message_text LIKE :media2)'
        );
        $mediaStmt->execute([
            'import_id' => $importId,
            'media1'    => '%omitted%',
            'media2'    => '%<Media%',
        ]);
        $mediaRow = $mediaStmt->fetch();

        $extended['most_active_participant'] = $topSender;
        $extended['most_active_count'] = $topCount;
        $extended['first_message_date'] = $dateRow['first_date'] ?? null;
        $extended['last_message_date'] = $dateRow['last_date'] ?? null;
        $extended['busiest_day'] = $dayRow['message_date'] ?? null;
        $extended['participants'] = $participants;
        $extended['media_message_count'] = (int) ($mediaRow['media_count'] ?? 0);
    }

    successResponse([
        'import'  => formatWhatsAppImportRow($pdo, $row),
        'summary' => formatWhatsAppSummary($pdo, $importId, $extended),
    ], 'WhatsApp import loaded successfully');
} catch (Throwable $e) {
    errorResponse('Failed to load WhatsApp import.', 500, [
        'error' => $e->getMessage(),
    ]);
}
