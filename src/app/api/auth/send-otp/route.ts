import { NextRequest, NextResponse } from "next/server";
import {
  getCorpsMemberByStateCode,
  getPlatoons,
  getSecretariat,
  addAuditLog,
} from "@/lib/db";
import {
  generateOtp,
  checkLockout,
  maskEmail,
} from "@/lib/auth";
import { sendOtpEmail } from "@/lib/mailer";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { role, stateCode, email: rawInputEmail } = body;
    const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
    const inputEmail = rawInputEmail ? String(rawInputEmail).trim().toLowerCase() : "";

    let targetEmail = "";
    let recipientName = "";
    let metadata: { stateCode?: string; platoon?: number; fullName?: string } = {};

    // 1. CORPS MEMBER
    if (role === "CORPS_MEMBER") {
      if (!stateCode) {
        return NextResponse.json({ success: false, error: "State code is required." }, { status: 400 });
      }

      const cm = await getCorpsMemberByStateCode(stateCode);
      if (!cm) {
        return NextResponse.json(
          {
            success: false,
            error: "State Code not found in Camp Nominal Roll. Please double-check your deployment slip.",
          },
          { status: 404 }
        );
      }

      targetEmail = cm.email;
      recipientName = cm.full_name;
      metadata = {
        stateCode: cm.state_code,
        platoon: cm.platoon,
        fullName: cm.full_name,
      };
      }
      // 2. PLATOON INSPECTOR (Email lookup flow)
      else if (role === "PLATOON_INSPECTOR") {
        if (!inputEmail) {
          return NextResponse.json(
            { success: false, error: "Please enter your assigned Platoon Inspector email." },
            { status: 400 }
          );
        }

          const allPlatoons = await getPlatoons();
          // Find matching platoon by email
          const matchedPlatoonKey = Object.keys(allPlatoons).find(
            (key) => (allPlatoons[key].email || "").trim().toLowerCase() === inputEmail
          );

          if (!matchedPlatoonKey) {
            return NextResponse.json(
              {
                success: false,
                error: "This email address is not registered for any platoon. Please contact the Camp Admin to configure your email.",
              },
              { status: 404 }
            );
          }

          const pAccount = allPlatoons[matchedPlatoonKey];
          if (!pAccount.active) {
            return NextResponse.json(
              {
                success: false,
                error: `Platoon ${pAccount.platoon} Inspector access has been suspended by the Camp Admin. Please report to the Secretariat.`,
              },
              { status: 403 }
            );
          }

          targetEmail = pAccount.email;
          recipientName = pAccount.name || `Platoon ${pAccount.platoon} Inspector`;
          metadata = {
            platoon: Number(pAccount.platoon),
            fullName: pAccount.name,
          };
        }
        // 3. SECRETARIAT (Email lookup flow)
        else if (role === "SECRETARIAT") {
          if (!inputEmail) {
            return NextResponse.json(
              { success: false, error: "Please enter your Secretariat official email address." },
              { status: 400 }
            );
          }

          const sec = await getSecretariat();
            if (!sec || (sec.email || "").trim().toLowerCase() !== inputEmail) {
              return NextResponse.json(
                {
                  success: false,
                  error: "This email address is not authorized for the Camp Secretariat. Please contact the Camp Admin to configure your email.",
                },
                { status: 404 }
              );
            }

            if (!sec.active) {
              return NextResponse.json(
                { success: false, error: "Camp Secretariat portal is currently disabled by Camp Admin." },
                { status: 403 }
              );
            }

            targetEmail = sec.email;
            recipientName = sec.officer_name || "Camp Director / Secretariat";
            metadata = { fullName: sec.officer_name };
          }
          // 4. CAMP ADMIN
          else if (role === "ADMIN") {
            if (!inputEmail) {
              return NextResponse.json(
                { success: false, error: "Please enter your Camp Admin email address." },
                { status: 400 }
              );
            }

            const configuredAdminEmail = (process.env.ADMIN_EMAIL || "admin@nysc.gov.ng").trim().toLowerCase();
            if (inputEmail !== configuredAdminEmail) {
              return NextResponse.json(
                {
                  success: false,
                  error: "Unauthorized email. This email does not match the configured Camp Administrator account.",
                },
                { status: 403 }
              );
            }

            targetEmail = configuredAdminEmail;
            recipientName = process.env.ADMIN_NAME || "Camp Commandant / Director";
            metadata = { fullName: recipientName };
          } else {
            return NextResponse.json({ success: false, error: "Invalid role specified." }, { status: 400 });
          }

          // Check Lockout on IP and Target Email
          const ipLock = checkLockout(ip);
          if (ipLock.locked) {
            return NextResponse.json(
              {
                success: false,
                  error: `Access temporarily blocked due to 5 consecutive failed attempts. Please try again in ${Math.ceil(
                    ipLock.remainingSeconds / 60
                  )} minutes.`,
        },
        { status: 429 }
      );
    }

    const emailLock = checkLockout(targetEmail);
    if (emailLock.locked) {
      return NextResponse.json(
        {
          success: false,
                error: `This account is locked for 2 hours due to 5 failed verification attempts. Remaining lockout: ${Math.ceil(
                  emailLock.remainingSeconds / 60
                )} minutes.`,
        },
              { status: 429 }
            );
          }

          // Generate 6-digit OTP (5-minute TTL)
          const { code, expiresAt } = generateOtp(targetEmail, role, metadata);

          // Send OTP via SMTP or Dev Console
          await sendOtpEmail({
            to: targetEmail,
            recipientName,
            role: role.replace("_", " "),
            code,
            expiresInMinutes: 5,
          });

          await addAuditLog(
            metadata.fullName || role,
            "OTP_REQUESTED",
              `OTP requested for ${maskEmail(targetEmail)} (${role})`
          );

          return NextResponse.json({
            success: true,
            email: targetEmail,
            maskedEmail: maskEmail(targetEmail),
            expiresAt,
            metadata,
            devOtp: code,
          });
        } catch (error: any) {
          console.error("send-otp error:", error);
          return NextResponse.json({ success: false, error: error.message || "Failed to send OTP." }, { status: 500 });
        }
      }
