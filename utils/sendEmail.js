import nodemailer from 'nodemailer';

const sendEmail = async ({ to, subject, html, text }) => {
  const { EMAIL, APP_PASSWORD } = process.env;

  if (!EMAIL || !APP_PASSWORD) {
    console.log(`[DEV EMAIL] To: ${to} | Subject: ${subject}`);
    return;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: EMAIL, pass: APP_PASSWORD },
  });

  return await transporter.sendMail({
    from: `"Odisha Influencer Market" <${EMAIL}>`,
    to,
    subject,
    text: text || html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
    html,
  });
};

export default sendEmail;
