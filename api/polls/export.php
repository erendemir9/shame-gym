<?php
/**
 * polls/export.php — export poll results as CSV (admin only).
 *
 * GET api/polls/export.php?id=
 */

declare(strict_types=1);

ini_set('display_errors', '0');
error_reporting(E_ALL);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/auth.php';
require_once __DIR__ . '/../config/request.php';
require_once __DIR__ . '/poll_input.php';

requireHttpMethod('GET');

try {
    requireRole('admin');

    $pollId = getQueryInt('id');
    if ($pollId === null) {
        errorResponse('Poll id is required.', 400);
    }

    $pdo = getDatabaseConnection();
    $pollRow = fetchPollRowById($pdo, $pollId);

    if (!$pollRow) {
        errorResponse('Poll not found.', 404);
    }

    $results = fetchPollResults($pdo, $pollId);
    $berlinTime = new DateTime('now', new DateTimeZone('Europe/Berlin'));
    $generatedAt = $berlinTime->format('Y-m-d H:i:s') . ' ' . $berlinTime->format('T');
    $question = (string) $pollRow['question'];
    $totalVotes = (int) $results['total_votes'];

    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="poll_results_' . $pollId . '.csv"');
    header('Cache-Control: no-store, no-cache, must-revalidate');
    header('Pragma: no-cache');

    $output = fopen('php://output', 'w');
    if ($output === false) {
        errorResponse('Could not create CSV export.', 500);
    }

    fputcsv($output, [
        'poll_id',
        'question',
        'option_id',
        'option_text',
        'vote_count',
        'percentage',
        'total_votes',
        'generated_at',
    ]);

    foreach ($results['options'] as $option) {
        fputcsv($output, [
            $pollId,
            $question,
            (int) $option['option_id'],
            (string) $option['option_text'],
            (int) $option['vote_count'],
            (float) $option['percentage'],
            $totalVotes,
            $generatedAt,
        ]);
    }

    fclose($output);
    exit;
} catch (Throwable $e) {
    errorResponse('Failed to export poll results.', 500, [
        'error' => $e->getMessage(),
    ]);
}
