<?php
/**
 * whatsapp/messages.php — list parsed messages for an import (admin only).
 *
 * GET api/whatsapp/messages.php?id=
 * Optional: search, sender, date_from, date_to, limit
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

    $sql = 'SELECT id, import_id, sender_name, message_text, message_datetime, message_date,
                   message_hour, sentiment_score, sentiment_label, is_spam, spam_reason, created_at
            FROM whatsapp_messages
            WHERE import_id = :import_id';

    $params = ['import_id' => $importId];

    $search = getQueryString('search');
    if ($search !== null) {
        $sql .= ' AND message_text LIKE :search_text';
        $params['search_text'] = '%' . $search . '%';
    }

    $sender = getQueryString('sender');
    if ($sender !== null) {
        $sql .= ' AND sender_name = :sender_name';
        $params['sender_name'] = $sender;
    }

    $dateFrom = getQueryString('date_from');
    if ($dateFrom !== null && preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateFrom)) {
        $sql .= ' AND message_date >= :date_from';
        $params['date_from'] = $dateFrom;
    }

    $dateTo = getQueryString('date_to');
    if ($dateTo !== null && preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateTo)) {
        $sql .= ' AND message_date <= :date_to';
        $params['date_to'] = $dateTo;
    }

    $sql .= ' ORDER BY message_datetime ASC, id ASC';

    $limit = getQueryInt('limit');
    if ($limit !== null && $limit > 0) {
        $sql .= ' LIMIT ' . min($limit, 500);
    } else {
        $sql .= ' LIMIT 500';
    }

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    $messages = [];
    foreach ($rows as $row) {
        $messages[] = [
            'id'               => (int) $row['id'],
            'import_id'        => (int) $row['import_id'],
            'sender_name'      => (string) $row['sender_name'],
            'message_text'     => $row['message_text'] !== null ? (string) $row['message_text'] : '',
            'message_datetime' => (string) $row['message_datetime'],
            'message_date'     => (string) $row['message_date'],
            'message_hour'     => (int) $row['message_hour'],
            'sentiment_label'  => (string) $row['sentiment_label'],
            'is_spam'          => (int) $row['is_spam'] === 1,
            'spam_reason'      => $row['spam_reason'] !== null ? (string) $row['spam_reason'] : null,
        ];
    }

    $senderStmt = $pdo->prepare(
        'SELECT DISTINCT sender_name
         FROM whatsapp_messages
         WHERE import_id = :import_id
         ORDER BY sender_name ASC'
    );
    $senderStmt->execute(['import_id' => $importId]);
    $senders = array_map(function ($senderRow) {
        return (string) $senderRow['sender_name'];
    }, $senderStmt->fetchAll());

    successResponse([
        'import_id' => $importId,
        'messages'  => $messages,
        'senders'   => $senders,
    ], 'WhatsApp messages loaded successfully');
} catch (Throwable $e) {
    errorResponse('Failed to load WhatsApp messages.', 500, [
        'error' => $e->getMessage(),
    ]);
}
