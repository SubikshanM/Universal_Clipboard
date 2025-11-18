# n8n Integration — OTP email sending

This project supports a lightweight integration with n8n to have n8n send signup OTP emails instead of the backend sending them directly. The backend writes a short-lived plaintext OTP into a secure outbox table; n8n can fetch that OTP and send an email using the provider of your choice (SMTP, SendGrid, SES, etc.).

Important security notes
- The outbox contains plaintext OTPs for a very short time. Protect access with an API key.
- The backend endpoint that returns the OTP is `POST /api/auth/outbox-fetch` and requires header `x-internal-api-key: <INTERNAL_API_KEY>`.
- Set `INTERNAL_API_KEY` in your backend environment to a strong secret.

Required backend env vars
- `INTERNAL_API_KEY` — a strong random string available to n8n (store as credential in n8n).

How it works
1. Frontend calls `POST /api/auth/request-signup-otp` as before.
2. Backend generates an OTP and writes a hashed entry into `signup_otps` (for verification) and a plaintext row into `signup_otp_outbox` with `expires_at`.
3. n8n polls or is triggered and calls `POST /api/auth/outbox-fetch` with the target email and the internal API key. The endpoint returns `{ otp, expires_at }` and marks the outbox entry consumed.
	 - If you're using the hosted backend, the full endpoint is:

		 `https://universal-clipboard-q6po.onrender.com/api/auth/outbox-fetch`

		 The request must include header `x-internal-api-key: <INTERNAL_API_KEY>` and body `{ "email": "user@example.com" }`.
4. n8n composes and sends the email with the OTP using your preferred mailing node.

Recommended n8n workflow (import JSON provided alongside this doc)
- Use the provided `docs/n8n_signup_otp_workflow.json` as a starting point. Import into n8n and update the HTTP Request node and Email node credentials.

Security & housekeeping
- The TTL worker deletes expired outbox entries automatically.
- Consider limiting network access to the backend outbox endpoint (VPC, firewall) and rotate `INTERNAL_API_KEY` if needed.

- Hosted backend — quick test

To call the hosted backend's outbox endpoint directly (simulate n8n), run:

```bash
curl -X POST https://universal-clipboard-q6po.onrender.com/api/auth/outbox-fetch \
	-H "Content-Type: application/json" \
	-H "x-internal-api-key: a-strong-random-string" \
	-d '{"email":"user@example.com"}'
# Response: { "otp": "123456", "expires_at": "2025-11-17T..." }
```

Troubleshooting
- If `outbox-fetch` returns 404, either the OTP expired or was already consumed.
- If the backend logs show `Failed to write OTP to outbox`, check DB migrations and that the `signup_otp_outbox` table exists (server recreates tables on startup).

Contact
- If you want a push-based flow (backend calls a webhook on OTP creation instead of poll), we can add an outgoing webhook with retries.
