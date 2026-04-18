import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, ArrowRight, Home, Hammer, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Role } from "@/lib/mock-data"; // imported from mock-data/types

type Step = "phone" | "otp" | "profile";

const formatPhone = (p: string) => {
  let clean = p.replace(/\D/g, "");
  if (clean.startsWith("0")) {
    return "+92" + clean.slice(1);
  }
  if (!clean.startsWith("+")) {
    return "+" + clean;
  }
  return clean;
};

const Onboarding = () => {
  const navigate = useNavigate();
  const { session, user, loading: authLoading, refreshUser } = useAuth();
  
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
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

  const handleSendCode = async () => {
    setIsLoading(true);
    const formatted = formatPhone(phone);
    const { error } = await supabase.auth.signInWithOtp({
      phone: formatted,
    });
    setIsLoading(false);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Verification code sent");
      setStep("otp");
    }
  };

  const handleVerifyOtp = async () => {
    setIsLoading(true);
    const formatted = formatPhone(phone);
    const { data: authData, error } = await supabase.auth.verifyOtp({
      phone: formatted,
      token: otp,
      type: 'sms'
    });
    
    if (error) {
      setIsLoading(false);
      toast.error(error.message);
      return;
    }

    // Upsert into users table
    if (authData?.user) {
      const { error: upsertError } = await supabase.from('users').upsert({
        id: authData.user.id,
        phone: formatted,
      }, { onConflict: 'id' });

      if (upsertError) {
        console.error("Error upserting user:", upsertError);
      }
      
      await refreshUser();
    }
    
    setIsLoading(false);
    // UseEffect will catch the session and redirect or move to profile
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

        {step === "phone" && (
          <div className="flex-1">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
              Welcome
            </p>
            <h2 className="font-serif text-3xl leading-tight text-foreground">
              Sign in to <span className="italic">Nighabaan</span>
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Enter your phone number — we'll send you a verification code.
            </p>

            <div className="mt-8 space-y-4">
              <label className="block text-sm font-medium text-foreground">
                Phone number
              </label>
              <Input
                type="tel"
                placeholder="03XX XXXXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-14 rounded-xl text-base"
              />
              <Button
                onClick={handleSendCode}
                disabled={phone.length < 10 || isLoading}
                className="h-14 w-full rounded-xl text-base font-semibold shadow-glow"
              >
                {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : null}
                Send verification code
                <ArrowRight className="ml-1 h-5 w-5" />
              </Button>
            </div>
          </div>
        )}

        {step === "otp" && (
          <div className="flex-1">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
              Verify
            </p>
            <h2 className="font-serif text-3xl leading-tight text-foreground">
              Enter the <span className="italic">code</span>
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              We sent a 6-digit code to <span className="font-medium text-foreground">{phone || "your phone"}</span>.
            </p>

            <div className="mt-8 space-y-4">
              <Input
                inputMode="numeric"
                maxLength={6}
                placeholder="••••••"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                className="h-16 rounded-xl text-center text-2xl font-semibold tracking-[0.5em]"
              />
              <Button
                onClick={handleVerifyOtp}
                disabled={otp.length < 4 || isLoading}
                className="h-14 w-full rounded-xl text-base font-semibold shadow-glow"
              >
                {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : null}
                Verify & continue
              </Button>
              <button
                onClick={() => setStep("phone")}
                disabled={isLoading}
                className="block w-full text-center text-sm text-muted-foreground hover:text-primary disabled:opacity-50"
              >
                Change phone number
              </button>
            </div>
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
