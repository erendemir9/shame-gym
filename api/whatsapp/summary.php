<?php
/**
 * whatsapp/summary.php — analysis summary for an import (admin only).
 *
 * GET api/whatsapp/summary.php?id=
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
    $importRow = fetchWhatsAppImportRowById($pdo, $importId);

    if (!$importRow) {
        errorResponse('Import not found.', 404);
    }

    $summaryRow = fetchWhatsAppSummaryRow($pdo, $importId);
    if (!$summaryRow) {
        errorResponse('Analysis summary not found for this import.', 404);
    }

    $participantStmt = $pdo->prepare(
        'SELECT sender_name, COUNT(*) AS message_count
         FROM whatsapp_messages
         WHERE import_id = :import_id
         GROUP BY sender_name
         ORDER BY message_count DESC, sender_name ASC'
    );
    $participantStmt->execute(['import_id' => $importId]);
    $participants = [];
    $mostActiveParticipant = null;
    $mostActiveCount = 0;

    foreach ($participantStmt->fetchAll() as $row) {
        $count = (int) $row['message_count'];
        $participants[(string) $row['sender_name']] = $count;
        if ($count > $mostActiveCount) {
            $mostActiveParticipant = (string) $row['sender_name'];
            $mostActiveCount = $count;
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

    $hourStmt = $pdo->prepare(
        'SELECT message_hour, COUNT(*) AS hour_count
         FROM whatsapp_messages
         WHERE import_id = :import_id
         GROUP BY message_hour
         ORDER BY hour_count DESC, message_hour ASC'
    );
    $hourStmt->execute(['import_id' => $importId]);
    $hourlyActivity = [];
    foreach ($hourStmt->fetchAll() as $row) {
        $hourlyActivity[(int) $row['message_hour']] = (int) $row['hour_count'];
    }

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

    $dayCountStmt = $pdo->prepare(
        'SELECT COUNT(DISTINCT message_date) AS unique_days
         FROM whatsapp_messages
         WHERE import_id = :import_id'
    );
    $dayCountStmt->execute(['import_id' => $importId]);
    $uniqueDays = max(1, (int) $dayCountStmt->fetchColumn());

    $extended = [
        'most_active_participant'  => $mostActiveParticipant,
        'most_active_count'        => $mostActiveCount,
        'first_message_date'       => $dateRow['first_date'] ?? null,
        'last_message_date'        => $dateRow['last_date'] ?? null,
        'busiest_day'              => $dayRow['message_date'] ?? null,
        'busiest_hour'             => $summaryRow['peak_hour'] !== null ? (int) $summaryRow['peak_hour'] : null,
        'average_messages_per_day' => round(((int) $summaryRow['total_messages']) / $uniqueDays, 1),
        'media_message_count'      => (int) ($mediaRow['media_count'] ?? 0),
        'participants'             => $participants,
        'hourly_activity'          => $hourlyActivity,
    ];

    successResponse([
        'summary' => formatWhatsAppSummary($pdo, $importId, $extended),
    ], 'WhatsApp summary loaded successfully');
} catch (Throwable $e) {
    errorResponse('Failed to load WhatsApp summary.', 500, [
        'error' => $e->getMessage(),
    ]);
}
