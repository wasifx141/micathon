import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { formatPKR } from "@/lib/mock-data";
import { StatusPill } from "@/components/StatusPill";
import { useAuth } from "@/context/AuthContext";

interface JobCardProps {
  job: any;
}

export const JobCard = ({ job }: JobCardProps) => {
  const { user } = useAuth();
  const role = user?.role || "homeowner";
  const otherParty =
    role === "homeowner"
      ? job.workerName ?? "Waiting for worker"
      : job.homeownerName;

  return (
    <Link
      to={`/job/${job.id}`}
      className="group block rounded-2xl bg-card p-5 shadow-soft transition-smooth hover:shadow-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-foreground">
            {job.title}
          </h3>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {role === "homeowner" ? "Worker: " : "Hired by: "}
            {otherParty}
          </p>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-smooth group-hover:translate-x-0.5 group-hover:text-primary" />
      </div>

      <div className="mt-4 flex items-center justify-between">
        <StatusPill status={job.status} />
        <span className="text-base font-semibold text-foreground tabular-nums">
          {formatPKR(job.total_amount)}
        </span>
      </div>
    </Link>
  );
};
