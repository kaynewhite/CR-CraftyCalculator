const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendOtpEmail(toEmail, toName, otp) {
  await transporter.sendMail({
    from: `"Crafty Rachel" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: 'Your Crafty Rachel Verification Code',
    html: `
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

module.exports = { sendOtpEmail };
