import { NextRequest, NextResponse } from "next/server";
import { getNominalRoll, getSubmissions, getSecretariat } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const sec = await getSecretariat();
    if (!sec || !sec.active) {
      return NextResponse.json(
        { success: false, error: "Secretariat portal access is currently suspended." },
        { status: 403 }
      );
    }

    const nominalRoll = await getNominalRoll();
    const submissions = await getSubmissions();

    const exeatQueue: any[] = [];

    for (const cm of nominalRoll) {
      const sub = submissions[cm.state_code.trim().toUpperCase()];
      if (sub && sub.exeat && sub.exeat.status !== "NONE") {
        exeatQueue.push({
          corpsMember: cm,
          submission: sub,
          exeat: sub.exeat,
          kitCollected: sub.kit_status === "KIT_DISBURSED",
        });
      }
    }

    // Sort: pending first, then by requestedAt
    exeatQueue.sort((a, b) => {
      if (a.exeat.status === "PENDING_SECRETARIAT" && b.exeat.status !== "PENDING_SECRETARIAT") return -1;
      if (b.exeat.status === "PENDING_SECRETARIAT" && a.exeat.status !== "PENDING_SECRETARIAT") return 1;
      return new Date(b.exeat.requestedAt || 0).getTime() - new Date(a.exeat.requestedAt || 0).getTime();
    });

    return NextResponse.json({
      success: true,
      secretariat: sec,
      stats: {
        totalRequests: exeatQueue.length,
        pendingCount: exeatQueue.filter((x) => x.exeat.status === "PENDING_SECRETARIAT").length,
        deliveredCount: exeatQueue.filter((x) => x.exeat.status === "DELIVERED").length,
        rejectedCount: exeatQueue.filter((x) => x.exeat.status === "REJECTED").length,
      },
      queue: exeatQueue,
    });
  } catch (error: any) {
    console.error("secretariat queue error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
