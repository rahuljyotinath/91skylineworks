<?php
/**
 * Copy this file to config.php on the server and fill in credentials.
 * Do NOT commit config.php — it contains secrets.
 */
return [
    'db_host' => 'localhost',
    'db_name' => 'your_cpanel_db_name',
    'db_user' => 'your_cpanel_db_user',
    'db_pass' => 'your_cpanel_db_password',
    'uploads_dir' => dirname(__DIR__) . '/uploads',
    'max_upload_bytes' => 12 * 1024 * 1024,

    // Lead notification email (SMTP)
    'mail_to' => 'contact@91skylineworks.com',
    'mail_from' => 'website@91skylineworks.com',
    'mail_from_name' => '91SkylineWorks Website',
    'smtp_host' => 'mail.91skylineworks.com',
    'smtp_port' => 587,
    'smtp_user' => 'website@91skylineworks.com',
    'smtp_pass' => 'your_smtp_password_here',

    // Preferred for outbound lead mail (works when MilesWeb SMTP is dead). From Resend dashboard.
    'resend_api_key' => '',

    // One-time content import via /api/import-content.php?token=... (delete after use)
    'content_import_token' => '',
];
