import { NextRequest, NextResponse } from "next/server";
import { getCorpsMemberByStateCode, getSubmission, updateSubmission, addAuditLog } from "@/lib/db";
import { classifyDocument, checkPassportCompliance } from "@/lib/classifier";
import { DocumentKey, UploadStatus } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      stateCode,
      documentKey,
      fileName,
      fileUrl,
      pdfUrl,
      extractedText = "",
      fileSizeBytes = 250000,
      imageWidth = 800,
      imageHeight = 1000,
      isBlurry = false,
      blurScore = 85,
    } = body;

    if (!stateCode || !documentKey) {
      return NextResponse.json({ success: false, error: "Missing required parameters." }, { status: 400 });
    }

    const cm = await getCorpsMemberByStateCode(stateCode);
    if (!cm) {
      return NextResponse.json({ success: false, error: "Corps Member not found." }, { status: 404 });
    }

    const submission = await getSubmission(stateCode);
    const existingDoc = submission.documents[documentKey];

    // Immutability Rule: If already submitted and verified/approved, cannot edit unless unlocked by PI
    if (
      existingDoc &&
      (existingDoc.status === "AUTO_VERIFIED" || existingDoc.status === "APPROVED" || existingDoc.status === "PENDING_PI_REVIEW") &&
      !existingDoc.canReupload
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This document is already verified and locked. To replace it, please request permission from your Platoon Inspector.",
        },
        { status: 403 }
      );
    }

    // Check blur / sharpness
    if (isBlurry || blurScore < 50) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Document is too blurry or out of focus. Please ensure good lighting, clean your camera lens, and hold your phone steady.",
        },
        { status: 422 }
      );
    }

    // Passport compliance check
    if (documentKey === "passport") {
      const passportCheck = checkPassportCompliance(imageWidth, imageHeight, fileSizeBytes);
      if (!passportCheck.compliant) {
        return NextResponse.json(
          {
            success: false,
            error: passportCheck.errors.join(" "),
          },
          { status: 422 }
        );
      }
    }

    // Exeat Medical Gate
    if (documentKey === "exeat") {
      if (cm.is_medical && !submission.exeat.unlockedByPi) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Exeat requests are restricted for Corps Members with medical qualifications. Your Platoon Inspector must unlock this slot for you.",
          },
          { status: 403 }
        );
      }
    }

    // Run automated document classification
    const classification = classifyDocument(documentKey as DocumentKey, extractedText, fileName);

    if (!classification.matched) {
      return NextResponse.json(
        {
          success: false,
          error: classification.message,
          detectedKey: classification.detectedKey,
        },
        { status: 422 }
      );
    }

    // Determine initial document status
    let newStatus: UploadStatus = "AUTO_VERIFIED";
    if (
      documentKey === "passport" ||
      documentKey === "school_certificate" ||
      documentKey === "school_certificate_hnd" ||
      documentKey === "medical_fitness" ||
      documentKey === "bank_slip"
    ) {
      newStatus = "PENDING_PI_REVIEW";
    }

    // Update document record
    const updatedDocs = {
      ...submission.documents,
      [documentKey]: {
        key: documentKey as DocumentKey,
        status: newStatus,
        fileName: fileName || `${documentKey}.pdf`,
        fileUrl: fileUrl || "",
        pdfUrl: pdfUrl || (fileUrl && fileUrl.startsWith("data:application/pdf") ? fileUrl : undefined),
        uploadedAt: new Date().toISOString(),
        verifiedAt: newStatus === "AUTO_VERIFIED" ? new Date().toISOString() : undefined,
        canReupload: false, // locks once submitted
      },
    };

    // If Exeat was uploaded, route to Secretariat
    let updatedExeat = { ...submission.exeat };
    if (documentKey === "exeat") {
      updatedExeat = {
        ...updatedExeat,
        status: "PENDING_SECRETARIAT",
        fileUrl: fileUrl || "",
        requestedAt: new Date().toISOString(),
      };
    }

    // Check if ALL mandatory documents are now uploaded
    // Mandatory list:
    // 1. passport, 2. callup_letter, 3. green_card, 4. undertaking, 5. school_certificate
    // (if polytechnic: school_certificate_hnd), 6. medical_fitness, 7. addendum
    // 8. certificate_format, 9. nerd, 10. nin, 11. bank_slip
    const mandatoryKeys: DocumentKey[] = [
      "passport",
      "callup_letter",
      "green_card",
      "undertaking",
      "school_certificate",
      "medical_fitness",
      "addendum",
      "certificate_format",
      "nerd",
      "nin",
      "bank_slip",
    ];

    if (cm.institution_type === "POLYTECHNIC") {
      mandatoryKeys.push("school_certificate_hnd");
    }

    const allMandatoryDone = mandatoryKeys.every((k) => {
      const doc = (updatedDocs as Record<string, any>)[k];
      return doc && (doc.status === "AUTO_VERIFIED" || doc.status === "PENDING_PI_REVIEW" || doc.status === "APPROVED");
    });

    let newKitStatus = submission.kit_status;
    if (allMandatoryDone && submission.kit_status === "INCOMPLETE") {
      newKitStatus = "READY_FOR_KIT";
    }

    const updatedSubmission = await updateSubmission(stateCode, {
      documents: updatedDocs,
      exeat: updatedExeat,
      kit_status: newKitStatus,
    });

    await addAuditLog(
      cm.full_name,
      "DOCUMENT_UPLOADED",
      `${documentKey} uploaded and verified as ${newStatus}`
    );

    return NextResponse.json({
      success: true,
      message: classification.message,
      submission: updatedSubmission,
      kitStatus: newKitStatus,
    });
  } catch (error: any) {
    console.error("upload error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
