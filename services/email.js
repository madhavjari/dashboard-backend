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

async function sendPasswordResetEmail(email, token) {
  const resetUrl = `${process.env.CLIENT_URL}/password-reset?token=${token}`;
  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: "Reset your password",
    html: `
      <h2>Password Reset</h2>
      <p>Click the link below to reset your password:</p>
      <a href="${resetUrl}">Reset Password</a>
      <p>This link expires in 30 minutes.</p>
    `,
  });
  if (error) {
    throw error;
  }
  return data;
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
