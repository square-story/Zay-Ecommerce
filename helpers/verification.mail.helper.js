import { sendEmailViaBrevo } from "./send.email.brevo.helper.js";

export const sendVerificationEmail = async (user, token) => {
  const htmlContent = `
      <p>Click on the link below to verify your account:</p>
      <a href="${process.env.PROJECT_URL}/change-password/${user._id}/${token}">Verify Account</a>
    `;

  await sendEmailViaBrevo(user.email, 'Account Verification', htmlContent);
}