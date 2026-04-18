export type Role = "homeowner" | "worker";

export type JobStatus =
  | "awaiting_worker"
  | "agreement_pending"
  | "both_agreed"
  | "funded"
  | "in_progress"
  | "completed";

export interface DBUser {
  id: string;
  phone: string;
  name: string | null;
  role: Role | null;
  wallet_balance: number;
  trust_score: number;
}

export interface Milestone {
  id: string;
  job_id: string;
  label: string;
  percentage: number;
  amount: number;
  status: "pending" | "released";
  released_at?: string | null;
}

export interface Agreement {
  id: string;
  job_id: string;
  homeowner_agreed_at: string | null;
  worker_agreed_at: string | null;
}

export interface Job {
  id: string;
  homeowner_id: string;
  worker_id: string | null;
  status: JobStatus;
  job_code: string;
  title: string;
  description: string;
  total_amount: number;
  created_at: string;
}

export interface Transaction {
  id: string;
  job_id: string | null;
  from_user_id: string;
  to_user_id: string;
  type: "deposit" | "milestone_release" | "platform_fee";
  amount: number;
  created_at: string;
}

export const formatPKR = (amount: number) =>
  `PKR ${amount.toLocaleString("en-PK")}`;

export const statusLabel = (status: JobStatus): string => {
  switch (status) {
    case "awaiting_worker":
      return "Waiting for Worker";
    case "agreement_pending":
      return "Agreement Pending";
    case "both_agreed":
      return "Ready to Fund";
    case "funded":
      return "Funded";
    case "in_progress":
      return "In Progress";
    case "completed":
      return "Completed";
  }
};

export const statusTone = (
  status: JobStatus,
): "neutral" | "warning" | "info" | "success" => {
  switch (status) {
    case "awaiting_worker":
    case "agreement_pending":
      return "warning";
    case "both_agreed":
    case "funded":
      return "info";
    case "in_progress":
      return "info";
    case "completed":
      return "success";
    default:
      return "neutral";
  }
};
