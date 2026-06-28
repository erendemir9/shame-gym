<?php
/**
 * documents/list.php — list documents with role-based filtering.
 *
 * GET api/documents/list.php
 * Optional: search, category
 */

declare(strict_types=1);

ini_set('display_errors', '0');
error_reporting(E_ALL);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/auth.php';
require_once __DIR__ . '/../config/request.php';
require_once __DIR__ . '/document_input.php';

requireHttpMethod('GET');

try {
    $user = requireLogin();
    $pdo = getDatabaseConnection();
    $role = (string) $user['role'];

    $sql = 'SELECT DISTINCT d.id, d.title, d.description, d.category, d.keywords, d.original_filename,
                   d.stored_filename, d.file_path, d.file_type, d.file_size, d.uploaded_by_user_id,
                   d.is_available, d.created_at, d.updated_at
            FROM documents d';

    $params = [];
    $conditions = ['d.is_available = 1'];

    if ($role !== 'admin') {
        $sql .= ' INNER JOIN document_access da ON da.document_id = d.id AND da.role = :role';
        $params['role'] = $role;
    }

    $search = getQueryString('search');
    if ($search !== null) {
        $searchValue = '%' . $search . '%';
        $conditions[] = '(d.title LIKE :search_title OR d.description LIKE :search_description OR d.keywords LIKE :search_keywords OR d.category LIKE :search_category)';
        $params['search_title'] = $searchValue;
        $params['search_description'] = $searchValue;
        $params['search_keywords'] = $searchValue;
        $params['search_category'] = $searchValue;
    }

    $category = getQueryString('category');
    if ($category !== null) {
        $conditions[] = 'd.category = :category';
        $params['category'] = $category;
    }

    $sql .= ' WHERE ' . implode(' AND ', $conditions);
    $sql .= ' ORDER BY d.created_at DESC, d.title ASC';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    $documents = [];
    foreach ($rows as $row) {
        $documents[] = formatDocumentRow($pdo, $row);
    }

    successResponse(['documents' => $documents], 'Documents loaded successfully');
} catch (Throwable $e) {
    errorResponse('Failed to load documents.', 500, [
        'error' => $e->getMessage(),
    ]);
}
