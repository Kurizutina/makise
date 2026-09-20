<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset your Otu-Zan password</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f4f7; font-family: Arial, Helvetica, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7; padding:32px 16px;">
        <tr>
            <td align="center">
                <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:8px; overflow:hidden;">
                    <tr>
                        <td style="background-color:#e0393b; padding:24px 32px;">
                            <span style="color:#ffffff; font-size:20px; font-weight:bold;">Otu-Zan</span>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:32px;">
                            <h1 style="margin:0 0 16px; font-size:20px; color:#222222;">Reset your password</h1>
                            <p style="margin:0 0 16px; font-size:15px; line-height:1.5; color:#444444;">
                                We received a request to reset the password for your Otu-Zan account. Click the button below to choose a new password.
                            </p>
                            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
                                <tr>
                                    <td style="border-radius:6px; background-color:#e0393b;">
                                        <a href="{{ $resetUrl }}" target="_blank" style="display:inline-block; padding:12px 28px; font-size:15px; font-weight:bold; color:#ffffff; text-decoration:none; border-radius:6px;">
                                            Reset Password
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            <p style="margin:0 0 8px; font-size:13px; line-height:1.5; color:#777777;">
                                This link will expire in 60 minutes. If the button above doesn't work, copy and paste this link into your browser:
                            </p>
                            <p style="margin:0 0 16px; font-size:13px; word-break:break-all;">
                                <a href="{{ $resetUrl }}" style="color:#e0393b;">{{ $resetUrl }}</a>
                            </p>
                            <p style="margin:24px 0 0; font-size:13px; line-height:1.5; color:#999999;">
                                If you didn't request a password reset, you can safely ignore this email — your password will not be changed.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:20px 32px; background-color:#f4f4f7;">
                            <p style="margin:0; font-size:12px; color:#aaaaaa;">&copy; {{ date('Y') }} Otu-Zan. All rights reserved.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
