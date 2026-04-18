import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, KeyRound, X, Loader2 } from "lucide-react";
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
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const JobsList = () => {
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

  const active = jobs.filter((j) => j.status !== "completed");
  const completed = jobs.filter((j) => j.status === "completed");

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

  if (authLoading || (!user && !authLoading)) {
    return (
      <AppShell>
         <div className="flex min-h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
         </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <header className="px-5 pt-10 pb-4">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="font-serif text-3xl text-foreground">Your jobs</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {loadingJobs ? "..." : `${jobs.length} total · ${active.length} active`}
        </p>
      </header>

      <div className="px-5">
        {user.role === "homeowner" ? (
          <Button
            onClick={() => navigate("/create-job")}
            className="h-12 w-full rounded-xl shadow-glow"
          >
            <Plus className="mr-2 h-4 w-4" />
            Post a new job
          </Button>
        ) : (
          <Button
            onClick={() => setJoinOpen(true)}
            variant="outline"
            className="h-12 w-full rounded-xl"
          >
            <KeyRound className="mr-2 h-4 w-4" />
            Join a job
          </Button>
        )}
      </div>

      {loadingJobs ? (
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <section className="mt-6 px-5">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Active
              </h2>
              <div className="space-y-3">
                {active.map((job) => (
                  <JobCard key={job.id} job={job as any} />
                ))}
              </div>
            </section>
          )}

          {completed.length > 0 && (
            <section className="mt-6 px-5">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Completed
              </h2>
              <div className="space-y-3">
                {completed.map((job) => (
                  <JobCard key={job.id} job={job as any} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

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

export default JobsList;
