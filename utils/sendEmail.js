import nodemailer from 'nodemailer';

/**
 * Sends an email using Nodemailer with Gmail App Password.
 * Requires env vars: EMAIL, APP_PASSWORD
 * Falls back to console logging in development when credentials are absent.
 */
const sendEmail = async ({ to, subject, html }) => {
  const { EMAIL, APP_PASSWORD } = process.env;

  if (!EMAIL || !APP_PASSWORD) {
    // Dev fallback — log to console so reset links are still testable locally
    console.log('\n====================================');
    console.log('[DEV EMAIL — no SMTP credentials set]');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log('Body (HTML stripped):', html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
    console.log('====================================\n');
    return;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: EMAIL,
      pass: APP_PASSWORD, // Gmail App Password (not account password)
    },
  });

  await transporter.sendMail({
    from: `"Odisha Influencer Market" <${EMAIL}>`,
    to,
    subject,
    html,
  });
};

export default sendEmail;
