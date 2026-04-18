import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, FileText, ShieldCheck, Sparkles, X, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import { formatPKR } from "@/lib/mock-data";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const TERMS = [
  {
    title: "Scope of work",
    body: "I have read the job description and agree the work scope is clearly defined.",
  },
  {
    title: "Milestone payments",
    body: "Payments will be released in milestones only after each stage is verified by the homeowner.",
  },
  {
    title: "Escrow protection",
    body: "Funds are held by Nighabaan and only released when both parties confirm the milestone.",
  },
  {
    title: "Platform fee",
    body: "A 1% platform fee applies on each milestone, split equally between homeowner and worker.",
  },
  {
    title: "Dispute resolution",
    body: "If we disagree, Nighabaan will help mediate before any funds are released.",
  },
];

const Agreement = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();

  const [job, setJob] = useState<any>(null);
  const [agreement, setAgreement] = useState<any>(null);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [checked, setChecked] = useState<boolean[]>(TERMS.map(() => false));
  const [signature, setSignature] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSigning, setIsSigning] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      const { data: jobData } = await supabase
        .from("jobs")
        .select("*, homeowner:homeowner_id(name), worker:worker_id(name)")
        .eq("id", id)
        .single();
      const { data: agreeData } = await supabase
        .from("agreements")
        .select("*")
        .eq("job_id", id)
        .single();
      const { data: milestoneData } = await supabase
        .from("milestones")
        .select("*")
        .eq("job_id", id)
        .order("percentage", { ascending: true });

      if (jobData) {
        jobData.homeownerName = jobData.homeowner?.name;
        jobData.workerName = jobData.worker?.name;
        setJob(jobData);
        setAgreement(agreeData);
        setMilestones(milestoneData || []);
      }
      setIsLoadingData(false);
    };

    fetchData();
  }, [id]);

  if (isLoadingData || !user || !job) {
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

  const meName = user.name || "";
  const homeownerAgreed = !!agreement?.homeowner_agreed_at;
  const workerAgreed = !!agreement?.worker_agreed_at;
  const myAgreed = isHomeowner ? homeownerAgreed : workerAgreed;
  const otherAgreed = isHomeowner ? workerAgreed : homeownerAgreed;
  const otherName = isHomeowner ? job.workerName ?? "Worker" : job.homeownerName;

  const allChecked = checked.every(Boolean);
  const canSign = allChecked && signature.trim().toLowerCase() === meName.toLowerCase();

  const handleSign = async () => {
    setIsSigning(true);
    const now = new Date().toISOString();
    
    // Update agreement
    const updateObj = isHomeowner ? { homeowner_agreed_at: now } : { worker_agreed_at: now };
    const { error } = await supabase.from('agreements').update(updateObj).eq("job_id", id);
    
    if (error) {
      toast.error(error.message);
      setIsSigning(false);
      return;
    }

    // Check if both signed
    const { data: updatedAgree } = await supabase.from('agreements').select('*').eq('job_id', id).single();
    if (updatedAgree?.homeowner_agreed_at && updatedAgree?.worker_agreed_at) {
      // Transition job to both_agreed
      await supabase.from('jobs').update({ status: 'both_agreed' }).eq('id', id);
    }

    setIsSigning(false);
    setConfirmOpen(false);
    toast.success("Agreement signed!");
    navigate(`/job/${job.id}`);
  };

  if (myAgreed) {
    return (
      <AppShell hideNav>
        <header className="flex items-center gap-2 px-5 pt-6">
          <button
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        </header>
        <div className="px-6 pt-10 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-success/10">
            <Check className="h-8 w-8 text-success" strokeWidth={2.4} />
          </div>
          <h1 className="font-serif text-3xl text-foreground">You've signed</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {otherAgreed
              ? "Both parties have agreed. The homeowner can fund the escrow now."
              : `We're waiting for ${otherName} to sign their part of the agreement.`}
          </p>
          <Button
            onClick={() => navigate(`/job/${job.id}`)}
            className="mt-8 h-14 w-full rounded-xl text-base font-semibold shadow-glow"
          >
            Back to job
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell hideNav>
      <header className="flex items-center gap-2 px-5 pt-6">
        <button
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-primary">
            Agreement
          </p>
          <h1 className="truncate font-serif text-2xl text-foreground">
            {job.title}
          </h1>
        </div>
      </header>

      <div className="px-5 pt-4 pb-32">
        {/* Trust banner */}
        <div className="flex items-start gap-3 rounded-2xl bg-primary-soft p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-semibold text-foreground">
              Both parties must sign
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              No money moves until you and {otherName} both agree to the terms below.
            </p>
          </div>
        </div>

        {/* Parties */}
        <section className="mt-5 rounded-2xl bg-card p-5 shadow-soft">
          <h2 className="text-sm font-semibold text-foreground">Parties</h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <PartyCard
              label="Homeowner"
              name={job.homeownerName || "Pending"}
              agreed={homeownerAgreed}
              isYou={isHomeowner}
            />
            <PartyCard
              label="Worker"
              name={job.workerName ?? "Pending"}
              agreed={workerAgreed}
              isYou={!isHomeowner}
            />
          </div>
        </section>

        {/* Scope */}
        <section className="mt-5 rounded-2xl bg-card p-5 shadow-soft">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Scope of work</h2>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {job.description}
          </p>
        </section>

        {/* Payment terms */}
        <section className="mt-5 rounded-2xl bg-card p-5 shadow-soft">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Payment terms</h2>
          </div>
          <div className="mt-3 flex items-center justify-between border-b border-border pb-3">
            <span className="text-sm text-muted-foreground">Total contract</span>
            <span className="text-base font-semibold tabular-nums">
              {formatPKR(job.total_amount)}
            </span>
          </div>
          {milestones.map((m, idx) => (
            <div
              key={m.id}
              className={cn(
                "flex items-center justify-between py-3",
                idx !== milestones.length - 1 && "border-b border-border",
              )}
            >
              <div>
                <p className="text-sm font-medium text-foreground">{m.label}</p>
                <p className="text-xs text-muted-foreground">{m.percentage}% of total</p>
              </div>
              <span className="text-sm font-semibold tabular-nums">
                {formatPKR(m.amount)}
              </span>
            </div>
          ))}
        </section>

        {/* Terms checklist */}
        <section className="mt-5 rounded-2xl bg-card p-5 shadow-soft">
          <h2 className="text-sm font-semibold text-foreground">Terms & conditions</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Read each term and tick to acknowledge.
          </p>

          <div className="mt-4 space-y-3">
            {TERMS.map((term, i) => (
              <label
                key={term.title}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition-smooth",
                  checked[i]
                    ? "border-primary bg-primary-soft"
                    : "border-border hover:border-primary/40",
                )}
              >
                <Checkbox
                  checked={checked[i]}
                  onCheckedChange={(v) =>
                    setChecked((prev) => prev.map((c, idx) => (idx === i ? !!v : c)))
                  }
                  className="mt-0.5"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{term.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {term.body}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </section>

        {/* Signature */}
        <section className="mt-5 rounded-2xl bg-card p-5 shadow-soft">
          <h2 className="text-sm font-semibold text-foreground">Your signature</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Type your full name <span className="font-medium text-foreground">({meName})</span> to sign.
          </p>
          <Input
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            placeholder={meName}
            className="mt-3 h-14 rounded-xl font-serif text-xl italic"
          />
          {signature && signature.trim().toLowerCase() !== meName.toLowerCase() && (
            <p className="mt-2 text-xs text-destructive">
              Name must match exactly: {meName}
            </p>
          )}
        </section>
      </div>

      {/* Sticky sign button */}
      <div className="fixed bottom-0 left-1/2 w-full max-w-md -translate-x-1/2 border-t border-border bg-card/95 px-5 py-4 backdrop-blur-md">
        <Button
          disabled={!canSign}
          onClick={() => setConfirmOpen(true)}
          className="h-14 w-full rounded-xl text-base font-semibold shadow-glow"
        >
          Sign agreement
        </Button>
        {!allChecked && (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Acknowledge all {TERMS.length} terms above to continue
          </p>
        )}
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Sign as {meName}?</DialogTitle>
            <DialogDescription className="pt-2">
              By signing, you commit to the terms of this agreement. This action is
              recorded with a timestamp and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex-row gap-2 sm:justify-stretch">
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              className="h-12 flex-1 rounded-xl"
              disabled={isSigning}
            >
              <X className="mr-1 h-4 w-4" /> Cancel
            </Button>
            <Button
              onClick={handleSign}
              disabled={isSigning}
              className="h-12 flex-1 rounded-xl shadow-glow"
            >
              {isSigning ? <Loader2 className="mr-1 h-4 w-4 animate-spin"/> : <Check className="mr-1 h-4 w-4" />}
              Confirm & sign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};

const PartyCard = ({
  label,
  name,
  agreed,
  isYou,
}: {
  label: string;
  name: string;
  agreed: boolean;
  isYou: boolean;
}) => (
  <div
    className={cn(
      "rounded-xl border-2 p-3",
      isYou ? "border-primary bg-primary-soft/50" : "border-border bg-muted/40",
    )}
  >
    <div className="flex items-center justify-between">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      {isYou && (
        <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
          YOU
        </span>
      )}
    </div>
    <p className="mt-1 truncate text-sm font-semibold text-foreground">{name}</p>
    <div className="mt-2 flex items-center gap-1 text-xs">
      {agreed ? (
        <>
          <Check className="h-3 w-3 text-success" strokeWidth={3} />
          <span className="text-success">Signed</span>
        </>
      ) : (
        <span className="text-muted-foreground">Not signed yet</span>
      )}
    </div>
  </div>
);

export default Agreement;
