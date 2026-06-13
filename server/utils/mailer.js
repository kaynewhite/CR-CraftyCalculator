const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;

async function sendWithRetry(payload) {
  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(BREVO_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': process.env.BREVO_API_KEY,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) return;

      const errorBody = await response.text();

      if (response.status >= 400 && response.status < 500) {
        throw new Error(`Brevo API error (${response.status}): ${errorBody}`);
      }

      lastError = new Error(`Brevo API error (${response.status}): ${errorBody}`);
    } catch (err) {
      if (err.message.startsWith('Brevo API error (4')) throw err;
      lastError = err;
    }

    if (attempt < MAX_RETRIES) {
      const delay = BASE_DELAY_MS * 2 ** (attempt - 1);
      console.warn(`[Mailer] Attempt ${attempt} failed — retrying in ${delay}ms. ${lastError.message}`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error(`[Mailer] All ${MAX_RETRIES} attempts failed. Last error: ${lastError.message}`);
}

async function sendOtpEmail(toEmail, toName, otp) {
  await sendWithRetry({
    sender: { name: 'Crafty Rachel', email: process.env.SMTP_FROM },
    to: [{ email: toEmail, name: toName }],
    subject: 'Your Crafty Rachel Verification Code',
    htmlContent: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#fff;border-radius:12px;border:1px solid #eee;">
        <div style="text-align:center;margin-bottom:24px;">
          <h2 style="color:#e91e8c;margin:0;">Crafty Rachel</h2>
        </div>
        <p style="color:#333;font-size:15px;">Hi <strong>${toName}</strong>,</p>
        <p style="color:#555;font-size:14px;">Use the verification code below to complete your account sign-up. This code expires in <strong>10 minutes</strong>.</p>
        <div style="text-align:center;margin:28px 0;">
          <span style="display:inline-block;background:#fce4ec;color:#e91e8c;font-size:36px;font-weight:700;letter-spacing:10px;padding:16px 32px;border-radius:10px;border:2px dashed #e91e8c;">${otp}</span>
        </div>
        <p style="color:#888;font-size:12px;text-align:center;">If you did not sign up for Crafty Rachel, you can safely ignore this email.</p>
      </div>
    `,
  });
}

async function sendResetEmail(toEmail, toName, resetLink) {
  await sendWithRetry({
    sender: { name: 'Crafty Rachel', email: process.env.SMTP_FROM },
    to: [{ email: toEmail, name: toName }],
    subject: 'Reset Your Crafty Rachel Password',
    htmlContent: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#fff;border-radius:12px;border:1px solid #eee;">
        <div style="text-align:center;margin-bottom:24px;">
          <h2 style="color:#e91e8c;margin:0;">Crafty Rachel</h2>
        </div>
        <p style="color:#333;font-size:15px;">Hi <strong>${toName}</strong>,</p>
        <p style="color:#555;font-size:14px;">We received a request to reset the password for your account. Click the button below to set a new password. This link expires in <strong>24 hours</strong>.</p>
        <div style="text-align:center;margin:28px 0;">
          <a href="${resetLink}" style="display:inline-block;background:#e91e8c;color:#fff;font-size:15px;font-weight:700;padding:14px 32px;border-radius:10px;text-decoration:none;">Reset My Password</a>
        </div>
        <p style="color:#555;font-size:13px;">Or copy and paste this link into your browser:</p>
        <p style="color:#e91e8c;font-size:12px;word-break:break-all;">${resetLink}</p>
        <p style="color:#888;font-size:12px;text-align:center;margin-top:24px;">If you did not request a password reset, you can safely ignore this email.</p>
      </div>
    `,
  });
}

module.exports = { sendOtpEmail, sendResetEmail };
