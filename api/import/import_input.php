<?php
/**
 * import_input.php — shared helpers for legacy member CSV import.
 */

declare(strict_types=1);

const LEGACY_IMPORT_MAX_BYTES = 5242880; // 5 MB
const LEGACY_IMPORT_TYPE = 'members_csv';
const LEGACY_PREVIEW_LIMIT = 10;
const LEGACY_ERRORS_PREVIEW_LIMIT = 20;

/**
 * Project root directory.
 *
 * @return string
 */
function getImportProjectRootPath()
{
    return dirname(__DIR__, 2);
}

/**
 * Absolute uploads/import directory for stored CSV files.
 *
 * @return string
 */
function getLegacyImportUploadDir()
{
    return getImportProjectRootPath() . '/uploads/import';
}

/**
 * Ensure uploads/import exists and is writable.
 *
 * @return void
 */
function ensureLegacyImportUploadDir()
{
    $rootUploads = getImportProjectRootPath() . '/uploads';
    $dir = getLegacyImportUploadDir();
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
 * Validate an uploaded CSV file.
 *
 * @param array $file $_FILES entry
 * @return array{ok:bool,message?:string,original?:string,tmp_name?:string}
 */
function validateLegacyCsvUploadFile(array $file)
{
    if (!isset($file['error']) || is_array($file['error'])) {
        return ['ok' => false, 'message' => 'Invalid upload payload.'];
    }

    if ($file['error'] === UPLOAD_ERR_NO_FILE) {
        return ['ok' => false, 'message' => 'CSV file is required.'];
    }

    if ($file['error'] !== UPLOAD_ERR_OK) {
        return ['ok' => false, 'message' => 'File upload failed. Please try again.'];
    }

    if (!isset($file['tmp_name']) || !is_uploaded_file($file['tmp_name'])) {
        return ['ok' => false, 'message' => 'Uploaded file could not be verified.'];
    }

    $size = isset($file['size']) ? (int) $file['size'] : 0;
    if ($size <= 0) {
        return ['ok' => false, 'message' => 'Uploaded file is empty.'];
    }

    if ($size > LEGACY_IMPORT_MAX_BYTES) {
        return ['ok' => false, 'message' => 'File exceeds the 5 MB upload limit.'];
    }

    $original = isset($file['name']) ? basename((string) $file['name']) : 'import.csv';
    $extension = strtolower(pathinfo($original, PATHINFO_EXTENSION));

    if ($extension !== 'csv') {
        return ['ok' => false, 'message' => 'Only .csv files are allowed.'];
    }

    $mime = mime_content_type($file['tmp_name']);
    $allowedMimes = [
        'text/plain',
        'text/csv',
        'text/x-csv',
        'application/csv',
        'application/vnd.ms-excel',
        'application/octet-stream',
    ];

    if ($mime !== false && !in_array($mime, $allowedMimes, true)) {
        return ['ok' => false, 'message' => 'Invalid CSV file type.'];
    }

    return [
        'ok'       => true,
        'original' => $original,
        'tmp_name' => $file['tmp_name'],
    ];
}

/**
 * Generate a safe stored filename for an import batch.
 *
 * @return string
 */
function generateLegacyImportStoredFilename()
{
    return 'legacy_import_' . date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '.csv';
}

/**
 * Map CSV header row to canonical field indexes.
 *
 * @param array<int,string> $headers
 * @return array<string,int>
 */
function mapLegacyCsvHeaders(array $headers)
{
    $aliases = [
        'full_name'             => ['full_name', 'name', 'member_name'],
        'email'                 => ['email', 'email_address'],
        'phone'                 => ['phone', 'phone_number', 'mobile'],
        'membership_type'       => ['membership_type', 'membership', 'plan'],
        'start_date'            => ['start_date', 'join_date', 'registered_at'],
        'assigned_trainer_id'   => ['assigned_trainer_id', 'trainer_id'],
        'assigned_trainer_email'=> ['assigned_trainer_email', 'trainer_email'],
    ];

    $mapping = [];

    foreach ($headers as $index => $header) {
        $normalized = strtolower(trim((string) $header));
        if ($normalized === '') {
            continue;
        }

        foreach ($aliases as $field => $fieldAliases) {
            if (in_array($normalized, $fieldAliases, true) && !isset($mapping[$field])) {
                $mapping[$field] = (int) $index;
                break;
            }
        }
    }

    return $mapping;
}

/**
 * Normalize membership type strings.
 *
 * @param string $value
 * @return string|null
 */
function normalizeLegacyMembershipType($value)
{
    $normalized = strtolower(trim((string) $value));

    if ($normalized === '') {
        return 'Basic';
    }

    $map = [
        'basic'    => 'Basic',
        'premium'  => 'Premium',
        'vip'      => 'VIP',
        'standard' => 'Basic',
    ];

    return $map[$normalized] ?? null;
}

/**
 * Parse a legacy date into YYYY-MM-DD or return null on failure.
 *
 * @param string $value
 * @return array{ok:bool,date?:string|null,message?:string}
 */
function normalizeLegacyDate($value)
{
    $raw = trim((string) $value);

    if ($raw === '') {
        return ['ok' => true, 'date' => null];
    }

    if (preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $raw, $matches)) {
        if (checkdate((int) $matches[2], (int) $matches[3], (int) $matches[1])) {
            return ['ok' => true, 'date' => sprintf('%04d-%02d-%02d', (int) $matches[1], (int) $matches[2], (int) $matches[3])];
        }

        return ['ok' => false, 'message' => 'Invalid start date.'];
    }

    if (preg_match('/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})$/', $raw, $matches)) {
        $first = (int) $matches[1];
        $second = (int) $matches[2];
        $year = (int) $matches[3];

        if ($first > 12 && $second <= 12) {
            $day = $first;
            $month = $second;
        } elseif ($second > 12 && $first <= 12) {
            $month = $first;
            $day = $second;
        } else {
            $day = $first;
            $month = $second;
        }

        if (checkdate($month, $day, $year)) {
            return ['ok' => true, 'date' => sprintf('%04d-%02d-%02d', $year, $month, $day)];
        }

        return ['ok' => false, 'message' => 'Invalid start date.'];
    }

    if (preg_match('/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/', $raw, $matches)) {
        $month = (int) $matches[1];
        $day = (int) $matches[2];
        $year = (int) $matches[3];

        if (checkdate($month, $day, $year)) {
            return ['ok' => true, 'date' => sprintf('%04d-%02d-%02d', $year, $month, $day)];
        }

        return ['ok' => false, 'message' => 'Invalid start date.'];
    }

    return ['ok' => false, 'message' => 'Invalid start date format.'];
}

/**
 * Extract a trimmed cell value from a CSV row.
 *
 * @param array<int,string|null> $row
 * @param int|null $index
 * @return string
 */
function getLegacyCsvCell(array $row, $index)
{
    if ($index === null || !isset($row[$index])) {
        return '';
    }

    return trim((string) $row[$index]);
}

/**
 * Encode a CSV row for error logging.
 *
 * @param array<int,string|null> $row
 * @return string
 */
function encodeLegacyCsvRawRow(array $row)
{
    $handle = fopen('php://temp', 'r+');
    if ($handle === false) {
        return implode(',', $row);
    }

    fputcsv($handle, $row);
    rewind($handle);
    $encoded = stream_get_contents($handle);
    fclose($handle);

    return $encoded !== false ? trim($encoded) : implode(',', $row);
}

/**
 * Load existing emails from members, users, and trainers.
 *
 * @param PDO $pdo
 * @return array<string,bool>
 */
function loadExistingLegacyEmails(PDO $pdo)
{
    $emails = [];
    $queries = [
        'SELECT email FROM members',
        'SELECT email FROM users',
        'SELECT email FROM trainers',
    ];

    foreach ($queries as $sql) {
        $stmt = $pdo->query($sql);
        foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $email) {
            $emails[strtolower(trim((string) $email))] = true;
        }
    }

    return $emails;
}

/**
 * Load trainer lookup maps.
 *
 * @param PDO $pdo
 * @return array{id_by_email:array<string,int>,valid_ids:array<int,bool>}
 */
function loadLegacyTrainerLookups(PDO $pdo)
{
    $idByEmail = [];
    $validIds = [];
    $stmt = $pdo->query('SELECT id, email FROM trainers');

    foreach ($stmt->fetchAll() as $row) {
        $trainerId = (int) $row['id'];
        $validIds[$trainerId] = true;
        $idByEmail[strtolower(trim((string) $row['email']))] = $trainerId;
    }

    return [
        'id_by_email' => $idByEmail,
        'valid_ids'   => $validIds,
    ];
}

/**
 * Parse and process a legacy CSV file path.
 *
 * @param string $filePath
 * @param PDO|null $pdo
 * @return array
 */
function processLegacyCsvFile($filePath, $pdo = null)
{
    $handle = fopen($filePath, 'r');
    if ($handle === false) {
        return [
            'ok'      => false,
            'message' => 'Could not read CSV file.',
        ];
    }

    $headerRow = fgetcsv($handle);
    if ($headerRow === false || count($headerRow) === 0) {
        fclose($handle);
        return [
            'ok'      => false,
            'message' => 'CSV file is empty or missing a header row.',
        ];
    }

    $mapping = mapLegacyCsvHeaders($headerRow);
    if (!isset($mapping['full_name']) || !isset($mapping['email'])) {
        fclose($handle);
        return [
            'ok'      => false,
            'message' => 'CSV must include name and email columns.',
        ];
    }

    $existingEmails = $pdo ? loadExistingLegacyEmails($pdo) : [];
    $trainerLookups = $pdo ? loadLegacyTrainerLookups($pdo) : ['id_by_email' => [], 'valid_ids' => []];

    $totalRows = 0;
    $validRows = [];
    $errors = [];
    $duplicateRows = 0;
    $seenCsvEmails = [];

    $rowNumber = 1;

    while (($row = fgetcsv($handle)) !== false) {
        $rowNumber++;

        if ($row === [null] || (count($row) === 1 && trim((string) $row[0]) === '')) {
            continue;
        }

        $totalRows++;
        $rawData = encodeLegacyCsvRawRow($row);

        $fullName = getLegacyCsvCell($row, $mapping['full_name'] ?? null);
        $emailRaw = getLegacyCsvCell($row, $mapping['email'] ?? null);
        $email = strtolower(trim($emailRaw));
        $phone = getLegacyCsvCell($row, $mapping['phone'] ?? null);
        $membershipRaw = getLegacyCsvCell($row, $mapping['membership_type'] ?? null);
        $startDateRaw = getLegacyCsvCell($row, $mapping['start_date'] ?? null);
        $trainerIdRaw = getLegacyCsvCell($row, $mapping['assigned_trainer_id'] ?? null);
        $trainerEmailRaw = getLegacyCsvCell($row, $mapping['assigned_trainer_email'] ?? null);

        $rowErrors = [];

        if ($fullName === '') {
            $rowErrors[] = 'Full name is required.';
        }

        if ($email === '') {
            $rowErrors[] = 'Email is required.';
        } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $rowErrors[] = 'Invalid email format.';
        }

        if ($email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL)) {
            if (isset($seenCsvEmails[$email])) {
                $duplicateRows++;
                $rowErrors[] = 'Duplicate email within CSV.';
            } elseif (isset($existingEmails[$email])) {
                $rowErrors[] = 'Email already exists in the database.';
            }
            $seenCsvEmails[$email] = true;
        }

        $membershipType = normalizeLegacyMembershipType($membershipRaw);
        if ($membershipType === null) {
            $rowErrors[] = 'Invalid membership type.';
        }

        $startDate = null;
        if ($startDateRaw !== '') {
            $dateResult = normalizeLegacyDate($startDateRaw);
            if (!$dateResult['ok']) {
                $rowErrors[] = $dateResult['message'];
            } else {
                $startDate = $dateResult['date'];
            }
        }

        $assignedTrainerId = null;
        if ($trainerIdRaw !== '') {
            if (!ctype_digit($trainerIdRaw)) {
                $rowErrors[] = 'Invalid assigned trainer id.';
            } else {
                $candidateId = (int) $trainerIdRaw;
                if (!isset($trainerLookups['valid_ids'][$candidateId])) {
                    $rowErrors[] = 'Assigned trainer id does not exist.';
                } else {
                    $assignedTrainerId = $candidateId;
                }
            }
        } elseif ($trainerEmailRaw !== '') {
            $trainerEmail = strtolower(trim($trainerEmailRaw));
            if (!isset($trainerLookups['id_by_email'][$trainerEmail])) {
                $rowErrors[] = 'Assigned trainer email does not exist.';
            } else {
                $assignedTrainerId = $trainerLookups['id_by_email'][$trainerEmail];
            }
        }

        if (!empty($rowErrors)) {
            $errors[] = [
                'row_number'    => $rowNumber,
                'error_message' => implode(' ', $rowErrors),
                'raw_data'      => $rawData,
            ];
            continue;
        }

        $validRows[] = [
            'row_number'            => $rowNumber,
            'full_name'             => $fullName,
            'email'                 => $email,
            'phone'                 => $phone !== '' ? $phone : null,
            'membership_type'       => $membershipType,
            'start_date'            => $startDate,
            'assigned_trainer_id'   => $assignedTrainerId,
            'status'                => 'active',
            'raw_data'              => $rawData,
        ];
    }

    fclose($handle);

    return [
        'ok'              => true,
        'total_rows'      => $totalRows,
        'valid_rows'      => count($validRows),
        'invalid_rows'    => count($errors),
        'duplicate_rows'  => $duplicateRows,
        'rows'            => $validRows,
        'errors'          => $errors,
    ];
}

/**
 * Build preview payload from processed CSV data.
 *
 * @param array $processed
 * @return array
 */
function buildLegacyImportPreviewResponse(array $processed)
{
    $cleanedPreview = [];
    foreach (array_slice($processed['rows'], 0, LEGACY_PREVIEW_LIMIT) as $row) {
        $cleanedPreview[] = [
            'row_number'            => $row['row_number'],
            'full_name'             => $row['full_name'],
            'email'                 => $row['email'],
            'phone'                 => $row['phone'],
            'membership_type'       => $row['membership_type'],
            'start_date'            => $row['start_date'],
            'assigned_trainer_id'   => $row['assigned_trainer_id'],
        ];
    }

    $errorsPreview = array_slice($processed['errors'], 0, LEGACY_ERRORS_PREVIEW_LIMIT);

    return [
        'total_rows'      => $processed['total_rows'],
        'valid_rows'      => $processed['valid_rows'],
        'invalid_rows'    => $processed['invalid_rows'],
        'duplicate_rows'  => $processed['duplicate_rows'],
        'cleaned_preview' => $cleanedPreview,
        'errors_preview'  => $errorsPreview,
    ];
}

/**
 * Insert valid legacy member rows and log rejected rows.
 *
 * @param PDO $pdo
 * @param array $processed
 * @param array $user
 * @param string $originalFilename
 * @param string $storedFilename
 * @return array
 */
function executeLegacyImport(PDO $pdo, array $processed, array $user, $originalFilename, $storedFilename)
{
    $pdo->beginTransaction();

    try {
        $batchStmt = $pdo->prepare(
            'INSERT INTO import_batches
                (import_type, original_filename, stored_filename, total_rows, valid_rows, rejected_rows,
                 imported_rows, status, created_by_user_id)
             VALUES
                (:import_type, :original_filename, :stored_filename, :total_rows, :valid_rows, :rejected_rows,
                 0, :status, :created_by_user_id)'
        );
        $batchStmt->execute([
            'import_type'         => LEGACY_IMPORT_TYPE,
            'original_filename'   => $originalFilename,
            'stored_filename'     => $storedFilename,
            'total_rows'          => (int) $processed['total_rows'],
            'valid_rows'          => (int) $processed['valid_rows'],
            'rejected_rows'       => (int) $processed['invalid_rows'],
            'status'              => 'processing',
            'created_by_user_id'  => (int) $user['id'],
        ]);

        $batchId = (int) $pdo->lastInsertId();

        $insertMember = $pdo->prepare(
            'INSERT INTO members
                (full_name, email, phone, membership_type, start_date, assigned_trainer_id, status)
             VALUES
                (:full_name, :email, :phone, :membership_type, :start_date, :assigned_trainer_id, :status)'
        );

        $insertError = $pdo->prepare(
            'INSERT INTO import_errors
                (batch_id, row_number, raw_data, error_message)
             VALUES
                (:batch_id, :row_number, :raw_data, :error_message)'
        );

        $insertedCount = 0;
        $runtimeErrors = [];

        foreach ($processed['rows'] as $row) {
            try {
                $insertMember->execute([
                    'full_name'            => $row['full_name'],
                    'email'                => $row['email'],
                    'phone'                => $row['phone'],
                    'membership_type'      => $row['membership_type'],
                    'start_date'           => $row['start_date'],
                    'assigned_trainer_id'  => $row['assigned_trainer_id'],
                    'status'               => $row['status'],
                ]);
                $insertedCount++;
            } catch (Throwable $memberInsertFailure) {
                $runtimeErrors[] = [
                    'row_number'    => $row['row_number'],
                    'error_message' => 'Could not insert member record.',
                    'raw_data'      => $row['raw_data'],
                ];
            }
        }

        foreach ($processed['errors'] as $errorRow) {
            $insertError->execute([
                'batch_id'      => $batchId,
                'row_number'    => (int) $errorRow['row_number'],
                'raw_data'      => $errorRow['raw_data'],
                'error_message' => $errorRow['error_message'],
            ]);
        }

        foreach ($runtimeErrors as $errorRow) {
            $insertError->execute([
                'batch_id'      => $batchId,
                'row_number'    => (int) $errorRow['row_number'],
                'raw_data'      => $errorRow['raw_data'],
                'error_message' => $errorRow['error_message'],
            ]);
        }

        $errorCount = count($processed['errors']) + count($runtimeErrors);
        $skippedCount = max(0, (int) $processed['valid_rows'] - $insertedCount);
        $status = 'completed';

        if ($insertedCount === 0 && $errorCount > 0) {
            $status = 'failed';
        } elseif ($errorCount > 0 || $skippedCount > 0) {
            $status = 'partial';
        }

        $updateBatch = $pdo->prepare(
            'UPDATE import_batches
             SET imported_rows = :imported_rows,
                 rejected_rows = :rejected_rows,
                 valid_rows = :valid_rows,
                 status = :status,
                 completed_at = CURRENT_TIMESTAMP
             WHERE id = :id'
        );
        $updateBatch->execute([
            'imported_rows'  => $insertedCount,
            'rejected_rows'  => $errorCount,
            'valid_rows'     => $insertedCount,
            'status'         => $status,
            'id'             => $batchId,
        ]);

        $pdo->commit();

        return [
            'import_batch_id' => $batchId,
            'total_rows'      => (int) $processed['total_rows'],
            'inserted_count'  => $insertedCount,
            'skipped_count'   => $skippedCount,
            'error_count'     => $errorCount,
            'duplicate_count' => (int) $processed['duplicate_rows'],
            'status'          => $status,
        ];
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        throw $e;
    }
}

/**
 * Format import batch row for JSON output.
 *
 * @param array $row
 * @return array
 */
function formatImportBatchRow(array $row)
{
    return [
        'id'                 => (int) $row['id'],
        'import_type'        => (string) $row['import_type'],
        'original_filename'  => (string) $row['original_filename'],
        'stored_filename'    => (string) $row['stored_filename'],
        'total_rows'         => (int) $row['total_rows'],
        'valid_rows'         => (int) $row['valid_rows'],
        'rejected_rows'      => (int) $row['rejected_rows'],
        'imported_rows'      => (int) $row['imported_rows'],
        'status'             => (string) $row['status'],
        'created_by_user_id' => $row['created_by_user_id'] !== null ? (int) $row['created_by_user_id'] : null,
        'created_at'         => (string) $row['created_at'],
        'completed_at'       => $row['completed_at'] !== null ? (string) $row['completed_at'] : null,
    ];
}

/**
 * Format import error row for JSON output.
 *
 * @param array $row
 * @return array
 */
function formatImportErrorRow(array $row)
{
    return [
        'id'            => (int) $row['id'],
        'batch_id'      => (int) $row['batch_id'],
        'row_number'    => (int) $row['row_number'],
        'error_message' => (string) $row['error_message'],
        'raw_data'      => $row['raw_data'] !== null ? (string) $row['raw_data'] : null,
        'created_at'    => (string) $row['created_at'],
    ];
}
