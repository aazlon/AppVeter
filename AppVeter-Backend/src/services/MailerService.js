const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const sendResetCode = async (email, code) => {
    const mailOptions = {
        from: `"AppVeter" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Código de recuperación de contraseña',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h2 style="color: #2c5a94;">Recuperación de Contraseña</h2>
                </div>
                <p style="font-size: 16px; color: #333;">Hemos recibido una solicitud para restablecer tu contraseña.</p>
                <p style="font-size: 16px; color: #333;">Tu código de verificación es:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #2c5a94; background: #e8f1f8; padding: 15px 30px; border-radius: 8px; display: inline-block;">${code}</span>
                </div>
                <p style="font-size: 14px; color: #888;">Este código expirará en 5 minutos.</p>
                <p style="font-size: 14px; color: #888;">Si no solicitaste este cambio, ignora este mensaje.</p>
                <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
                <p style="font-size: 12px; color: #aaa; text-align: center;">AppVeter - Pets Products 2022 C.A</p>
            </div>
        `
    };

    await transporter.sendMail(mailOptions);
};

module.exports = { sendResetCode };
