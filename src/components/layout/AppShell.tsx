import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";

/**
 * App-shell layout for the authenticated screens (/dashboard, /tasks):
 * sidebar + scrollable content area. The marketing Nav is hidden on these
 * routes (see Nav.tsx) so this is the only chrome above `children`.
 */
export function AppShell({ userLabel, children }: { userLabel: string; children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1">
      <Sidebar userLabel={userLabel} />
      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
