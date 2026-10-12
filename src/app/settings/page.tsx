import { CheckCircle, Circle } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Settings" };

/** Which service each pipeline step needs; only whether a key is set is shown, never the key. */
const SERVICES = [
  { name: "Agnes AI", env: "AGNES_API_KEY", use: "Scripts, scene images and thumbnails" },
  { name: "Deepgram", env: "DEEPGRAM_API_KEY", use: "Voice and word timings" },
  { name: "Composio", env: "COMPOSIO_API_KEY", use: "YouTube channel data and analytics" },
];

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Connected services and channel settings. Values come from .env.local." />
      <Suspense fallback={<div className="skeleton h-80 max-w-3xl rounded-xl" aria-busy="true" />}>
        <SettingsContent />
      </Suspense>
    </>
  );
}

async function SettingsContent() {
  await connection();
  const channel = [
    { label: "Voice", value: process.env.DEEPGRAM_VOICE || "aura-2-thalia-en" },
    { label: "Channel handle", value: process.env.CHANNEL_HANDLE || "Not set" },
    { label: "Card accent", value: process.env.CARD_ACCENT || "#7CFF6B" },
  ];

  return (
    <div className="grid max-w-3xl gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Services</CardTitle>
          <CardDescription>API keys PilotTube uses for each step.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {SERVICES.map((s) => {
              const ok = Boolean(process.env[s.env]);
              return (
                <li key={s.env} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <span className="flex items-center gap-3">
                    {ok ? <CheckCircle weight="fill" className="size-5 text-success" /> : <Circle className="size-5 text-subtle" />}
                    <span className="flex flex-col">
                      <span className="text-sm font-medium">{s.name}</span>
                      <span className="text-xs text-muted-foreground">{s.use}</span>
                    </span>
                  </span>
                  {ok ? (
                    <Badge variant="secondary">Connected</Badge>
                  ) : (
                    <Badge variant="outline" className="font-mono text-[11px]">
                      Add {s.env}
                    </Badge>
                  )}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Channel</CardTitle>
          <CardDescription>Used in every Short. Change them in .env.local.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-3">
            {channel.map((c) => (
              <div key={c.label} className="flex flex-col gap-1">
                <dt className="text-xs text-muted-foreground">{c.label}</dt>
                <dd className="truncate font-mono text-sm">{c.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
