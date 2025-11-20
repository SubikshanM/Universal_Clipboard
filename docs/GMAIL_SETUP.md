# Gmail SMTP Configuration Guide

## Overview
This project now sends OTP emails directly from the backend using nodemailer with Gmail SMTP. The outbox pattern has been restored for internal backend architecture.

## Required Environment Variables

Add these to your Render environment variables (or `.env` file for local development):

```env
# Gmail SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-gmail-address@gmail.com
SMTP_PASS=your-app-password-here
EMAIL_FROM=Universal Clipboard <your-gmail-address@gmail.com>

# Optional: Enable debug mode for development
DEBUG_EMAIL_MODE=false

# OTP Settings (already configured)
OTP_EXPIRATION_MINUTES=10
OTP_RATE_LIMIT_PER_HOUR=5
```

## Getting Gmail App Password

1. **Enable 2-Factor Authentication** (required):
   - Go to https://myaccount.google.com/security
   - Enable 2-Step Verification if not already enabled

2. **Generate App Password**:
   - Go to https://myaccount.google.com/apppasswords
   - Select "Mail" as the app
   - Select "Other" as the device and name it "Universal Clipboard"
   - Click "Generate"
   - Copy the 16-character password (no spaces)

3. **Add to Render**:
   - Go to your Render dashboard
   - Navigate to your backend service
   - Go to "Environment" tab
   - Add the environment variables listed above
   - Use the app password as `SMTP_PASS`
   - Save changes and redeploy

## Architecture Changes

### New Components Added:

1. **Database Table**: `signup_otp_outbox`
   - Stores plaintext OTPs temporarily for internal backend retrieval
   - Columns: id, email, otp_plain, expires_at, consumed, created_at
   - Cleaned automatically by TTL worker

2. **New Route**: `POST /api/auth/signup-otp`
   - Generates OTP and writes to both `signup_otps` (hashed) and `signup_otp_outbox` (plaintext)
   - Sends email directly via `sendOtpEmail` function
   - Rate-limited (5 requests per hour per email)

3. **Restored Endpoint**: `POST /api/auth/outbox-fetch`
   - Internal endpoint for retrieving plaintext OTPs from outbox
   - Marks OTP as consumed after retrieval
   - Returns 404 if no unexpired OTP found

4. **TTL Worker Enhancement**:
   - Now cleans both clipboard_data and signup_otp_outbox tables
   - Removes expired OTPs and old consumed entries (>1 hour old)
   - Runs every 60 seconds by default

5. **Enhanced Email Template**:
   - Professional HTML email with styled OTP display
   - 32px bold blue OTP code centered in gray background box
   - Responsive design with mobile support
   - Shows expiration time dynamically

## Existing Routes (Unchanged)

- `POST /api/auth/request-signup-otp` - Original OTP request endpoint (still works)
- `POST /api/auth/verify-signup-otp` - Verifies OTP and creates user account
- `POST /api/auth/send-otp` - Lightweight OTP generation (no password)
- `POST /api/auth/login` - User authentication
- `POST /api/auth/signup` - Direct signup (no OTP)

## Testing

### Local Testing:
```bash
# Set DEBUG_EMAIL_MODE to see OTPs in console
DEBUG_EMAIL_MODE=true npm start

# Test signup-otp endpoint
curl -X POST http://localhost:3000/api/auth/signup-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'

# Check outbox-fetch
curl -X POST http://localhost:3000/api/auth/outbox-fetch \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

### Production Testing:
1. Configure Gmail credentials in Render
2. Redeploy the service
3. Watch logs for "OTP email sent to..." messages
4. Test frontend signup flow

## Troubleshooting

### "Authentication failed" error:
- Verify 2FA is enabled on your Google account
- Ensure you're using an App Password, not your regular Gmail password
- Check that SMTP_USER matches the Gmail account generating the App Password

### Emails not sending:
- Check Render logs for error messages
- Verify all SMTP_* environment variables are set
- Enable DEBUG_EMAIL_MODE temporarily to log OTPs in console
- Ensure your Gmail account isn't locked or flagged

### Rate limiting issues:
- Adjust OTP_RATE_LIMIT_PER_HOUR if needed (default: 5)
- Check signup_otps table for stuck entries
- Monitor TTL worker logs for cleanup operations

## Security Notes

- App passwords are safer than regular passwords for SMTP
- Never commit credentials to git
- Use environment variables for all sensitive data
- The outbox pattern is internal-only (not exposed to frontend)
- OTPs are hashed in signup_otps table, plaintext only in temporary outbox
- TTL worker cleans outbox automatically
