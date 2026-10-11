import { FilmStrip, Newspaper, PaperPlaneTilt, SquaresFour } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { NavLink } from "@/components/nav-link";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "PilotTube", template: "%s | PilotTube" },
  description: "Daily AI news Shorts, written, voiced and cut automatically.",
};

const NAV = [
  { href: "/", label: "Overview", icon: <SquaresFour size={18} /> },
  { href: "/shorts", label: "Shorts", icon: <FilmStrip size={18} /> },
  { href: "/news", label: "News queue", icon: <Newspaper size={18} /> },
];

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-accent-ink">
      <span className="grid size-8 place-items-center rounded-lg bg-accent text-accent-fg">
        <PaperPlaneTilt size={18} weight="fill" />
      </span>
      <span className="text-[15px] font-semibold tracking-tight">PilotTube</span>
    </Link>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <div className="flex min-h-[100dvh]">
          <aside className="sticky top-0 hidden h-[100dvh] w-60 shrink-0 flex-col gap-8 border-r border-line bg-surface px-4 py-5 lg:flex">
            <Brand />
            <nav className="flex flex-col gap-0.5" aria-label="Main">
              {/* The active highlight needs the URL, which is request-time data; render plain links until it streams in. */}
              <Suspense
                fallback={NAV.map((item) => (
                  <Link key={item.href} href={item.href} className="flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm text-muted">
                    {item.icon}
                    {item.label}
                  </Link>
                ))}
              >
                {NAV.map((item) => (
                  <NavLink key={item.href} href={item.href} icon={item.icon}>
                    {item.label}
                  </NavLink>
                ))}
              </Suspense>
            </nav>
            <p className="mt-auto text-xs leading-relaxed text-subtle">
              Agnes writes, Deepgram speaks, Pexels shoots, HyperFrames designs.
            </p>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b border-line bg-surface/90 px-4 backdrop-blur lg:hidden">
              <Brand />
              <nav className="flex items-center gap-0.5" aria-label="Main">
                {NAV.map((item) => (
                  <Link key={item.href} href={item.href} aria-label={item.label} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg">
                    {item.icon}
                  </Link>
                ))}
              </nav>
            </header>
            <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
