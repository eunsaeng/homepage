import type { Metadata } from "next";
import { HarnessDashboard } from "./dashboard";

export const metadata: Metadata = { title: "개발 하네스 대시보드" };

// Local development tool: reads .harness/ from disk through the local-only /api/harness routes.
export default function HarnessPage() {
  return <HarnessDashboard />;
}
