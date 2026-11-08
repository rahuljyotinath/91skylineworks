<?php

/**
 * Minimal SMTP client (STARTTLS + AUTH LOGIN) for shared hosting.
 */

function mail_settings(array $cfg): array
{
    return [
        'to' => $cfg['mail_to'] ?? 'contact@91skylineworks.com',
        'from' => $cfg['mail_from'] ?? 'website@91skylineworks.com',
        'from_name' => $cfg['mail_from_name'] ?? '91SkylineWorks Website',
        'host' => $cfg['smtp_host'] ?? '',
        'port' => (int) ($cfg['smtp_port'] ?? 587),
        'user' => $cfg['smtp_user'] ?? '',
        'pass' => $cfg['smtp_pass'] ?? '',
    ];
}

function mail_is_configured(array $cfg): bool
{
    $m = mail_settings($cfg);
    return $m['host'] !== '' && $m['user'] !== '' && $m['pass'] !== '';
}

function smtp_read($socket): string
{
    $data = '';
    while ($line = fgets($socket, 515)) {
        $data .= $line;
        if (isset($line[3]) && $line[3] === ' ') {
            break;
        }
    }
    return $data;
}

function smtp_expect($socket, array $codes): string
{
    $resp = smtp_read($socket);
    $code = (int) substr($resp, 0, 3);
    if (!in_array($code, $codes, true)) {
        throw new RuntimeException('SMTP error: ' . trim($resp));
    }
    return $resp;
}

function smtp_cmd($socket, string $cmd, array $codes): void
{
    fwrite($socket, $cmd . "\r\n");
    smtp_expect($socket, $codes);
}

function smtp_send(array $mail, string $to, string $subject, string $bodyPlain, ?string $replyTo = null): void
{
    $host = $mail['host'];
    $port = $mail['port'];
    $user = $mail['user'];
    $pass = $mail['pass'];
    $from = $mail['from'];
    $fromName = $mail['from_name'];

    $context = stream_context_create([
        'ssl' => [
            'verify_peer' => false,
            'verify_peer_name' => false,
            'allow_self_signed' => true,
        ],
    ]);

    $socket = @stream_socket_client(
        "tcp://{$host}:{$port}",
        $errno,
        $errstr,
        20,
        STREAM_CLIENT_CONNECT,
        $context
    );

    if (!$socket) {
        throw new RuntimeException("SMTP connect failed: {$errstr} ({$errno})");
    }

    stream_set_timeout($socket, 20);

    try {
        smtp_expect($socket, [220]);
        smtp_cmd($socket, 'EHLO ' . gethostname(), [250]);
        smtp_cmd($socket, 'STARTTLS', [220]);

        $crypto = STREAM_CRYPTO_METHOD_TLS_CLIENT;
        if (defined('STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT')) {
            $crypto |= STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT;
        }

        if (!@stream_socket_enable_crypto($socket, true, $crypto)) {
            throw new RuntimeException('SMTP STARTTLS failed');
        }

        smtp_cmd($socket, 'EHLO ' . gethostname(), [250]);
        smtp_cmd($socket, 'AUTH LOGIN', [334]);
        smtp_cmd($socket, base64_encode($user), [334]);
        smtp_cmd($socket, base64_encode($pass), [235]);
        smtp_cmd($socket, 'MAIL FROM:<' . $from . '>', [250]);
        smtp_cmd($socket, 'RCPT TO:<' . $to . '>', [250, 251]);
        smtp_cmd($socket, 'DATA', [354]);

        $encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
        $fromHeader = sprintf('From: %s <%s>', $fromName, $from);
        $toHeader = 'To: <' . $to . '>';
        $dateHeader = 'Date: ' . gmdate('D, d M Y H:i:s') . ' +0000';
        $mimeHeader = 'MIME-Version: 1.0';
        $typeHeader = 'Content-Type: text/plain; charset=UTF-8';
        $transferHeader = 'Content-Transfer-Encoding: 8bit';

        $headers = [$fromHeader, $toHeader, $dateHeader, $mimeHeader, $typeHeader, $transferHeader, 'Subject: ' . $encodedSubject];
        if ($replyTo && filter_var($replyTo, FILTER_VALIDATE_EMAIL)) {
            $headers[] = 'Reply-To: <' . $replyTo . '>';
        }

        $message = implode("\r\n", $headers) . "\r\n\r\n" . str_replace(["\r\n", "\r"], "\n", $bodyPlain);
        $message = str_replace("\n", "\r\n", $message);
        $message = preg_replace('/^\./m', '..', $message);

        fwrite($socket, $message . "\r\n.\r\n");
        smtp_expect($socket, [250]);
        smtp_cmd($socket, 'QUIT', [221]);
    } finally {
        fclose($socket);
    }
}

function format_lead_email_body(array $lead): string
{
    $lines = [
        'New inquiry from 91skylineworks.com',
        '',
        'Name: ' . ($lead['name'] ?? ''),
        'Phone: ' . ($lead['phone'] ?? '—'),
        'Email: ' . ($lead['email'] ?? '—'),
        'Service / topic: ' . ($lead['locality'] ?? '—'),
        'Source: ' . ($lead['source'] ?? 'contact'),
        '',
        'Message:',
        $lead['message'] ?? '(none)',
    ];

    $attachments = $lead['attachments'] ?? [];
    if (is_array($attachments) && count($attachments) > 0) {
        $lines[] = '';
        $lines[] = 'Attachments:';
        foreach ($attachments as $url) {
            $lines[] = 'https://91skylineworks.com' . $url;
        }
    }

    $lines[] = '';
    $lines[] = 'Submitted: ' . gmdate('Y-m-d H:i:s') . ' UTC';

    return implode("\n", $lines);
}

function resend_is_configured(array $cfg): bool
{
    return isset($cfg['resend_api_key']) && $cfg['resend_api_key'] !== '';
}

function resend_send_lead(array $cfg, array $lead): bool
{
    $key = $cfg['resend_api_key'];
    $mail = mail_settings($cfg);
    $subject = 'New website lead: ' . ($lead['name'] ?? 'Unknown');
    $body = format_lead_email_body($lead);

    $payload = [
        'from' => sprintf('%s <%s>', $mail['from_name'], $mail['from']),
        'to' => [$mail['to']],
        'subject' => $subject,
        'text' => $body,
    ];
    $replyTo = $lead['email'] ?? null;
    if ($replyTo && filter_var($replyTo, FILTER_VALIDATE_EMAIL)) {
        $payload['reply_to'] = $replyTo;
    }

    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => "Authorization: Bearer {$key}\r\nContent-Type: application/json\r\n",
            'content' => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'timeout' => 20,
            'ignore_errors' => true,
        ],
    ]);

    $raw = @file_get_contents('https://api.resend.com/emails', false, $context);
    if ($raw === false) {
        return false;
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) && isset($decoded['id']);
}

function send_lead_notification(array $cfg, array $lead): bool
{
    if (resend_is_configured($cfg)) {
        try {
            if (resend_send_lead($cfg, $lead)) {
                return true;
            }
        } catch (Throwable $e) {
            error_log('[leads] Resend failed: ' . $e->getMessage());
        }
    }

    if (!mail_is_configured($cfg)) {
        return false;
    }

    $mail = mail_settings($cfg);
    $subject = 'New website lead: ' . ($lead['name'] ?? 'Unknown');
    $body = format_lead_email_body($lead);
    $replyTo = $lead['email'] ?? null;

    smtp_send($mail, $mail['to'], $subject, $body, $replyTo);
    return true;
}
