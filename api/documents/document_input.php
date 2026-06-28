<?php
/**
 * document_input.php — shared helpers for document APIs.
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/request.php';

const DOCUMENT_MAX_BYTES = 10485760; // 10 MB

const DOCUMENT_ALLOWED_EXTENSIONS = [
    'pdf'  => ['application/pdf'],
    'doc'  => ['application/msword'],
    'docx' => ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    'txt'  => ['text/plain'],
    'png'  => ['image/png'],
    'jpg'  => ['image/jpeg'],
    'jpeg' => ['image/jpeg'],
];

const DOCUMENT_ALLOWED_ROLES = ['admin', 'trainer', 'member'];

/**
 * Project root directory (shame-gym/).
 *
 * @return string
 */
function getProjectRootPath()
{
    return dirname(__DIR__, 2);
}

/**
 * Absolute path to uploads/documents/.
 *
 * @return string
 */
function getDocumentsUploadDir()
{
    return getProjectRootPath() . '/uploads/documents';
}

/**
 * Ensure uploads/documents exists.
 *
 * @return void
 */
function ensureDocumentsUploadDir()
{
    $rootUploads = getProjectRootPath() . '/uploads';
    $dir = getDocumentsUploadDir();

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
 * Parse document id from request value.
 *
 * @param mixed $rawId
 * @return int|null
 */
function parseDocumentIdFromRequest($rawId)
{
    if ($rawId === null || $rawId === '') {
        return null;
    }

    if (is_int($rawId) && $rawId > 0) {
        return $rawId;
    }

    if (is_string($rawId) && ctype_digit($rawId)) {
        $documentId = (int) $rawId;
        return $documentId > 0 ? $documentId : null;
    }

    if (is_string($rawId) && preg_match('/^doc(\d+)$/i', $rawId, $matches)) {
        return (int) $matches[1];
    }

    return null;
}

/**
 * Load access roles for a document.
 *
 * @param PDO $pdo
 * @param int $documentId
 * @return array
 */
function fetchDocumentAccessRoles(PDO $pdo, $documentId)
{
    $stmt = $pdo->prepare(
        'SELECT role
         FROM document_access
         WHERE document_id = :document_id
         ORDER BY role ASC'
    );
    $stmt->execute(['document_id' => $documentId]);
    $roles = [];

    foreach ($stmt->fetchAll() as $row) {
        $roles[] = (string) $row['role'];
    }

    return $roles;
}

/**
 * Format document row for JSON output.
 *
 * @param PDO   $pdo
 * @param array $row
 * @return array
 */
function formatDocumentRow(PDO $pdo, array $row)
{
    $accessRoles = fetchDocumentAccessRoles($pdo, (int) $row['id']);

    return [
        'id'                  => (int) $row['id'],
        'frontend_id'         => 'doc' . $row['id'],
        'title'               => (string) $row['title'],
        'description'         => $row['description'] !== null ? (string) $row['description'] : '',
        'category'            => (string) $row['category'],
        'keywords'            => $row['keywords'] !== null ? (string) $row['keywords'] : '',
        'original_filename'   => (string) $row['original_filename'],
        'file_type'           => $row['file_type'] !== null ? (string) $row['file_type'] : '',
        'file_size'           => $row['file_size'] !== null ? (int) $row['file_size'] : null,
        'uploaded_by_user_id' => $row['uploaded_by_user_id'] !== null ? (int) $row['uploaded_by_user_id'] : null,
        'is_available'        => (int) $row['is_available'] === 1,
        'access_roles'        => $accessRoles,
        'created_at'          => (string) $row['created_at'],
        'updated_at'          => (string) $row['updated_at'],
    ];
}

/**
 * Load one document row by id.
 *
 * @param PDO $pdo
 * @param int $documentId
 * @return array|null
 */
function fetchDocumentRowById(PDO $pdo, $documentId)
{
    $stmt = $pdo->prepare(
        'SELECT id, title, description, category, keywords, original_filename, stored_filename,
                file_path, file_type, file_size, uploaded_by_user_id, is_available, created_at, updated_at
         FROM documents
         WHERE id = :id
         LIMIT 1'
    );
    $stmt->execute(['id' => $documentId]);
    $row = $stmt->fetch();

    return $row ?: null;
}

/**
 * Check whether a user may access a document (view/download).
 *
 * @param PDO   $pdo
 * @param array $user
 * @param array $documentRow
 * @return bool
 */
function canAccessDocument(PDO $pdo, array $user, array $documentRow)
{
    if ((int) $documentRow['is_available'] !== 1) {
        return $user['role'] === 'admin';
    }

    if ($user['role'] === 'admin') {
        return true;
    }

    $stmt = $pdo->prepare(
        'SELECT id
         FROM document_access
         WHERE document_id = :document_id AND role = :role
         LIMIT 1'
    );
    $stmt->execute([
        'document_id' => (int) $documentRow['id'],
        'role'        => (string) $user['role'],
    ]);

    return (bool) $stmt->fetch();
}

/**
 * Resolve absolute filesystem path for a stored document.
 *
 * @param array $documentRow
 * @return string|null
 */
function resolveDocumentAbsolutePath(array $documentRow)
{
    $relativePath = (string) $documentRow['file_path'];
    if ($relativePath === '' || strpos($relativePath, '..') !== false) {
        return null;
    }

    if (strpos($relativePath, 'uploads/documents/') !== 0) {
        return null;
    }

    $absolutePath = getProjectRootPath() . '/' . $relativePath;
    $realPath = realpath($absolutePath);
    $uploadReal = realpath(getDocumentsUploadDir());

    if ($realPath === false || $uploadReal === false) {
        return null;
    }

    if (strpos($realPath, $uploadReal) !== 0) {
        return null;
    }

    return $realPath;
}

/**
 * Normalize access roles from request payload.
 *
 * @param mixed $rawRoles
 * @return array{ok:bool,message?:string,roles?:array}
 */
function normalizeDocumentAccessRoles($rawRoles)
{
    if (!is_array($rawRoles)) {
        return ['ok' => false, 'message' => 'Access roles must be an array.'];
    }

    $roles = [];
    foreach ($rawRoles as $role) {
        $normalized = strtolower(trim((string) $role));
        if ($normalized === '') {
            continue;
        }
        if (!in_array($normalized, DOCUMENT_ALLOWED_ROLES, true)) {
            return ['ok' => false, 'message' => 'Invalid access role: ' . $normalized];
        }
        $roles[$normalized] = $normalized;
    }

    $roles['admin'] = 'admin';

    return ['ok' => true, 'roles' => array_values($roles)];
}

/**
 * Replace document_access rows for a document.
 *
 * @param PDO   $pdo
 * @param int   $documentId
 * @param array $roles
 * @return void
 */
function replaceDocumentAccessRoles(PDO $pdo, $documentId, array $roles)
{
    $deleteStmt = $pdo->prepare('DELETE FROM document_access WHERE document_id = :document_id');
    $deleteStmt->execute(['document_id' => $documentId]);

    $insertStmt = $pdo->prepare(
        'INSERT INTO document_access (document_id, role) VALUES (:document_id, :role)'
    );

    foreach ($roles as $role) {
        $insertStmt->execute([
            'document_id' => $documentId,
            'role'        => $role,
        ]);
    }
}

/**
 * Sanitize original filename for storage metadata.
 *
 * @param string $filename
 * @return string
 */
function sanitizeOriginalFilename($filename)
{
    $basename = basename(str_replace('\\', '/', (string) $filename));
    $basename = preg_replace('/[^A-Za-z0-9._ -]+/', '_', $basename);
    $basename = trim((string) $basename, '. ');

    if ($basename === '') {
        return 'document.bin';
    }

    return substr($basename, 0, 255);
}

/**
 * Generate a safe stored filename.
 *
 * @param string $extension
 * @return string
 */
function generateStoredFilename($extension)
{
    $safeExt = preg_replace('/[^a-z0-9]+/', '', strtolower((string) $extension));
    if ($safeExt === '') {
        $safeExt = 'bin';
    }

    return 'doc_' . date('Ymd_His') . '_' . bin2hex(random_bytes(8)) . '.' . $safeExt;
}

/**
 * Validate uploaded file from $_FILES entry.
 *
 * @param array $fileEntry
 * @return array{ok:bool,message?:string,extension?:string,mime?:string,size?:int}
 */
function validateUploadedDocumentFile(array $fileEntry)
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

    if ($size > DOCUMENT_MAX_BYTES) {
        return ['ok' => false, 'message' => 'File exceeds the 10 MB limit.'];
    }

    $originalName = sanitizeOriginalFilename($fileEntry['name'] ?? 'document.bin');
    $extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));

    if ($extension === '' || !isset(DOCUMENT_ALLOWED_EXTENSIONS[$extension])) {
        return ['ok' => false, 'message' => 'File type not allowed. Use PDF, DOC, DOCX, TXT, PNG, JPG, or JPEG.'];
    }

    $blockedExtensions = ['php', 'phtml', 'php3', 'php4', 'php5', 'phar', 'exe', 'sh', 'bat', 'js', 'html', 'htm'];
    if (in_array($extension, $blockedExtensions, true)) {
        return ['ok' => false, 'message' => 'File type not allowed.'];
    }

    $tmpPath = $fileEntry['tmp_name'] ?? '';
    if ($tmpPath === '' || !is_uploaded_file($tmpPath)) {
        return ['ok' => false, 'message' => 'Invalid upload source.'];
    }

    $detectedMime = mime_content_type($tmpPath);
    if ($detectedMime === false) {
        return ['ok' => false, 'message' => 'Could not determine file type.'];
    }

    $allowedMimes = DOCUMENT_ALLOWED_EXTENSIONS[$extension];
    if (!in_array($detectedMime, $allowedMimes, true)) {
        return ['ok' => false, 'message' => 'File content does not match the allowed type.'];
    }

    return [
        'ok'        => true,
        'extension' => $extension,
        'mime'      => $detectedMime,
        'size'      => $size,
        'original'  => $originalName,
    ];
}

/**
 * Normalize metadata update payload.
 *
 * @param array $body
 * @param bool  $requireId
 * @return array{ok:bool,message?:string,data?:array}
 */
function normalizeDocumentWritePayload(array $body, $requireId = false)
{
    $documentId = null;
    if ($requireId) {
        if (!array_key_exists('id', $body)) {
            return ['ok' => false, 'message' => 'Document id is required.'];
        }
        $documentId = parseDocumentIdFromRequest($body['id']);
        if ($documentId === null) {
            return ['ok' => false, 'message' => 'Invalid document id.'];
        }
    }

    $title = isset($body['title']) ? trim((string) $body['title']) : '';
    if ($title === '') {
        return ['ok' => false, 'message' => 'Title is required.'];
    }

    $category = isset($body['category']) ? trim((string) $body['category']) : 'General';
    if ($category === '') {
        $category = 'General';
    }

    $description = null;
    if (isset($body['description']) && trim((string) $body['description']) !== '') {
        $description = trim((string) $body['description']);
    }

    $keywords = null;
    if (isset($body['keywords']) && trim((string) $body['keywords']) !== '') {
        $keywords = trim((string) $body['keywords']);
    }

    $accessRoles = ['admin'];
    if (isset($body['access_roles'])) {
        $rolesResult = normalizeDocumentAccessRoles($body['access_roles']);
        if (!$rolesResult['ok']) {
            return ['ok' => false, 'message' => $rolesResult['message']];
        }
        $accessRoles = $rolesResult['roles'];
    }

    $data = [
        'title'        => $title,
        'category'     => substr($category, 0, 80),
        'description'  => $description,
        'keywords'     => $keywords !== null ? substr($keywords, 0, 500) : null,
        'access_roles' => $accessRoles,
    ];

    if ($requireId) {
        $data['id'] = $documentId;
    }

    return ['ok' => true, 'data' => $data];
}
