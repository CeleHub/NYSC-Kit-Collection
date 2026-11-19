import { NextRequest, NextResponse } from "next/server";
import { getNominalRoll, getSubmissions, getPlatoon } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const platoonParam = searchParams.get("platoon");

    if (!platoonParam) {
      return NextResponse.json({ success: false, error: "Platoon parameter required." }, { status: 400 });
    }

    const platoon = parseInt(platoonParam, 10);
    const platoonAccount = await getPlatoon(platoon);
    if (!platoonAccount || !platoonAccount.active) {
      return NextResponse.json(
        { success: false, error: "Platoon Inspector access is inactive or suspended by Camp Admin." },
        { status: 403 }
      );
    }

    const nominalRoll = await getNominalRoll();
    const submissions = await getSubmissions();

    // Filter by platoon
    const platoonMembers = nominalRoll.filter((cm) => cm.platoon === platoon);

    const ready: any[] = [];
    const incomplete: any[] = [];
    const disbursed: any[] = [];

    for (const cm of platoonMembers) {
      const sub = submissions[cm.state_code.trim().toUpperCase()] || {
        state_code: cm.state_code,
        kit_status: "INCOMPLETE",
        documents: {},
        exeat: { status: "NONE", unlockedByPi: false },
      };

      const item = {
        ...cm,
        submission: sub,
      };

      if (sub.kit_status === "KIT_DISBURSED") {
        disbursed.push(item);
      } else if (sub.kit_status === "READY_FOR_KIT") {
        ready.push(item);
      } else {
        incomplete.push(item);
      }
    }

    return NextResponse.json({
      success: true,
      platoon,
      inspector: platoonAccount,
      stats: {
        total: platoonMembers.length,
        readyCount: ready.length,
        incompleteCount: incomplete.length,
        disbursedCount: disbursed.length,
      },
      ready,
      incomplete,
      disbursed,
    });
  } catch (error: any) {
    console.error("inspector queue error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
