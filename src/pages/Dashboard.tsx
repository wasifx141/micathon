import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Plus, KeyRound, Briefcase, Hammer, X, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { JobCard } from "@/components/JobCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import { formatPKR, Job } from "@/lib/mock-data"; 
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [joinOpen, setJoinOpen] = useState(false);
  const [code, setCode] = useState("");
  const [jobs, setJobs] = useState<any[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    if (!user) return;
    
    const fetchJobs = async () => {
      setLoadingJobs(true);
      const isHomeowner = user.role === "homeowner";
      const column = isHomeowner ? "homeowner_id" : "worker_id";
      
      const { data, error } = await supabase
        .from("jobs")
        .select(`
          *,
          homeowner:homeowner_id (name),
          worker:worker_id (name)
        `)
        .eq(column, user.id)
        .order("created_at", { ascending: false });

      if (error) {
        toast.error("Failed to load jobs");
      } else {
        // Map data to expected Job interface structures roughly
        const mappedJobs = (data || []).map(j => ({
          ...j,
          homeownerName: j.homeowner?.name,
          workerName: j.worker?.name,
        }));
        setJobs(mappedJobs);
      }
      setLoadingJobs(false);
    };

    fetchJobs();
  }, [user]);

  const activeJobs = jobs.filter((j) => j.status !== "completed");

  const handleJoin = async () => {
    if (!user) return;
    setIsJoining(true);
    
    const inputCode = code.toUpperCase();
    
    // Check if job exists with this code and NO worker
    const { data: job, error: fetchError } = await supabase
      .from("jobs")
      .select("*")
      .eq("job_code", inputCode)
      .is("worker_id", null)
      .single();

    if (fetchError || !job) {
      toast.error("This code doesn't exist or already has a worker.");
      setIsJoining(false);
      return;
    }

    // Update job to attach this worker
    const { error: updateError } = await supabase
      .from("jobs")
      .update({ worker_id: user.id })
      .eq("id", job.id);

    setIsJoining(false);
    
    if (updateError) {
      toast.error(updateError.message);
    } else {
      setJoinOpen(false);
      setCode("");
      toast.success(`Joined job: ${job.title}!`);
      navigate(`/job/${job.id}`);
    }
  };

  if (authLoading) {
    return (
      <AppShell>
         <div className="flex min-h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
         </div>
      </AppShell>
    );
  }

  if (!user) return null; // handled by auth guards typically, but safe fallback

  return (
    <AppShell>
      {/* Header */}
      <header className="px-5 pt-10 pb-6">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Assalam o Alaikum,</p>
        </div>
        <h1 className="font-serif text-3xl text-foreground">{user.name}</h1>
        {user.role === "worker" && (
          <p className="mt-1 text-sm text-muted-foreground">
            Worker Dashboard
          </p>
        )}
      </header>

      {/* Wallet card */}
      <section className="px-5">
        <div className="overflow-hidden rounded-3xl bg-gradient-primary p-6 text-primary-foreground shadow-glow">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium opacity-90">
              {user.role === "homeowner" ? "Your Wallet" : "Earnings Wallet"}
            </p>
            <div className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur">
              <Shield className="h-3.5 w-3.5" />
              Trust · {user.trust_score}
            </div>
          </div>
          <p className="mt-4 font-serif text-4xl tabular-nums">
            {formatPKR(user.wallet_balance || 0)}
          </p>
          <button
            onClick={() => navigate("/wallet")}
            className="mt-4 text-sm font-medium opacity-90 underline-offset-2 hover:underline"
          >
            View transactions →
          </button>
        </div>
      </section>

      {/* Quick action */}
      <section className="mt-6 px-5">
        {user.role === "homeowner" ? (
          <Button
            onClick={() => navigate("/create-job")}
            variant="outline"
            className="h-14 w-full justify-start rounded-2xl border-dashed border-2 border-primary/30 bg-primary-soft/40 text-primary hover:bg-primary-soft"
          >
            <Plus className="mr-2 h-5 w-5" />
            Post a new job
          </Button>
        ) : (
          <Button
            onClick={() => setJoinOpen(true)}
            variant="outline"
            className="h-14 w-full justify-start rounded-2xl border-dashed border-2 border-primary/30 bg-primary-soft/40 text-primary hover:bg-primary-soft"
          >
            <KeyRound className="mr-2 h-5 w-5" />
            Join a job with code
          </Button>
        )}
      </section>

      {/* Active jobs */}
      <section className="mt-8 px-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">
            {user.role === "homeowner" ? "Active jobs" : "Your work"}
          </h2>
          <span className="text-xs font-medium text-muted-foreground">
            {loadingJobs ? "..." : activeJobs.length} ongoing
          </span>
        </div>

        {loadingJobs ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
          </div>
        ) : activeJobs.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card/50 p-10 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              {user.role === "homeowner" ? (
                <Briefcase className="h-7 w-7 text-primary" />
              ) : (
                <Hammer className="h-7 w-7 text-primary" />
              )}
            </div>
            <p className="font-medium text-foreground">No active jobs yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {user.role === "homeowner"
                ? "Post your first job to get started"
                : "Ask a homeowner for a 6-character job code"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeJobs.map((job) => (
              <JobCard key={job.id} job={job as any} />
            ))}
          </div>
        )}
      </section>

      {/* Join job modal */}
      <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Join a job</DialogTitle>
            <DialogDescription>
              Enter the 6-character code your homeowner shared with you.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
              placeholder="ABC123"
              maxLength={6}
              className="h-16 rounded-xl text-center font-mono text-2xl font-semibold tracking-[0.3em]"
              disabled={isJoining}
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setJoinOpen(false)}
                className="h-12 flex-1 rounded-xl"
                disabled={isJoining}
              >
                <X className="mr-1 h-4 w-4" /> Cancel
              </Button>
              <Button
                onClick={handleJoin}
                disabled={code.length < 6 || isJoining}
                className="h-12 flex-1 rounded-xl shadow-glow"
              >
                {isJoining ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Join job
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};

export default Dashboard;
