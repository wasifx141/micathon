import { ReactNode } from "react";
import { BottomNav } from "@/components/BottomNav";

interface AppShellProps {
  children: ReactNode;
  hideNav?: boolean;
}

export const AppShell = ({ children, hideNav }: AppShellProps) => {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto min-h-screen w-full max-w-md bg-background pb-24">
        {children}
      </div>
      {!hideNav && <BottomNav />}
    </div>
  );
};
