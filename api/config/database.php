<?php
/**
 * database.php — PDO connection helper for local XAMPP development.
 *
 * Returns a shared PDO instance configured for shame_gym_db.
 * Credentials below are for local development only (root, no password).
 * Production deployments must use environment-specific settings.
 */

/**
 * Get a PDO connection to the SHAME Gym database.
 *
 * @return PDO
 * @throws PDOException if the connection fails
 */
function getDatabaseConnection()
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    // Local XAMPP defaults — change for production hosting.
    $host = '127.0.0.1';
    $dbname = 'shame_gym_db';
    $username = 'root';
    $password = '';

    $dsn = 'mysql:host=' . $host . ';dbname=' . $dbname . ';charset=utf8mb4';

    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];

    $pdo = new PDO($dsn, $username, $password, $options);

    return $pdo;
}
