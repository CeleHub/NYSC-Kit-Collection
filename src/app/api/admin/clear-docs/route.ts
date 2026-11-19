import { NextRequest, NextResponse } from "next/server";
import { clearAllUploadedDocuments, addAuditLog } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const result = await clearAllUploadedDocuments();

    await addAuditLog(
      "Camp Admin",
      "ALL_DOCUMENTS_CLEARED",
      "Cleared all uploaded document files and reset kit statuses. Nominal roll, platoons, and emails preserved."
    );

    return NextResponse.json({
      success: true,
      message: "All uploaded documents and kit statuses have been cleared successfully. Nominal roll and email accounts remain completely preserved.",
      clearedCount: result.clearedCount,
    });
  } catch (error: any) {
    console.error("clear-docs error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to clear documents." },
      { status: 500 }
    );
  }
}
