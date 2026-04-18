import { cn } from "@/lib/utils";
import { JobStatus, statusLabel, statusTone } from "@/lib/mock-data";

interface StatusPillProps {
  status: JobStatus;
  className?: string;
}

const toneClasses: Record<string, string> = {
  neutral: "bg-muted text-muted-foreground",
  warning: "bg-warning/10 text-warning",
  info: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
};

export const StatusPill = ({ status, className }: StatusPillProps) => {
  const tone = statusTone(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
        toneClasses[tone],
        className,
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          tone === "warning" && "bg-warning",
          tone === "info" && "bg-primary",
          tone === "success" && "bg-success",
          tone === "neutral" && "bg-muted-foreground",
        )}
      />
      {statusLabel(status)}
    </span>
  );
};
