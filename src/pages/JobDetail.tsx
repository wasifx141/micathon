import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, Circle, ChevronDown, Lock, FileSignature, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatPKR } from "@/lib/mock-data";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const JobDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  
  const [job, setJob] = useState<any>(null);
  const [agreement, setAgreement] = useState<any>(null);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [descOpen, setDescOpen] = useState(false);

  const fetchJobData = async () => {
    if (!id) return;
    
    // Fetch Job with user names
    const { data: jobData, error: jobError } = await supabase
      .from("jobs")
      .select(`
        *,
        homeowner:homeowner_id (name),
        worker:worker_id (name)
      `)
      .eq("id", id)
      .single();

    if (jobError || !jobData) {
      toast.error("Job not found");
      navigate("/dashboard");
      return;
    }

    // Map names for ease
    jobData.homeownerName = jobData.homeowner?.name;
    jobData.workerName = jobData.worker?.name;

    // Fetch Agreement
    const { data: agreementData } = await supabase
      .from("agreements")
      .select("*")
      .eq("job_id", id)
      .single();

    // Fetch Milestones
    const { data: milestonesData } = await supabase
      .from("milestones")
      .select("*")
      .eq("job_id", id)
      .order("percentage", { ascending: true });

    setJob(jobData);
    setAgreement(agreementData);
    setMilestones(milestonesData || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchJobData();

    if (!id) return;

    const channel = supabase
      .channel(`public:jobs:${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jobs", filter: `id=eq.${id}` },
        () => {
          fetchJobData();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agreements", filter: `job_id=eq.${id}` },
        () => {
          fetchJobData();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "milestones", filter: `job_id=eq.${id}` },
        () => {
          fetchJobData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  if (loading || !user || !job) {
    return (
      <AppShell>
         <div className="flex min-h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
         </div>
      </AppShell>
    );
  }

  const role = user.role;
  const isHomeowner = role === "homeowner";
  
  const homeownerAgreed = !!agreement?.homeowner_agreed_at;
  const workerAgreed = !!agreement?.worker_agreed_at;
  const myAgreed = isHomeowner ? homeownerAgreed : workerAgreed;
  const bothAgreed = homeownerAgreed && workerAgreed;
  const nextMilestone = milestones.find((m) => m.status === "pending");

  let actionLabel = "";
  let actionDisabled = false;
  let actionTone: "primary" | "muted" = "primary";
  let actionHref: string | null = null;
  let actionFn: (() => Promise<void>) | null = null;
  let showSignIcon = false;

  const handleFundEscrow = async () => {
    setActionLoading(true);
    // 1. Check wallet balance live
    const { data: userData } = await supabase.from('users').select('wallet_balance').eq('id', user.id).single();
    if (!userData || userData.wallet_balance < job.total_amount) {
      toast.error("Insufficient wallet balance. Top up first.");
      setActionLoading(false);
      return;
    }

    // 2. Deduct amount
    const newBalance = userData.wallet_balance - job.total_amount;
    await supabase.from('users').update({ wallet_balance: newBalance }).eq('id', user.id);

    // 3. Update job status
    await supabase.from('jobs').update({ status: 'funded' }).eq('id', job.id);

    // 4. Insert transaction
    await supabase.from('transactions').insert({
      from_user_id: user.id,
      to_user_id: user.id,
      type: 'deposit',
      amount: job.total_amount,
      job_id: job.id
    });

    await refreshUser();
    setActionLoading(false);
    toast.success("Escrow funded successfully");
  };

  const handleReleasePayment = async () => {
    if (!nextMilestone || !job.worker_id) return;
    setActionLoading(true);

    const amount = nextMilestone.amount;
    const fee = Math.round(amount * 0.01);
    const homeownerFee = Math.round(fee / 2);
    const workerFee = Math.round(fee / 2);
    const workerGets = amount - workerFee;

    // 1. Fetch current balances
    const { data: hwData } = await supabase.from('users').select('wallet_balance, trust_score').eq('id', job.homeowner_id).single();
    const { data: wData } = await supabase.from('users').select('wallet_balance, trust_score').eq('id', job.worker_id).single();

    if (!hwData || !wData) {
      setActionLoading(false);
      return;
    }

    // 2. Update balances
    await supabase.from('users').update({ wallet_balance: hwData.wallet_balance - homeownerFee }).eq('id', job.homeowner_id);
    await supabase.from('users').update({ wallet_balance: wData.wallet_balance + workerGets }).eq('id', job.worker_id);

    // 3. Update milestone
    await supabase.from('milestones').update({ status: 'released', released_at: new Date().toISOString() }).eq('id', nextMilestone.id);

    // 4. Insert transactions
    await supabase.from('transactions').insert([
      { from_user_id: job.homeowner_id, to_user_id: job.worker_id, type: 'milestone_release', amount: amount, job_id: job.id },
      { from_user_id: job.homeowner_id, to_user_id: job.homeowner_id, type: 'platform_fee', amount: homeownerFee, job_id: job.id },
      { from_user_id: job.worker_id, to_user_id: job.worker_id, type: 'platform_fee', amount: workerFee, job_id: job.id },
    ]);

    // 5. Check if complete
    const updatedMilestones = await supabase.from('milestones').select('status').eq('job_id', job.id);
    const allReleased = updatedMilestones.data?.every(m => m.status === 'released');
    
    if (allReleased) {
      await supabase.from('jobs').update({ status: 'completed' }).eq('id', job.id);
      await supabase.from('users').update({ trust_score: hwData.trust_score + 1 }).eq('id', job.homeowner_id);
      await supabase.from('users').update({ trust_score: wData.trust_score + 1 }).eq('id', job.worker_id);
      toast.success("Job completed!");
    } else {
      toast.success("Payment released");
    }

    if (user.id === job.homeowner_id) {
       await refreshUser();
    }
    setActionLoading(false);
  };

  if (isHomeowner) {
    if (job.status === "awaiting_worker") {
      actionLabel = "Waiting for worker to join";
      actionDisabled = true;
      actionTone = "muted";
    } else if (!myAgreed) {
      actionLabel = "Sign agreement";
      actionHref = `/job/${job.id}/agreement`;
      showSignIcon = true;
    } else if (!bothAgreed) {
      actionLabel = "Waiting for worker to sign";
      actionDisabled = true;
      actionTone = "muted";
    } else if (job.status === "both_agreed" || job.status === "agreement_pending") {
      actionLabel = `Fund escrow (${formatPKR(job.total_amount)})`;
      actionFn = handleFundEscrow;
    } else if ((job.status === "funded" || job.status === "in_progress") && nextMilestone) {
      actionLabel = `Release ${nextMilestone.label} (${formatPKR(nextMilestone.amount)})`;
      actionFn = handleReleasePayment;
    } else if (job.status === "completed") {
      actionLabel = "Job complete — All payments released";
      actionDisabled = true;
      actionTone = "muted";
    }
  } else {
    if (job.status === "awaiting_worker") {
      actionLabel = "Waiting for worker to join";
      actionDisabled = true;
      actionTone = "muted";
    } else if (!myAgreed) {
      actionLabel = "Sign agreement";
      actionHref = `/job/${job.id}/agreement`;
      showSignIcon = true;
    } else if (!bothAgreed) {
      actionLabel = "Waiting for homeowner to sign";
      actionDisabled = true;
      actionTone = "muted";
    } else if (job.status === "completed") {
      actionLabel = "Job complete — Money received";
      actionDisabled = true;
      actionTone = "muted";
    } else {
      actionLabel = "Waiting for homeowner to release payment";
      actionDisabled = true;
      actionTone = "muted";
    }
  }

  const performAction = () => {
    if (actionHref) navigate(actionHref);
    else if (actionFn) actionFn();
  };

  return (
    <AppShell hideNav>
      <header className="flex items-center justify-between gap-2 px-5 pt-6">
        <button
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      </header>

      <div className="px-5 pt-4 pb-32">
        {/* Title */}
        <div>
          <StatusPill status={job.status} />
          <h1 className="mt-3 font-serif text-3xl leading-tight text-foreground">
            {job.title}
          </h1>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
            {formatPKR(job.total_amount)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Job code · <span className="font-mono font-medium tracking-widest">{job.job_code}</span>
          </p>
        </div>

        {/* Agreement card */}
        <section className="mt-6 rounded-3xl bg-card p-5 shadow-soft">
          <h2 className="text-sm font-semibold text-foreground">Agreement</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Both parties must sign before payment is funded.
          </p>

          <div className="mt-4 space-y-3">
            <AgreementRow
              name={job.homeownerName || "Homeowner"}
              role="Homeowner"
              agreed={homeownerAgreed}
              agreedAt={agreement?.homeowner_agreed_at}
            />
            <AgreementRow
              name={job.workerName ?? "Waiting for worker..."}
              role="Worker"
              agreed={workerAgreed}
              agreedAt={agreement?.worker_agreed_at}
              pending={!job.workerName}
            />
          </div>
        </section>

        {/* Milestones */}
        <section className="mt-5">
          <h2 className="px-1 text-sm font-semibold text-foreground">Milestones</h2>
          <div className="mt-3 space-y-3">
            {milestones.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "rounded-2xl bg-card p-4 shadow-soft",
                  m.status === "released" && "bg-success/5",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">{m.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {m.percentage}% of total
                    </p>
                  </div>
                  <p className="text-base font-semibold tabular-nums text-foreground">
                    {formatPKR(m.amount)}
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  {m.status === "released" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
                      <Check className="h-3 w-3" strokeWidth={3} />
                      Released
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      <Circle className="h-2.5 w-2.5" />
                      Pending
                    </span>
                  )}
                  {m.released_at && (
                    <span className="text-xs text-muted-foreground">
                      {formatDate(m.released_at)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Description */}
        <section className="mt-5 rounded-2xl bg-card p-5 shadow-soft">
          <button
            onClick={() => setDescOpen((v) => !v)}
            className="flex w-full items-center justify-between"
          >
            <h2 className="text-sm font-semibold text-foreground">Job description</h2>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-smooth",
                descOpen && "rotate-180",
              )}
            />
          </button>
          <p
            className={cn(
              "mt-3 text-sm leading-relaxed text-muted-foreground",
              !descOpen && "line-clamp-3",
            )}
          >
            {job.description}
          </p>
        </section>
      </div>

      {/* Sticky action */}
      <div className="fixed bottom-0 left-1/2 w-full max-w-md -translate-x-1/2 border-t border-border bg-card/95 px-5 py-4 backdrop-blur-md">
        <Button
          disabled={actionDisabled || actionLoading}
          onClick={performAction}
          className={cn(
            "h-14 w-full rounded-xl text-base font-semibold",
            actionTone === "primary" && "shadow-glow",
          )}
        >
          {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {!actionLoading && actionDisabled && <Lock className="mr-2 h-4 w-4" />}
          {!actionLoading && showSignIcon && <FileSignature className="mr-2 h-4 w-4" />}
          {actionLabel}
        </Button>
      </div>
    </AppShell>
  );
};

const AgreementRow = ({
  name,
  role,
  agreed,
  agreedAt,
  pending,
}: {
  name: string;
  role: string;
  agreed: boolean;
  agreedAt?: string | null;
  pending?: boolean;
}) => (
  <div className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-3">
    <div className="min-w-0">
      <p className="truncate text-sm font-medium text-foreground">{name}</p>
      <p className="text-xs text-muted-foreground">
        {role}
        {agreedAt && ` · ${formatDate(agreedAt)}`}
      </p>
    </div>
    {agreed ? (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success/15">
        <Check className="h-4 w-4 text-success" strokeWidth={3} />
      </div>
    ) : (
      <div
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full border-2",
          pending ? "border-dashed border-muted-foreground/30" : "border-muted-foreground/30",
        )}
      >
        <Circle className="h-3 w-3 text-muted-foreground/40" />
      </div>
    )}
  </div>
);

export default JobDetail;
