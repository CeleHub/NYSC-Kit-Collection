export type InstitutionType = "UNIVERSITY" | "POLYTECHNIC" | "COLLEGE_OF_EDUCATION";

export interface CorpsMember {
  state_code: string;
  call_up_no: string;
  full_name: string;
  email: string;
  phone: string;
  gender: "M" | "F";
  institution: string;
  institution_type: InstitutionType;
  course_of_study: string;
  is_medical: boolean;
  platoon: number;
  batch: string;
}

export type DocumentKey =
  | "passport"
  | "callup_letter"
  | "green_card"
  | "undertaking"
  | "school_certificate"
  | "school_certificate_hnd" // for polytechnic
  | "medical_fitness"
  | "addendum"
  | "certificate_format"
  | "nerd"
  | "nin"
  | "bank_slip"
  | "exeat";

export type DocumentCategory = "AUTO_VERIFIED" | "PI_INSPECTED" | "CONDITIONAL";

export interface DocumentDefinition {
  key: DocumentKey;
  title: string;
  shortDesc: string;
  required: boolean;
  category: DocumentCategory;
  acceptedFormats: string[];
  sampleImage: string;
  instructions: string[];
}

export type UploadStatus = "NOT_UPLOADED" | "PROCESSING" | "AUTO_VERIFIED" | "PENDING_PI_REVIEW" | "APPROVED" | "REJECTED";

export interface DocumentRecord {
  key: DocumentKey;
  status: UploadStatus;
  fileName?: string;
  fileUrl?: string;
  uploadedAt?: string;
  verifiedAt?: string;
  rejectionReason?: string;
  canReupload?: boolean;
}

export type KitStatus = "INCOMPLETE" | "READY_FOR_KIT" | "KIT_DISBURSED";

export interface ExeatRecord {
  status: "NONE" | "PENDING_SECRETARIAT" | "DELIVERED" | "REJECTED";
  unlockedByPi: boolean;
  fileUrl?: string;
  reason?: string;
  requestedAt?: string;
  actionedAt?: string;
  actionNotes?: string;
}

export interface SubmissionRecord {
  state_code: string;
  kit_status: KitStatus;
  kit_disbursed_at?: string;
  kit_disbursed_by_platoon?: number;
  qr_token: string;
  backup_pin: string;
  documents: Record<string, DocumentRecord>;
  exeat: ExeatRecord;
  last_updated: string;
}

export interface PlatoonInspectorAccount {
  platoon: number;
  name: string;
  email: string;
  active: boolean; // can be suspended by Admin
}

export interface SecretariatAccount {
  email: string;
  officer_name: string;
  active: boolean;
}

export interface AdminKPIs {
  totalMobilized: number;
  totalLoggedIn: number;
  totalReadyForKit: number;
  totalKitsDisbursed: number;
  disbursedPercentage: number;
  totalMedicalCorpers: number;
  totalExeatRequested: number;
  totalExeatDelivered: number;
  platoonsProgress: {
    platoon: number;
    total: number;
    ready: number;
    disbursed: number;
    disbursedPct: number;
  }[];
}
