import { DocumentDefinition } from "./types";

export const DOCUMENT_DEFINITIONS: DocumentDefinition[] = [
  {
    key: "passport",
    title: "Passport Photograph",
    shortDesc: "Recent white-background color headshot",
    required: true,
    category: "PI_INSPECTED",
    acceptedFormats: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
    sampleImage: "/assets/NYSC_LOGO.svg",
    instructions: [
      "Must be a clear front-facing portrait (head and shoulders only).",
      "Neutral expression: no smiling, teeth showing, or frowning.",
      "Both ears, eyes, and lips must be fully visible and uncovered.",
      "Strictly NO caps, hats, head coverings, sunglasses, or hand obstructions.",
      "Plain white or off-white background required."
    ]
  },
  {
    key: "callup_letter",
    title: "Signed Call-Up Letter",
    shortDesc: "Official deployment letter with QR code",
    required: true,
    category: "AUTO_VERIFIED",
    acceptedFormats: ["application/pdf", "image/jpeg", "image/png"],
    sampleImage: "/assets/NYSC_LOGO.svg",
    instructions: [
      "Must show 'BATCH C, 2026 Call-Up Letter' or equivalent batch header.",
      "Ensure the QR code at the top-right is clearly visible.",
      "The Prospective Corps Member Details and Reporting Information tables must be intact.",
      "Ensure the Director-General's signature block at the bottom is visible."
    ]
  },
  {
    key: "green_card",
    title: "Signed Green Card (Personal Details)",
    shortDesc: "Official green slip with personal & next of kin details",
    required: true,
    category: "AUTO_VERIFIED",
    acceptedFormats: ["application/pdf", "image/jpeg", "image/png"],
    sampleImage: "/assets/NYSC_LOGO.svg",
    instructions: [
      "Officially titled 'Corps Member's Personal Detail' with repeating green NYSC watermark.",
      "Must include Next of Kin emergency details and Educational Qualifications.",
      "Must be signed and dated on the 'PCM's Signature & Date' line.",
      "State code and Call-up number must match your camp registration."
    ]
  },
  {
    key: "undertaking",
    title: "Letter of Undertaking",
    shortDesc: "Signed code of conduct & dress code oath",
    required: true,
    category: "AUTO_VERIFIED",
    acceptedFormats: ["application/pdf", "image/jpeg", "image/png"],
    sampleImage: "/assets/NYSC_LOGO.svg",
    instructions: [
      "Must display 'UNDERTAKING' at the top with your State designation.",
      "All 5 clauses including proper kitting, pregnancy declaration (female), and anti-cultism pledge must be signed.",
      "Must clearly show your handwritten signature, date, and assigned State Code at the bottom."
    ]
  },
  {
    key: "school_certificate",
    title: "School Certificate / Statement of Result",
    shortDesc: "Original Degree / ND Certificate or verified statement",
    required: true,
    category: "PI_INSPECTED",
    acceptedFormats: ["application/pdf", "image/jpeg", "image/png"],
    sampleImage: "/assets/NYSC_LOGO.svg",
    instructions: [
      "Upload clean copy of your Degree Certificate or Official Statement of Result.",
      "For Polytechnic graduates: upload your National Diploma (ND) here.",
      "Must show institution name, graduation date, and registrar's stamp."
    ]
  },
  {
    key: "school_certificate_hnd",
    title: "HND Certificate (Polytechnic Only)",
    shortDesc: "Higher National Diploma certificate",
    required: false, // only required if polytechnic
    category: "PI_INSPECTED",
    acceptedFormats: ["application/pdf", "image/jpeg", "image/png"],
    sampleImage: "/assets/NYSC_LOGO.svg",
    instructions: [
      "Required for all Monotechnic/Polytechnic graduates.",
      "Upload your Higher National Diploma (HND) certificate or statement of result.",
      "Must show institution name and awarding date."
    ]
  },
  {
    key: "medical_fitness",
    title: "Medical Fitness Certificate",
    shortDesc: "Official medical report from government/military hospital",
    required: true,
    category: "PI_INSPECTED",
    acceptedFormats: ["application/pdf", "image/jpeg", "image/png"],
    sampleImage: "/assets/NYSC_LOGO.svg",
    instructions: [
      "Must be issued by a recognized Government or Military Hospital.",
      "Must feature official hospital letterhead, stamp, and medical doctor's seal/license number.",
      "Must clearly certify you physically and mentally fit for orientation training."
    ]
  },
  {
    key: "addendum",
    title: "Signed Addendum",
    shortDesc: "Terms & Conditions for compliance form",
    required: true,
    category: "AUTO_VERIFIED",
    acceptedFormats: ["application/pdf", "image/jpeg", "image/png"],
    sampleImage: "/assets/NYSC_LOGO.svg",
    instructions: [
      "Titled 'TERMS AND CONDITIONS FOR COMPLIANCE BY PROSPECTIVE CORPS MEMBERS'.",
      "Page 2 'DECLARATION & AGREEMENT' must be duly signed by the Corps Member.",
      "Make sure the print footer and date are clearly captured."
    ]
  },
  {
    key: "certificate_format",
    title: "Signed Certificate Format",
    shortDesc: "Official NYSC Certificate Format clearance sheet",
    required: true,
    category: "AUTO_VERIFIED",
    acceptedFormats: ["application/pdf", "image/jpeg", "image/png"],
    sampleImage: "/assets/NYSC_LOGO.svg",
    instructions: [
      "Must display 'Certificate Format' in large bold font.",
      "Ensure Section A (Personal details, Call-up No, Date reported) is complete.",
      "Section B must have Corps Member's signature and date."
    ]
  },
  {
    key: "nerd",
    title: "NERD Document",
    shortDesc: "Nigeria Education Repository and Databank compliance slip",
    required: true,
    category: "AUTO_VERIFIED",
    acceptedFormats: ["application/pdf", "image/jpeg", "image/png"],
    sampleImage: "/assets/NYSC_LOGO.svg",
    instructions: [
      "Must display 'NERD Compliance Clearance' from The Nigeria Education Repository and Databank.",
      "Must show your NDN identifier, project title, and institution.",
      "Must indicate Academic report submission: Complied."
    ]
  },
  {
    key: "nin",
    title: "National Identity Number (NIN) Slip",
    shortDesc: "Official NIMC slip with 11-digit NIN & tracking ID",
    required: true,
    category: "AUTO_VERIFIED",
    acceptedFormats: ["application/pdf", "image/jpeg", "image/png"],
    sampleImage: "/assets/NYSC_LOGO.svg",
    instructions: [
      "Official NIMC National Identification Number Slip (NINS).",
      "Must display the 11-digit NIN clearly.",
      "Tracking ID and NIMC government header must be sharp and legible."
    ]
  },
  {
    key: "bank_slip",
    title: "Bank Account Opening Slip",
    shortDesc: "Camp designated bank account confirmation slip",
    required: true,
    category: "PI_INSPECTED",
    acceptedFormats: ["application/pdf", "image/jpeg", "image/png"],
    sampleImage: "/assets/NYSC_LOGO.svg",
    instructions: [
      "Slip issued by the camp-designated commercial bank.",
      "Must clearly show Account Name (matching your NYSC name) and Account Number.",
      "Must have bank official stamp or printed teller acknowledgment."
    ]
  },
  {
    key: "exeat",
    title: "Minuted Exeat Slip",
    shortDesc: "Voluntary exeat clearance with officer minutes (Restricted for Medicals)",
    required: false,
    category: "CONDITIONAL",
    acceptedFormats: ["application/pdf", "image/jpeg", "image/png"],
    sampleImage: "/assets/NYSC_LOGO.svg",
    instructions: [
      "Only for Corps Members requesting camp exeat / travel permission.",
      "Must contain formal reason, camp address, phone number, and return date.",
      "Medical course graduates MUST be unlocked by Platoon Inspector first.",
      "Must be minuted and approved by Camp Director / Secretariat."
    ]
  }
];

export const PLATOON_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
