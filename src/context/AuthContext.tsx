import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { DBUser } from "@/lib/mock-data";

interface AuthContextValue {
  session: Session | null;
  user: DBUser | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<DBUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async (currentSession: Session | null) => {
    if (!currentSession?.user) {
      setUser(null);
      return;
    }
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", currentSession.user.id)
      .single();

    if (error) {
      console.error("Error fetching user profile:", error);
    } else {
      setUser(data);
    }
  };

  const refreshUser = async () => {
    await fetchUser(session);
  };

  useEffect(() => {
    // Initial fetch
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      fetchUser(currentSession).finally(() => setLoading(false));
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      fetchUser(currentSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, refreshUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
