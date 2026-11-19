/**
 * NYSC Camp Verification Portal - Email Dispatch Engine
 * Dispatches 6-digit OTP codes via SMTP (using Node.js net/tls sockets)
 * or falls back to development console logging when SMTP is not configured.
 */

import tls from "tls";
import net from "net";

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
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || process.env.ADMIN_EMAIL || "portal@nysc.gov.ng";

  const subject = `[NYSC] Your Verification Code: ${code}`;
  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 540px; margin: 0 auto; background: #0c1a13; color: #f1f5f9; padding: 32px; border-radius: 16px; border: 1px solid #1e382b;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #008751; margin: 0; font-size: 20px; text-transform: uppercase; letter-spacing: 1px;">National Youth Service Corps</h2>
        <p style="color: #94a3b8; font-size: 12px; margin: 4px 0 0 0;">Camp Kit Collection & Document Verification System</p>
      </div>

      <div style="background: #12271c; padding: 24px; border-radius: 12px; border: 1px solid #1e382b; text-align: center;">
        <p style="margin: 0 0 12px 0; font-size: 14px; color: #cbd5e1;">Dear <strong>${recipientName}</strong>,</p>
        <p style="margin: 0 0 20px 0; font-size: 13px; color: #94a3b8;">Your one-time security verification code for the <strong>${role}</strong> portal is:</p>
        
        <div style="background: #0a1811; border: 2px dashed #008751; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
          <span style="font-family: monospace; font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #10b981;">${code}</span>
        </div>

        <p style="margin: 0; font-size: 11px; color: #e2e8f0;">
          This code is valid for <strong>${expiresInMinutes} minutes</strong> and expires automatically.
        </p>
      </div>

      <div style="margin-top: 24px; text-align: center; font-size: 11px; color: #64748b;">
        <p style="margin: 0;">If you did not initiate this verification request, please disregard this email.</p>
        <p style="margin: 6px 0 0 0;">• Service and Humility •</p>
      </div>
    </div>
  `;

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

  // Real SMTP delivery via standard TLS/Socket connection
  try {
    await sendViaSmtpSocket({ host, port, user, pass, from, to, subject, htmlContent });
    console.log(`[NYSC EMAIL DISPATCH] Successfully delivered OTP to ${to} via ${host}:${port}`);
    return { sent: true, method: "smtp" };
  } catch (err: any) {
    console.error(`[NYSC EMAIL DISPATCH ERROR] Failed to send via SMTP:`, err.message);
    return { sent: false, method: "smtp", error: err.message };
  }
}

/**
 * Lightweight native SMTP socket sender (Zero external dependencies)
 */
function sendViaSmtpSocket({
  host,
  port,
  user,
  pass,
  from,
  to,
  subject,
  htmlContent,
}: {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  to: string;
  subject: string;
  htmlContent: string;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const isSecure = port === 465;
    const socket = isSecure ? tls.connect(port, host) : net.connect(port, host);
    socket.setTimeout(12000);

    let stage = 0;
    const authUserB64 = Buffer.from(user).toString("base64");
    const authPassB64 = Buffer.from(pass).toString("base64");

    const message = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset=utf-8`,
      ``,
      htmlContent,
      `.`,
    ].join("\r\n");

    socket.on("data", (chunk) => {
      const resp = chunk.toString();
      const code = parseInt(resp.substring(0, 3), 10);

      if (code >= 400 && stage < 10) {
        socket.destroy();
        return reject(new Error(`SMTP error ${code}: ${resp}`));
      }

      if (stage === 0 && code === 220) {
        stage = 1;
        socket.write(`EHLO nysc.gov.ng\r\n`);
      } else if (stage === 1 && code === 250) {
        stage = 2;
        socket.write(`AUTH LOGIN\r\n`);
      } else if (stage === 2 && code === 334) {
        stage = 3;
        socket.write(`${authUserB64}\r\n`);
      } else if (stage === 3 && code === 334) {
        stage = 4;
        socket.write(`${authPassB64}\r\n`);
      } else if (stage === 4 && (code === 235 || code === 250)) {
        stage = 5;
        socket.write(`MAIL FROM:<${from}>\r\n`);
      } else if (stage === 5 && code === 250) {
        stage = 6;
        socket.write(`RCPT TO:<${to}>\r\n`);
      } else if (stage === 6 && code === 250) {
        stage = 7;
        socket.write(`DATA\r\n`);
      } else if (stage === 7 && code === 354) {
        stage = 8;
        socket.write(`${message}\r\n`);
      } else if (stage === 8 && code === 250) {
        stage = 9;
        socket.write(`QUIT\r\n`);
        socket.end();
        resolve();
      }
    });

    socket.on("error", (err) => {
      reject(err);
    });

    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error("SMTP socket timeout"));
    });
  });
}
