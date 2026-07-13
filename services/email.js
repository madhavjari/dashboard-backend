const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND_API_KEY);

async function sendVerificationEmail(email, token) {
  const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${token}`;
  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: "New Sign-up, Verify your email",
    html: `<h2>Welcome!</h2>

      <p>Click the button below to verify your email.</p>

      <p>
        <a href="${verificationUrl}">
          Verify Email
        </a>
      </p>

      <p>This link expires in 1 hour.</p>`,
  });
  if (error) {
    throw error;
  }
  return data;
}

module.exports = sendVerificationEmail;
