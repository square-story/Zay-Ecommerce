export const sendEmailViaBrevo = async (toEmail, subject, htmlContent) => {
    try {
        const response = await axios.post(
            'https://api.brevo.com/v3/smtp/email',
            {
                sender: { email: process.env.SMTP_USER },
                to: [{ email: toEmail }],
                subject: subject,
                htmlContent: htmlContent,
            },
            {
                headers: {
                    'api-key': process.env.BREVO_API_KEY,
                    'Content-Type': 'application/json',
                    'accept': 'application/json',
                },
            }
        );
        console.log('Email sent successfully via Brevo API:', response.data);
        return true;
    } catch (error) {
        console.error('Error sending email via Brevo API:', error.response ? error.response.data : error.message);
        return false;
    }
};