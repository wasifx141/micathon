import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, ArrowRight, Home, Hammer, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Role } from "@/lib/mock-data";

type Step = "auth" | "profile";
type AuthMode = "signin" | "signup";

const Onboarding = () => {
  const navigate = useNavigate();
  const { session, user, loading: authLoading, refreshUser } = useAuth();
  
  const [step, setStep] = useState<Step>("auth");
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      if (session && user?.name && user?.role) {
        navigate("/dashboard", { replace: true });
      } else if (session && (!user?.name || !user?.role)) {
        setStep("profile");
      }
    }
  }, [authLoading, session, user, navigate]);

  const syncUserToDB = async (userId: string, userEmail: string) => {
    // Basic upsert into public.users table so the record exists
    const { error } = await supabase.from('users').upsert({
      id: userId,
      email: userEmail,
    }, { onConflict: 'id' });
    if (error) {
      console.error("Error upserting user:", error);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      toast.error(error.message);
      setIsLoading(false);
      return;
    }

    if (authData?.user) {
      await syncUserToDB(authData.user.id, email);
      await refreshUser();
    }
    
    setIsLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const { data: authData, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      toast.error(error.message);
      setIsLoading(false);
      return;
    }

    if (authData?.user) {
      await syncUserToDB(authData.user.id, email);
      
      // If email confirmation is off, this will sign us in immediately
      if (authData.session) {
        await refreshUser();
      } else {
        toast.success("Account created! Check your email for verification.");
      }
    }
    
    setIsLoading(false);
  };

  const handleSaveProfile = async () => {
    if (!session?.user) return;
    setIsLoading(true);
    
    const { error } = await supabase.from('users').update({
      name,
      role
    }).eq('id', session.user.id);
    
    setIsLoading(false);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Profile saved");
      await refreshUser();
      navigate("/dashboard");
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-hero">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 pb-10 pt-16">
        {/* Brand */}
        <div className="mb-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-primary shadow-glow">
            <Shield className="h-7 w-7 text-primary-foreground" strokeWidth={2.2} />
          </div>
          <h1 className="font-serif text-4xl text-foreground">Nighabaan</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your guardian for safe home services
          </p>
        </div>

        {step === "auth" && (
          <div className="flex-1">
            <div className="mb-8 flex gap-4">
              <button 
                onClick={() => setAuthMode('signin')}
                className={cn("flex-1 border-b-2 pb-2 text-sm font-semibold transition-colors", authMode === 'signin' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground')}
              >
                Sign In
              </button>
              <button 
                onClick={() => setAuthMode('signup')}
                className={cn("flex-1 border-b-2 pb-2 text-sm font-semibold transition-colors", authMode === 'signup' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground')}
              >
                Sign Up
              </button>
            </div>

            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
              Welcome {authMode === 'signin' ? 'Back' : ''}
            </p>
            <h2 className="font-serif text-3xl leading-tight text-foreground">
              {authMode === 'signin' ? 'Sign in to' : 'Create account on'} <span className="italic">Nighabaan</span>
            </h2>

            <form onSubmit={authMode === 'signin' ? handleSignIn : handleSignUp} className="mt-8 space-y-4">
              <div>
                <label className="block mb-2 text-sm font-medium text-foreground">
                  Email
                </label>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-14 rounded-xl text-base"
                  required
                />
              </div>
              <div>
                <label className="block mb-2 text-sm font-medium text-foreground">
                  Password
                </label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-14 rounded-xl text-base"
                  required
                  minLength={6}
                />
              </div>
              <Button
                type="submit"
                disabled={!email || password.length < 6 || isLoading}
                className="mt-6 h-14 w-full rounded-xl text-base font-semibold shadow-glow"
              >
                {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : null}
                {authMode === 'signin' ? 'Sign In' : 'Sign Up'}
                <ArrowRight className="ml-1 h-5 w-5" />
              </Button>
            </form>
          </div>
        )}

        {step === "profile" && (
          <div className="flex-1">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
              Almost there
            </p>
            <h2 className="font-serif text-3xl leading-tight text-foreground">
              Tell us <span className="italic">about you</span>
            </h2>

            <div className="mt-6 space-y-2">
              <label className="block text-sm font-medium text-foreground">
                Your name
              </label>
              <Input
                placeholder="e.g. Ahmed Khan"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-14 rounded-xl text-base"
              />
            </div>

            <div className="mt-6 space-y-3">
              <label className="block text-sm font-medium text-foreground">
                I am a...
              </label>
              <button
                onClick={() => setRole("homeowner")}
                className={cn(
                  "flex w-full items-start gap-4 rounded-2xl border-2 bg-card p-5 text-left transition-smooth",
                  role === "homeowner"
                    ? "border-primary bg-primary-soft shadow-soft"
                    : "border-border hover:border-primary/40",
                )}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <Home className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground">I'm a Homeowner</p>
                  <p className="text-sm text-muted-foreground">I hire people for home work</p>
                </div>
              </button>

              <button
                onClick={() => setRole("worker")}
                className={cn(
                  "flex w-full items-start gap-4 rounded-2xl border-2 bg-card p-5 text-left transition-smooth",
                  role === "worker"
                    ? "border-primary bg-primary-soft shadow-soft"
                    : "border-border hover:border-primary/40",
                )}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <Hammer className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground">I'm a Worker</p>
                  <p className="text-sm text-muted-foreground">I do plumbing, painting, carpentry</p>
                </div>
              </button>
            </div>

            <Button
              onClick={handleSaveProfile}
              disabled={!name || !role || isLoading}
              className="mt-8 h-14 w-full rounded-xl text-base font-semibold shadow-glow"
            >
              {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : null}
              Get started
              <ArrowRight className="ml-1 h-5 w-5" />
            </Button>
          </div>
        )}

        <p className="mt-8 text-center text-xs text-muted-foreground">
          By continuing, you agree to our Terms & Privacy
        </p>
      </div>
    </div>
  );
};

export default Onboarding;
