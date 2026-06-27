<?php
/**
 * login.php — authenticate a user and start a PHP session.
 *
 * POST JSON: { "email": "...", "password": "..." }
 * URL: http://localhost/shame-gym/api/auth/login.php
 */

declare(strict_types=1);

ini_set('display_errors', '0');
error_reporting(E_ALL);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/auth.php';

requireHttpMethod('POST');

try {
    $body = getJsonRequestBody();

    if ($body === null) {
        errorResponse('Invalid JSON request body.', 400);
    }

    $email = isset($body['email']) ? normalizeEmail($body['email']) : '';
    $password = isset($body['password']) ? (string) $body['password'] : '';

    if ($email === '' || $password === '') {
        errorResponse('Email and password are required.', 400);
    }

    $pdo = getDatabaseConnection();

    $stmt = $pdo->prepare(
        'SELECT id, email, password_hash, full_name, role, linked_member_id, linked_trainer_id,
                needs_password_setup, is_active
         FROM users
         WHERE email = :email
         LIMIT 1'
    );
    $stmt->execute(['email' => $email]);
    $user = $stmt->fetch();

    if (!$user) {
        errorResponse('Invalid credentials.', 401);
    }

    if ((int) $user['is_active'] !== 1) {
        errorResponse('This account is inactive.', 403);
    }

    if ((int) $user['needs_password_setup'] === 1) {
        errorResponse('Account activation is required before login.', 403);
    }

    if (empty($user['password_hash']) || !password_verify($password, $user['password_hash'])) {
        errorResponse('Invalid credentials.', 401);
    }

    $safeUser = sanitizeSessionUser($user);
    setCurrentUser($safeUser);

    successResponse([
        'user' => $safeUser,
    ], 'Login successful');
} catch (Throwable $e) {
    errorResponse('Login failed due to a server error.', 500, [
        'error' => $e->getMessage(),
    ]);
}
