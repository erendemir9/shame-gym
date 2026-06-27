<?php
/**
 * response.php — shared JSON response helpers for API endpoints.
 *
 * All API files should return JSON (not HTML) so the frontend can use fetch().
 */

/**
 * Send a JSON response and stop script execution.
 *
 * @param mixed $data
 * @param int   $statusCode HTTP status code (default 200)
 * @return void
 */
function jsonResponse($data, $statusCode = 200)
{
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Send a standard success JSON response.
 *
 * @param mixed  $data
 * @param string $message
 * @param int    $statusCode
 * @return void
 */
function successResponse($data = [], $message = 'Success', $statusCode = 200)
{
    jsonResponse([
        'success' => true,
        'message' => $message,
        'data'    => $data,
    ], $statusCode);
}

/**
 * Send a standard error JSON response.
 *
 * @param string     $message
 * @param int        $statusCode
 * @param mixed|null $details Optional extra detail (never include credentials)
 * @return void
 */
function errorResponse($message = 'Error', $statusCode = 400, $details = null)
{
    jsonResponse([
        'success' => false,
        'message' => $message,
        'details' => $details,
    ], $statusCode);
}
