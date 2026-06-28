<?php
/**
 * activate.php — set first password for pending user accounts.
 *
 * POST JSON: { "email": "...", "password": "...", "confirmPassword": "..." }
 * URL: http://localhost/shame-gym/api/auth/activate.php
 *
 * Does not automatically log the user in; they must call login.php afterward.
 */

declare(strict_types=1);

ini_set('display_errors', '0');
error_reporting(E_ALL);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/auth.php';

requireHttpMethod('POST');

const MIN_PASSWORD_LENGTH = 6;

try {
    $body = getJsonRequestBody();

    if ($body === null) {
        errorResponse('Invalid JSON request body.', 400);
    }

    $email = isset($body['email']) ? normalizeEmail($body['email']) : '';
    $password = isset($body['password']) ? (string) $body['password'] : '';
    $confirmPassword = isset($body['confirmPassword']) ? (string) $body['confirmPassword'] : '';

    if ($email === '' || $password === '' || $confirmPassword === '') {
        errorResponse('Email, password, and confirmPassword are required.', 400);
    }

    if ($password !== $confirmPassword) {
        errorResponse('Password and confirmPassword do not match.', 400);
    }

    if (strlen($password) < MIN_PASSWORD_LENGTH) {
        errorResponse('Password must be at least ' . MIN_PASSWORD_LENGTH . ' characters.', 400);
    }

    $pdo = getDatabaseConnection();

    $stmt = $pdo->prepare(
        'SELECT id, email, needs_password_setup, is_active
         FROM users
         WHERE email = :email
         LIMIT 1'
    );
    $stmt->execute(['email' => $email]);
    $user = $stmt->fetch();

    if (!$user) {
        errorResponse('Account not found.', 404);
    }

    if ((int) $user['needs_password_setup'] !== 1) {
        errorResponse('This account is already activated.', 409);
    }

    $passwordHash = password_hash($password, PASSWORD_DEFAULT);

    $update = $pdo->prepare(
        'UPDATE users
         SET password_hash = :password_hash,
             needs_password_setup = 0,
             is_active = 1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = :id'
    );
    $update->execute([
        'password_hash' => $passwordHash,
        'id'            => (int) $user['id'],
    ]);

    successResponse([
        'email' => (string) $user['email'],
    ], 'Account activated successfully');
} catch (Throwable $e) {
    errorResponse('Account activation failed due to a server error.', 500, [
        'error' => $e->getMessage(),
    ]);
}
