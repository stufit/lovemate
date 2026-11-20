import { notFound } from "next/navigation";
import { SessionFlow } from "@/components/session-flow";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "우리의 이야기",
  robots: { index: false, follow: false },
};
export default async function SessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string; screen: string }>;
  searchParams: Promise<{ invite?: string }>;
}) {
  const { sessionId, screen } = await params;
  const { invite } = await searchParams;
  if (
    ![
      "survey",
      "join",
      "my-result",
      "waiting",
      "result",
      "report",
      "checkout",
    ].includes(screen) ||
    !/^[0-9a-f-]{36}$/i.test(sessionId)
  )
    notFound();
  return (
    <SessionFlow
      key={`${sessionId}-${screen}`}
      sessionId={sessionId}
      screen={screen}
      invite={typeof invite === "string" ? invite : undefined}
    />
  );
}
