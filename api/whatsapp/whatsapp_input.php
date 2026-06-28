<?php
/**
 * whatsapp_input.php — shared helpers for WhatsApp import APIs.
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/request.php';

const WHATSAPP_MAX_BYTES = 10485760; // 10 MB

/**
 * Project root directory.
 *
 * @return string
 */
function getWhatsAppProjectRootPath()
{
    return dirname(__DIR__, 2);
}

/**
 * Absolute uploads/whatsapp directory.
 *
 * @return string
 */
function getWhatsAppUploadDir()
{
    return getWhatsAppProjectRootPath() . '/uploads/whatsapp';
}

/**
 * Ensure uploads/whatsapp exists and is writable.
 *
 * @return void
 */
function ensureWhatsAppUploadDir()
{
    $rootUploads = getWhatsAppProjectRootPath() . '/uploads';
    $dir = getWhatsAppUploadDir();
    $previousUmask = umask(0);

    if (!is_dir($rootUploads)) {
        mkdir($rootUploads, 0777, true);
    }
    if (!is_dir($dir)) {
        mkdir($dir, 0777, true);
    }
    if (is_dir($rootUploads) && !is_writable($rootUploads)) {
        @chmod($rootUploads, 0777);
    }
    if (is_dir($dir) && !is_writable($dir)) {
        @chmod($dir, 0777);
    }

    umask($previousUmask);
}

/**
 * Parse import id from request value.
 *
 * @param mixed $rawId
 * @return int|null
 */
function parseWhatsAppImportIdFromRequest($rawId)
{
    if ($rawId === null || $rawId === '') {
        return null;
    }

    if (is_int($rawId) && $rawId > 0) {
        return $rawId;
    }

    if (is_string($rawId) && ctype_digit($rawId)) {
        $importId = (int) $rawId;
        return $importId > 0 ? $importId : null;
    }

    return null;
}

/**
 * Sanitize a display filename label.
 *
 * @param string $filename
 * @return string
 */
function sanitizeWhatsAppOriginalFilename($filename)
{
    $basename = basename(str_replace('\\', '/', (string) $filename));
    $basename = preg_replace('/[^A-Za-z0-9._ -]+/', '_', $basename);
    $basename = trim((string) $basename, '. ');

    if ($basename === '') {
        return 'whatsapp-export.txt';
    }

    return substr($basename, 0, 255);
}

/**
 * Generate safe stored filename.
 *
 * @return string
 */
function generateWhatsAppStoredFilename()
{
    return 'wa_' . date('Ymd_His') . '_' . bin2hex(random_bytes(8)) . '.txt';
}

/**
 * Validate uploaded WhatsApp export file.
 *
 * @param array $fileEntry
 * @return array{ok:bool,message?:string,original?:string,size?:int}
 */
function validateWhatsAppUploadFile(array $fileEntry)
{
    if (!isset($fileEntry['error'])) {
        return ['ok' => false, 'message' => 'No file uploaded.'];
    }

    if ($fileEntry['error'] === UPLOAD_ERR_NO_FILE) {
        return ['ok' => false, 'message' => 'File is required.'];
    }

    if ($fileEntry['error'] !== UPLOAD_ERR_OK) {
        return ['ok' => false, 'message' => 'File upload failed.'];
    }

    $size = isset($fileEntry['size']) ? (int) $fileEntry['size'] : 0;
    if ($size <= 0) {
        return ['ok' => false, 'message' => 'Uploaded file is empty.'];
    }

    if ($size > WHATSAPP_MAX_BYTES) {
        return ['ok' => false, 'message' => 'File exceeds the 10 MB limit.'];
    }

    $originalName = sanitizeWhatsAppOriginalFilename($fileEntry['name'] ?? 'whatsapp-export.txt');
    $extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));

    if ($extension !== 'txt') {
        return ['ok' => false, 'message' => 'Only .txt WhatsApp export files are allowed.'];
    }

    $tmpPath = $fileEntry['tmp_name'] ?? '';
    if ($tmpPath === '' || !is_uploaded_file($tmpPath)) {
        return ['ok' => false, 'message' => 'Invalid upload source.'];
    }

    $detectedMime = mime_content_type($tmpPath);
    $allowedMimes = ['text/plain', 'application/octet-stream'];
    if ($detectedMime !== false && !in_array($detectedMime, $allowedMimes, true)) {
        return ['ok' => false, 'message' => 'File must be a plain text export.'];
    }

    return [
        'ok'       => true,
        'original' => $originalName,
        'size'     => $size,
    ];
}

/**
 * Load import row by id.
 *
 * @param PDO $pdo
 * @param int $importId
 * @return array|null
 */
function fetchWhatsAppImportRowById(PDO $pdo, $importId)
{
    $stmt = $pdo->prepare(
        'SELECT id, original_filename, stored_filename, uploaded_by_user_id, imported_at, status
         FROM whatsapp_imports
         WHERE id = :id
         LIMIT 1'
    );
    $stmt->execute(['id' => $importId]);
    $row = $stmt->fetch();

    return $row ?: null;
}

/**
 * Load analysis summary row for import.
 *
 * @param PDO $pdo
 * @param int $importId
 * @return array|null
 */
function fetchWhatsAppSummaryRow(PDO $pdo, $importId)
{
    $stmt = $pdo->prepare(
        'SELECT id, import_id, total_messages, unique_senders, peak_hour,
                positive_count, neutral_count, negative_count, spam_count, generated_at
         FROM whatsapp_analysis_summary
         WHERE import_id = :import_id
         LIMIT 1'
    );
    $stmt->execute(['import_id' => $importId]);
    $row = $stmt->fetch();

    return $row ?: null;
}

/**
 * Format import row for JSON output.
 *
 * @param PDO   $pdo
 * @param array $row
 * @return array
 */
function formatWhatsAppImportRow(PDO $pdo, array $row)
{
    $importId = (int) $row['id'];
    $summary = fetchWhatsAppSummaryRow($pdo, $importId);
    $title = preg_replace('/\.txt$/i', '', (string) $row['original_filename']);

    return [
        'id'                  => $importId,
        'title'               => $title,
        'original_filename'   => (string) $row['original_filename'],
        'stored_filename'     => (string) $row['stored_filename'],
        'uploaded_by_user_id' => $row['uploaded_by_user_id'] !== null ? (int) $row['uploaded_by_user_id'] : null,
        'imported_at'         => (string) $row['imported_at'],
        'status'              => (string) $row['status'],
        'total_messages'      => $summary ? (int) $summary['total_messages'] : 0,
        'unique_senders'      => $summary ? (int) $summary['unique_senders'] : 0,
    ];
}

/**
 * Parse WhatsApp datetime string into MySQL datetime parts.
 *
 * @param string $datePart
 * @param string $timePart
 * @return array{ok:bool,datetime?:string,date?:string,hour?:int}
 */
function parseWhatsAppDateTimeParts($datePart, $timePart)
{
    $datePart = trim($datePart);
    $timePart = trim($timePart);

    $dateFormats = ['d.m.Y', 'd/m/Y', 'm/d/Y', 'd-m-Y', 'Y-m-d'];
    $parsedDate = null;

    foreach ($dateFormats as $format) {
        $dateObj = DateTime::createFromFormat($format, $datePart);
        if ($dateObj instanceof DateTime) {
            $parsedDate = $dateObj;
            break;
        }
    }

    if ($parsedDate === null) {
        return ['ok' => false];
    }

    $timePart = str_replace('.', ':', $timePart);
    $hour = 0;
    $minute = 0;
    $second = 0;

    if (preg_match('/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i', $timePart, $matches)) {
        $hour = (int) $matches[1];
        $minute = (int) $matches[2];
        $second = isset($matches[3]) && $matches[3] !== '' ? (int) $matches[3] : 0;
        $meridiem = isset($matches[4]) ? strtoupper($matches[4]) : '';

        if ($meridiem === 'PM' && $hour < 12) {
            $hour += 12;
        }
        if ($meridiem === 'AM' && $hour === 12) {
            $hour = 0;
        }
    } else {
        return ['ok' => false];
    }

    $datetime = sprintf(
        '%04d-%02d-%02d %02d:%02d:%02d',
        (int) $parsedDate->format('Y'),
        (int) $parsedDate->format('m'),
        (int) $parsedDate->format('d'),
        $hour,
        $minute,
        $second
    );

    return [
        'ok'       => true,
        'datetime' => $datetime,
        'date'     => substr($datetime, 0, 10),
        'hour'     => $hour,
    ];
}

/**
 * Try to match a WhatsApp export line header.
 *
 * @param string $line
 * @return array{ok:bool,sender?:string,message?:string,datetime?:string,date?:string,hour?:int}
 */
function matchWhatsAppMessageHeader($line)
{
    $patterns = [
        '/^\[(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4}),\s*(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[APMapm]{2})?)\]\s*([^:]+):\s*(.*)$/',
        '/^(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4}),\s*(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[APMapm]{2})?)\s*-\s*([^:]+):\s*(.*)$/',
    ];

    foreach ($patterns as $pattern) {
        if (!preg_match($pattern, $line, $matches)) {
            continue;
        }

        $parsed = parseWhatsAppDateTimeParts($matches[1], $matches[2]);
        if (!$parsed['ok']) {
            continue;
        }

        $sender = trim($matches[3]);
        $message = (string) $matches[4];

        if ($sender === '') {
            continue;
        }

        return [
            'ok'       => true,
            'sender'   => substr($sender, 0, 120),
            'message'  => $message,
            'datetime' => $parsed['datetime'],
            'date'     => $parsed['date'],
            'hour'     => $parsed['hour'],
        ];
    }

    return ['ok' => false];
}

/**
 * Parse WhatsApp export text content.
 *
 * @param string $content
 * @return array{messages:array,skipped_lines:int,media_count:int}
 */
function parseWhatsAppExportText($content)
{
    $lines = preg_split('/\R/', (string) $content);
    $messages = [];
    $skippedLines = 0;
    $mediaCount = 0;
    $current = null;

    foreach ($lines as $line) {
        if ($line === null) {
            continue;
        }

        if (trim($line) === '') {
            continue;
        }

        $header = matchWhatsAppMessageHeader($line);

        if ($header['ok']) {
            if ($current !== null) {
                $messages[] = $current;
            }

            $current = [
                'sender_name'      => $header['sender'],
                'message_text'     => $header['message'],
                'message_datetime' => $header['datetime'],
                'message_date'     => $header['date'],
                'message_hour'     => $header['hour'],
            ];
            continue;
        }

        if ($current !== null) {
            $current['message_text'] .= "\n" . $line;
            continue;
        }

        $skippedLines++;
    }

    if ($current !== null) {
        $messages[] = $current;
    }

    foreach ($messages as &$message) {
        $message['message_text'] = trim((string) $message['message_text']);
        if (isWhatsAppMediaMessage($message['message_text'])) {
            $mediaCount++;
        }
    }
    unset($message);

    return [
        'messages'      => $messages,
        'skipped_lines' => $skippedLines,
        'media_count'   => $mediaCount,
    ];
}

/**
 * Detect media omitted messages.
 *
 * @param string $text
 * @return bool
 */
function isWhatsAppMediaMessage($text)
{
    return (bool) preg_match('/<(media|image|video|audio|document|sticker)[^>]* omitted>| omitted$/i', $text);
}

/**
 * Simple keyword-based sentiment placeholder.
 *
 * @param string $text
 * @return array{label:string,score:float}
 */
function analyzeWhatsAppSentiment($text)
{
    $lower = strtolower($text);
    $positiveWords = ['thanks', 'thank you', 'great', 'good', 'happy', 'love', 'awesome', 'excellent', 'welcome'];
    $negativeWords = ['bad', 'hate', 'angry', 'sad', 'terrible', 'awful', 'click here', 'free pass'];

    $score = 0.0;
    foreach ($positiveWords as $word) {
        if (strpos($lower, $word) !== false) {
            $score += 0.35;
        }
    }
    foreach ($negativeWords as $word) {
        if (strpos($lower, $word) !== false) {
            $score -= 0.35;
        }
    }

    if ($score >= 0.35) {
        return ['label' => 'positive', 'score' => min(1.0, $score)];
    }
    if ($score <= -0.35) {
        return ['label' => 'negative', 'score' => max(-1.0, $score)];
    }

    return ['label' => 'neutral', 'score' => 0.0];
}

/**
 * Simple spam heuristics.
 *
 * @param string $text
 * @param array  $repeatTracker
 * @param string $sender
 * @return array{is_spam:bool,reason:?string}
 */
function detectWhatsAppSpam($text, array &$repeatTracker, $sender)
{
    $trimmed = trim($text);
    $upper = strtoupper($trimmed);

    if (preg_match('/CLICK HERE|FREE GYM PASS|WIN PRIZE|HTTP:\/\//i', $trimmed)) {
        return ['is_spam' => true, 'reason' => 'Promotional spam pattern'];
    }

    if (strlen($upper) > 20 && $upper === $trimmed && substr_count($upper, '!') >= 2) {
        return ['is_spam' => true, 'reason' => 'Excessive caps and punctuation'];
    }

    $messageKey = strtolower($sender) . '|' . strtolower($trimmed);
    $repeatTracker[$messageKey] = ($repeatTracker[$messageKey] ?? 0) + 1;
    if ($repeatTracker[$messageKey] >= 3 && strlen($trimmed) > 0) {
        return ['is_spam' => true, 'reason' => 'Repeated identical message'];
    }

    return ['is_spam' => false, 'reason' => null];
}

/**
 * Build extended summary metrics from parsed messages.
 *
 * @param array $messages
 * @param int   $skippedLines
 * @param int   $mediaCount
 * @return array
 */
function buildWhatsAppExtendedSummary(array $messages, $skippedLines, $mediaCount)
{
    $senderTotals = [];
    $hourTotals = [];
    $dayTotals = [];
    $positiveCount = 0;
    $neutralCount = 0;
    $negativeCount = 0;
    $spamCount = 0;
    $repeatTracker = [];

    $firstDate = null;
    $lastDate = null;

    foreach ($messages as $message) {
        $sender = $message['sender_name'];
        $senderTotals[$sender] = ($senderTotals[$sender] ?? 0) + 1;

        $hour = (int) $message['message_hour'];
        $hourTotals[$hour] = ($hourTotals[$hour] ?? 0) + 1;

        $day = (string) $message['message_date'];
        $dayTotals[$day] = ($dayTotals[$day] ?? 0) + 1;

        if ($firstDate === null || $day < $firstDate) {
            $firstDate = $day;
        }
        if ($lastDate === null || $day > $lastDate) {
            $lastDate = $day;
        }

        $sentiment = analyzeWhatsAppSentiment((string) $message['message_text']);
        if ($sentiment['label'] === 'positive') {
            $positiveCount++;
        } elseif ($sentiment['label'] === 'negative') {
            $negativeCount++;
        } else {
            $neutralCount++;
        }

        $spam = detectWhatsAppSpam((string) $message['message_text'], $repeatTracker, $sender);
        if ($spam['is_spam']) {
            $spamCount++;
        }
    }

    $mostActiveParticipant = null;
    $mostActiveCount = 0;
    foreach ($senderTotals as $sender => $count) {
        if ($count > $mostActiveCount) {
            $mostActiveParticipant = $sender;
            $mostActiveCount = $count;
        }
    }

    $peakHour = null;
    $peakHourCount = 0;
    foreach ($hourTotals as $hour => $count) {
        if ($count > $peakHourCount) {
            $peakHour = (int) $hour;
            $peakHourCount = $count;
        }
    }

    $busiestDay = null;
    $busiestDayCount = 0;
    foreach ($dayTotals as $day => $count) {
        if ($count > $busiestDayCount) {
            $busiestDay = $day;
            $busiestDayCount = $count;
        }
    }

    $uniqueDays = count($dayTotals);
    $averagePerDay = $uniqueDays > 0 ? round(count($messages) / $uniqueDays, 1) : 0;

    return [
        'total_messages'          => count($messages),
        'unique_senders'          => count($senderTotals),
        'peak_hour'               => $peakHour,
        'positive_count'          => $positiveCount,
        'neutral_count'           => $neutralCount,
        'negative_count'          => $negativeCount,
        'spam_count'              => $spamCount,
        'most_active_participant' => $mostActiveParticipant,
        'most_active_count'       => $mostActiveCount,
        'first_message_date'      => $firstDate,
        'last_message_date'       => $lastDate,
        'busiest_day'             => $busiestDay,
        'busiest_hour'            => $peakHour,
        'average_messages_per_day'=> $averagePerDay,
        'media_message_count'     => $mediaCount,
        'skipped_line_count'      => $skippedLines,
        'participants'            => $senderTotals,
        'hourly_activity'         => $hourTotals,
    ];
}

/**
 * Format summary for JSON output.
 *
 * @param PDO        $pdo
 * @param int        $importId
 * @param array|null $extended
 * @return array
 */
function formatWhatsAppSummary(PDO $pdo, $importId, $extended = null)
{
    $row = fetchWhatsAppSummaryRow($pdo, $importId);
    $summary = [
        'import_id'        => $importId,
        'total_messages'   => 0,
        'unique_senders'   => 0,
        'peak_hour'        => null,
        'positive_count'   => 0,
        'neutral_count'    => 0,
        'negative_count'   => 0,
        'spam_count'       => 0,
        'generated_at'     => null,
    ];

    if ($row) {
        $summary = [
            'import_id'        => (int) $row['import_id'],
            'total_messages'   => (int) $row['total_messages'],
            'unique_senders'   => (int) $row['unique_senders'],
            'peak_hour'        => $row['peak_hour'] !== null ? (int) $row['peak_hour'] : null,
            'positive_count'   => (int) $row['positive_count'],
            'neutral_count'    => (int) $row['neutral_count'],
            'negative_count'   => (int) $row['negative_count'],
            'spam_count'       => (int) $row['spam_count'],
            'generated_at'     => (string) $row['generated_at'],
        ];
    }

    if (is_array($extended)) {
        $summary = array_merge($summary, $extended);
    }

    return $summary;
}

/**
 * Persist parsed messages and summary for an import.
 *
 * @param PDO   $pdo
 * @param int   $importId
 * @param array $parseResult
 * @return array
 */
function storeWhatsAppParsedImport(PDO $pdo, $importId, array $parseResult)
{
    $messages = $parseResult['messages'];
    $skippedLines = (int) $parseResult['skipped_lines'];
    $mediaCount = (int) $parseResult['media_count'];
    $repeatTracker = [];

    $insertSql = 'INSERT INTO whatsapp_messages
        (import_id, sender_name, message_text, message_datetime, message_date, message_hour,
         sentiment_score, sentiment_label, is_spam, spam_reason)
        VALUES
        (:import_id, :sender_name, :message_text, :message_datetime, :message_date, :message_hour,
         :sentiment_score, :sentiment_label, :is_spam, :spam_reason)';

    $insertStmt = $pdo->prepare($insertSql);

    foreach ($messages as $message) {
        $sentiment = analyzeWhatsAppSentiment((string) $message['message_text']);
        $spam = detectWhatsAppSpam((string) $message['message_text'], $repeatTracker, $message['sender_name']);

        $insertStmt->execute([
            'import_id'        => $importId,
            'sender_name'      => $message['sender_name'],
            'message_text'     => $message['message_text'],
            'message_datetime' => $message['message_datetime'],
            'message_date'     => $message['message_date'],
            'message_hour'     => (int) $message['message_hour'],
            'sentiment_score'  => $sentiment['score'],
            'sentiment_label'  => $sentiment['label'],
            'is_spam'          => $spam['is_spam'] ? 1 : 0,
            'spam_reason'      => $spam['reason'],
        ]);
    }

    $extended = buildWhatsAppExtendedSummary($messages, $skippedLines, $mediaCount);

    $summaryInsert = $pdo->prepare(
        'INSERT INTO whatsapp_analysis_summary
            (import_id, total_messages, unique_senders, peak_hour, positive_count, neutral_count, negative_count, spam_count)
         VALUES
            (:import_id, :total_messages, :unique_senders, :peak_hour, :positive_count, :neutral_count, :negative_count, :spam_count)'
    );
    $summaryInsert->execute([
        'import_id'       => $importId,
        'total_messages'  => $extended['total_messages'],
        'unique_senders'  => $extended['unique_senders'],
        'peak_hour'       => $extended['peak_hour'],
        'positive_count'  => $extended['positive_count'],
        'neutral_count'   => $extended['neutral_count'],
        'negative_count'  => $extended['negative_count'],
        'spam_count'      => $extended['spam_count'],
    ]);

    return $extended;
}

/**
 * Resolve stored file path safely.
 *
 * @param array $importRow
 * @return string|null
 */
function resolveWhatsAppStoredFilePath(array $importRow)
{
    $storedFilename = basename((string) $importRow['stored_filename']);
    if ($storedFilename === '' || strpos($storedFilename, '..') !== false) {
        return null;
    }

    $absolutePath = getWhatsAppUploadDir() . '/' . $storedFilename;
    $realPath = realpath($absolutePath);
    $uploadReal = realpath(getWhatsAppUploadDir());

    if ($realPath === false || $uploadReal === false) {
        return null;
    }

    if (strpos($realPath, $uploadReal) !== 0) {
        return null;
    }

    return $realPath;
}
