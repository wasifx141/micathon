import { useState, useEffect } from "react";
import { ArrowDownLeft, ArrowUpRight, Receipt, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { formatPKR } from "@/lib/mock-data";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const Wallet = () => {
  const { user, refreshUser, loading: authLoading } = useAuth();
  
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loadingTx, setLoadingTx] = useState(true);
  
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [isToppingUp, setIsToppingUp] = useState(false);

  useEffect(() => {
    if (!user) return;
    
    const fetchTx = async () => {
      setLoadingTx(true);
      const { data, error } = await supabase
        .from("transactions")
        .select(`
          *,
          job:job_id (title)
        `)
        .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (error) {
        toast.error("Failed to load transactions");
      } else {
        setTransactions(data || []);
      }
      setLoadingTx(false);
    };

    fetchTx();
  }, [user]);

  const handleTopUp = async () => {
    if (!user) return;
    const amountNum = Number(topUpAmount);
    if (!amountNum || amountNum <= 0) return;
    
    setIsToppingUp(true);

    const { data: userData } = await supabase.from('users').select('wallet_balance').eq('id', user.id).single();
    if (!userData) {
      setIsToppingUp(false);
      return;
    }

    const newBalance = userData.wallet_balance + amountNum;
    
    // update balance
    await supabase.from('users').update({ wallet_balance: newBalance }).eq('id', user.id);
    
    // insert self-deposit transaction
    await supabase.from('transactions').insert({
      from_user_id: user.id,
      to_user_id: user.id,
      amount: amountNum,
      type: 'deposit',
      job_id: null
    });

    await refreshUser();
    
    // re-fetch local tx list
    setTransactions((prev) => [
      {
        id: Math.random().toString(), // optimistic temporary ID
        from_user_id: user.id,
        to_user_id: user.id,
        amount: amountNum,
        type: 'deposit',
        created_at: new Date().toISOString(),
        job: null
      },
      ...prev
    ]);

    setIsToppingUp(false);
    setTopUpOpen(false);
    setTopUpAmount("");
    toast.success(`Topped up ${formatPKR(amountNum)}`);
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
      <header className="flex items-center justify-between px-5 pt-10 pb-4">
        <h1 className="font-serif text-3xl text-foreground">Wallet</h1>
      </header>

      {/* Balance */}
      <section className="px-5">
        <div className="rounded-3xl bg-gradient-primary p-6 text-primary-foreground shadow-glow">
          <p className="text-sm opacity-90">
            {user.role === "homeowner" ? "Current balance" : "Total earnings"}
          </p>
          <p className="mt-2 font-serif text-5xl tabular-nums">
            {formatPKR(user.wallet_balance || 0)}
          </p>
          <button 
             onClick={() => user.role === 'homeowner' ? setTopUpOpen(true) : toast.info("Withdrawals simulated (coming soon)")}
             className="mt-5 rounded-full bg-white/15 px-4 py-2 text-sm font-medium backdrop-blur hover:bg-white/25">
            {user.role === "homeowner" ? "+ Top up wallet" : "Withdraw to bank"}
          </button>
        </div>
      </section>

      {/* Transactions */}
      <section className="mt-8 px-5 pb-20">
        <h2 className="mb-3 text-base font-semibold text-foreground">Transactions</h2>

        {loadingTx ? (
          <div className="flex justify-center p-8">
             <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card/50 p-10 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <Receipt className="h-7 w-7 text-primary" />
            </div>
            <p className="font-medium text-foreground">No transactions yet</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-card shadow-soft">
            {transactions.map((tx, idx) => {
              // Determine direction
              let direction: "in" | "out" = "out";
              let desc = "Transaction";
              
              if (tx.type === "platform_fee") {
                direction = "out";
                desc = "Platform Fee";
              } else if (tx.to_user_id === user.id && tx.from_user_id === user.id) {
                // Self-deposit
                direction = "in";
                desc = "Wallet Top Up";
              } else if (tx.to_user_id === user.id) {
                direction = "in";
                desc = "Payment Received";
              } else {
                direction = "out";
                desc = tx.type === 'deposit' ? "Escrow Funded" : "Payment Sent";
              }

              return (
                <div
                  key={tx.id}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3.5",
                    idx !== transactions.length - 1 && "border-b border-border",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                      direction === "in" ? "bg-success/10" : "bg-muted",
                    )}
                  >
                    {direction === "in" ? (
                      <ArrowDownLeft className="h-5 w-5 text-success" />
                    ) : (
                      <ArrowUpRight className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate text-sm font-medium", tx.type === 'platform_fee' ? "text-muted-foreground" : "text-foreground")}>
                      {desc}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {tx.job?.title ? `${tx.job.title} · ` : ""}{formatDate(tx.created_at)}
                    </p>
                  </div>
                  <p
                    className={cn(
                      "shrink-0 text-sm font-semibold tabular-nums",
                      tx.type === 'platform_fee' ? "text-muted-foreground" : 
                      direction === "in" ? "text-success" : "text-foreground",
                    )}
                  >
                    {direction === "in" ? "+" : "−"}
                    {formatPKR(tx.amount)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <Dialog open={topUpOpen} onOpenChange={setTopUpOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Top Up Wallet</DialogTitle>
            <DialogDescription>
              Enter the amount to simulate a deposit.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base font-semibold text-muted-foreground">
                PKR
              </span>
              <Input
                type="number"
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(e.target.value)}
                placeholder="0"
                className="h-16 rounded-xl pl-16 text-2xl font-semibold tabular-nums"
                disabled={isToppingUp}
              />
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setTopUpOpen(false)}
                className="h-12 flex-1 rounded-xl"
                disabled={isToppingUp}
              >
                Cancel
              </Button>
              <Button
                onClick={handleTopUp}
                disabled={!topUpAmount || isToppingUp}
                className="h-12 flex-1 rounded-xl shadow-glow"
              >
                {isToppingUp ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                Confirm
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};

export default Wallet;
