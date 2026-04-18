import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, Check, Share2, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatPKR } from "@/lib/mock-data";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

const generateCode = () =>
  Array.from({ length: 6 }, () =>
    "ABCDEFGHJKMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 31)],
  ).join("");

const CreateJob = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState<string>("");
  const [submitted, setSubmitted] = useState(false);
  const [jobCode, setJobCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const total = Number(amount) || 0;
  const start = Math.round(total * 0.3);
  const completion = total - start;

  const handleCopy = () => {
    navigator.clipboard.writeText(jobCode);
    setCopied(true);
    toast.success("Code copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePostJob = async () => {
    if (!user) return;
    setIsLoading(true);

    const newJobCode = generateCode();

    // 1. Insert Job
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .insert({
        homeowner_id: user.id,
        worker_id: null,
        status: "awaiting_worker",
        job_code: newJobCode,
        title,
        description,
        total_amount: total
      })
      .select()
      .single();

    if (jobError || !job) {
      toast.error(jobError?.message || "Error creating job");
      setIsLoading(false);
      return;
    }

    // 2. Insert Agreement
    const { error: agreementError } = await supabase
      .from("agreements")
      .insert({
        job_id: job.id,
      });

    if (agreementError) {
      toast.error(agreementError.message);
      setIsLoading(false);
      return;
    }

    // 3. Insert Milestones
    const { error: milestoneError } = await supabase
      .from("milestones")
      .insert([
        {
          job_id: job.id,
          label: "Start Payment",
          percentage: 30,
          amount: start,
          status: "pending"
        },
        {
          job_id: job.id,
          label: "Completion Payment",
          percentage: 70,
          amount: completion,
          status: "pending"
        }
      ]);

    setIsLoading(false);
    
    if (milestoneError) {
      toast.error(milestoneError.message);
    } else {
      setJobCode(newJobCode);
      setSubmitted(true);
      toast.success("Job posted successfully!");
    }
  };

  if (submitted) {
    return (
      <AppShell hideNav>
        <header className="flex items-center px-5 pt-6">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        </header>

        <div className="px-6 pt-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-success/10">
            <Check className="h-8 w-8 text-success" strokeWidth={2.4} />
          </div>
          <h1 className="font-serif text-3xl text-foreground">Job posted!</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Share this code with your worker so they can join.
          </p>

          <div className="mt-8 rounded-3xl bg-gradient-card p-8 shadow-card">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Job code
            </p>
            <p className="mt-3 font-serif text-5xl tracking-[0.2em] text-primary">
              {jobCode}
            </p>
            <Button
              onClick={handleCopy}
              variant="outline"
              className="mt-6 h-12 w-full rounded-xl"
            >
              {copied ? (
                <>
                  <Check className="mr-2 h-4 w-4" /> Copied
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" /> Copy code
                </>
              )}
            </Button>
          </div>

          <Button
            variant="ghost"
            className="mt-4 h-12 w-full rounded-xl text-primary"
          >
            <Share2 className="mr-2 h-4 w-4" /> Share via WhatsApp
          </Button>

          <Button
            onClick={() => navigate("/dashboard")}
            className="mt-8 h-14 w-full rounded-xl text-base font-semibold shadow-glow"
          >
            Done
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
        <h1 className="font-serif text-2xl text-foreground">Post a job</h1>
      </header>

      <div className="space-y-6 px-5 pt-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Job title</label>
          <Input
            placeholder="e.g. Bathroom plumbing repair"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-14 rounded-xl text-base"
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            What needs to be done?
          </label>
          <Textarea
            placeholder="Describe the work in detail..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            className="rounded-xl text-base"
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Total amount</label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base font-semibold text-muted-foreground">
              PKR
            </span>
            <Input
              type="number"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-14 rounded-xl pl-16 text-base font-semibold tabular-nums"
              disabled={isLoading}
            />
          </div>
        </div>

        {total > 0 && (
          <div className="rounded-2xl bg-primary-soft p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-primary">
              Milestone split
            </p>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between rounded-xl bg-card px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Start Payment</p>
                  <p className="text-xs text-muted-foreground">30%</p>
                </div>
                <p className="font-semibold tabular-nums">{formatPKR(start)}</p>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-card px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Completion Payment</p>
                  <p className="text-xs text-muted-foreground">70%</p>
                </div>
                <p className="font-semibold tabular-nums">{formatPKR(completion)}</p>
              </div>
            </div>
          </div>
        )}

        <Button
          onClick={handlePostJob}
          disabled={!title || !description || total <= 0 || isLoading}
          className="h-14 w-full rounded-xl text-base font-semibold shadow-glow"
        >
          {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
          Post job & get code
        </Button>
      </div>
    </AppShell>
  );
};

export default CreateJob;
