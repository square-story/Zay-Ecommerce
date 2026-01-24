import { sendEmailViaBrevo } from "./send.email.brevo.helper.js";
import verifyOtp from '../models/otp.verification.model.js';

export const sentOtp = async (email) => {
    try {
        console.log('Sending OTP via Brevo API...');
        const createdOTP = `${Math.floor(1000 + Math.random() * 9000)}`;
        const htmlContent = `<p>Your otp is ${createdOTP}</p>`;

        await sendEmailViaBrevo(email, 'OTP Verification', htmlContent);

        const hashOTP = await bcrypt.hash(createdOTP, 10);
        const otp = new verifyOtp({
            Email: email,
            otp: hashOTP,
        });

        await otp.save();
    } catch (error) {
        console.log(error);
    }
};