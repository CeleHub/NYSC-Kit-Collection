import { NextRequest, NextResponse } from "next/server";
import {
  verifyOtp,
  checkLockout,
  recordFailedAttempt,
  resetFailedAttempts,
} from "@/lib/auth";
import { getCorpsMemberByStateCode, getSubmission, addAuditLog } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, code, role, stateCode } = body;
    const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";

    if (!email || !code) {
      return NextResponse.json({ success: false, error: "Email and OTP code are required." }, { status: 400 });
    }

    // Check if locked out
    const ipLock = checkLockout(ip);
    if (ipLock.locked) {
      return NextResponse.json(
        {
          success: false,
          error: `IP address locked out. Try again in ${Math.ceil(ipLock.remainingSeconds / 60)} minutes.`,
        },
        { status: 429 }
      );
    }

    const emailLock = checkLockout(email);
    if (emailLock.locked) {
      return NextResponse.json(
        {
          success: false,
          error: `Email locked out for 2 hours due to 5 consecutive failed attempts. Try again in ${Math.ceil(
            emailLock.remainingSeconds / 60
          )} minutes.`,
        },
        { status: 429 }
      );
    }

    // Verify OTP
    const verification = verifyOtp(email, code);

    if (!verification.success) {
      // Record failed attempt
      const attemptResult = recordFailedAttempt(ip, email);

      if (attemptResult.locked) {
        await addAuditLog(
          email,
          "ACCOUNT_LOCKOUT",
          `5 failed OTP attempts. IP and Email locked for 2 hours.`
        );
        return NextResponse.json(
          {
            success: false,
            locked: true,
            error:
              "Too many failed verification attempts (5/5). Your IP address and account have been locked for 2 hours.",
          },
          { status: 429 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          remainingAttempts: attemptResult.remainingAttempts,
          error: `Invalid verification code. You have ${attemptResult.remainingAttempts} attempt(s) remaining before a 2-hour lockout.`,
        },
        { status: 401 }
      );
    }

    // Success! Reset failed attempts
    resetFailedAttempts(ip, email);

    const otpEntry = verification.entry;
    const finalRole = otpEntry?.role || role;
    const resolvedPlatoon = otpEntry?.platoon;

    // If Corps Member, load full profile and submission
    let corperData = null;
    let submissionData = null;

      if (finalRole === "CORPS_MEMBER" && (stateCode || otpEntry?.stateCode)) {
        const sc = stateCode || otpEntry?.stateCode;
        corperData = await getCorpsMemberByStateCode(sc!);
        submissionData = await getSubmission(sc!);
      }

      await addAuditLog(email, "LOGIN_SUCCESS", `Logged in as ${finalRole}${resolvedPlatoon ? ` (Platoon ${resolvedPlatoon})` : ""}`);

      return NextResponse.json({
        success: true,
        role: finalRole,
        email,
        stateCode: stateCode || otpEntry?.stateCode,
        platoon: resolvedPlatoon,
        corpsMember: corperData,
        submission: submissionData,
      });
    } catch (error: any) {
      console.error("verify-otp error:", error);
      return NextResponse.json({ success: false, error: error.message || "Verification failed." }, { status: 500 });
    }
  }
