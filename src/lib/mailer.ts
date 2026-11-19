/**
 * NYSC Camp Verification Portal - Email Dispatch Engine
 * Dispatches 6-digit OTP codes via Nodemailer (Gmail / Custom SMTP)
 * or falls back to development console logging when SMTP is not configured.
 */

import nodemailer from "nodemailer";

interface SendOtpEmailOptions {
  to: string;
  recipientName: string;
  role: string;
  code: string;
  expiresInMinutes?: number;
}

export async function sendOtpEmail({
  to,
  recipientName,
  role,
  code,
  expiresInMinutes = 5,
}: SendOtpEmailOptions): Promise<{ sent: boolean; method: "smtp" | "console"; error?: string }> {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "465", 10);
  const user = process.env.SMTP_USER;
  const rawPass = process.env.SMTP_PASS;
  const pass = rawPass ? rawPass.replace(/\s+/g, "") : "";
  const from =
    process.env.SMTP_FROM ||
    (user ? `"NYSC Camp Verification" <${user}>` : `"NYSC Portal" <portal@nysc.gov.ng>`);

  // If SMTP is not configured, log to server console
  if (!host || !user || !pass) {
    console.log(`\n========================================================`);
    console.log(`[NYSC EMAIL DISPATCH - CONSOLE FALLBACK]`);
    console.log(`To: ${to} (${recipientName})`);
    console.log(`Role: ${role}`);
    console.log(`OTP Code: ${code}`);
    console.log(`Expires: in ${expiresInMinutes} minutes`);
    console.log(`========================================================\n`);
    return { sent: true, method: "console" };
  }

  const subject = `[NYSC] Your Verification Security Code: ${code}`;
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>NYSC Verification OTP</title>
    </head>
    <body style="margin: 0; padding: 24px; background-color: #05140b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc;">
      <div style="max-width: 520px; margin: 0 auto; background: #0c1f13; border: 1px solid #194a2b; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
        
        <!-- Header Banner -->
        <div style="background: linear-gradient(135deg, #008751 0%, #004d2c 100%); padding: 28px 24px; text-align: center; border-bottom: 2px solid #00a862;">
          <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase;">
            National Youth Service Corps
          </h1>
          <p style="margin: 6px 0 0 0; color: #dcfce7; font-size: 13px; font-weight: 500;">
            Orientation Camp Kit Collection & Document Verification
          </p>
        </div>

        <!-- Body Content -->
        <div style="padding: 32px 24px;">
          <p style="margin: 0 0 12px 0; font-size: 15px; color: #e2e8f0;">
            Dear <strong style="color: #ffffff;">${recipientName}</strong>,
          </p>
          <p style="margin: 0 0 24px 0; font-size: 14px; color: #94a3b8; line-height: 1.5;">
            You requested a one-time verification security code to access the 
            <strong style="color: #22c55e;">${role}</strong> portal.
          </p>

          <!-- OTP Code Box -->
          <div style="background: #06150c; border: 2px dashed #008751; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
            <div style="font-size: 11px; font-weight: 700; color: #86efac; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 8px;">
              Single-Use Security OTP
            </div>
            <div style="font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 900; letter-spacing: 8px; color: #22c55e;">
              ${code}
            </div>
            <div style="font-size: 12px; color: #94a3b8; margin-top: 8px;">
              Valid for <strong style="color: #f8fafc;">${expiresInMinutes} minutes</strong>
            </div>
          </div>

          <!-- Security Notice -->
          <div style="background: rgba(239, 68, 68, 0.1); border-left: 4px solid #ef4444; padding: 12px 16px; border-radius: 6px; margin-bottom: 24px;">
            <p style="margin: 0; font-size: 12px; color: #fca5a5; line-height: 1.4;">
              <strong>Security Alert:</strong> Never share this code with anyone. Official NYSC staff or administrators will never ask for your one-time code.
            </p>
          </div>

          <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.4;">
            If you did not initiate this login or document verification request, you can safely ignore this email.
          </p>
        </div>

        <!-- Footer -->
        <div style="background: #07130a; border-top: 1px solid #143520; padding: 20px 24px; text-align: center; font-size: 12px; color: #64748b;">
          <p style="margin: 0; font-weight: 600; color: #94a3b8; letter-spacing: 1px;">
            SERVICE AND HUMILITY
          </p>
          <p style="margin: 4px 0 0 0; font-size: 11px;">
            National Youth Service Corps Directorate Headquarters, Abuja, Nigeria.
          </p>
        </div>

      </div>
    </body>
    </html>
  `;

  try {
    const isSecure = port === 465;
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: isSecure,
      auth: {
        user,
        pass,
      },
      connectionTimeout: 12000,
      greetingTimeout: 8000,
      socketTimeout: 15000,
    });

    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text: `National Youth Service Corps\nYour verification code is: ${code}\nValid for ${expiresInMinutes} minutes.`,
      html: htmlContent,
    });

    console.log(`[NYSC EMAIL DISPATCH SUCCESS] Delivered OTP to ${to} (Message ID: ${info.messageId})`);
    return { sent: true, method: "smtp" };
  } catch (err: any) {
    console.error(`[NYSC EMAIL DISPATCH ERROR] Failed to send via SMTP:`, err.message);
    return { sent: false, method: "smtp", error: err.message };
  }
}
