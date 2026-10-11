import { Bell } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ProfileMenu } from "@/components/profile-menu";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { timeAgo } from "@/lib/format";
import { listShorts } from "@/lib/shorts";

function BellButton() {
  return (
    <Button variant="ghost" size="icon" aria-label="Activity">
      <Bell className="size-5" />
    </Button>
  );
}

/** Real pipeline activity: newest scripts and renders. */
async function ActivityMenu() {
  await connection();
  const recent = listShorts(5);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <BellButton />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Recent activity</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {recent.length === 0 && <p className="px-2 py-3 text-sm text-muted-foreground">Nothing yet. Create your first Short.</p>}
        {recent.map((short) => (
          <DropdownMenuItem key={short.id} asChild>
            <Link href={`/shorts/${short.id}`} className="flex flex-col items-start gap-0.5">
              <span className="line-clamp-1 text-sm">{short.title}</span>
              <span className="text-xs text-muted-foreground">
                {short.renderedAt ? `Rendered ${timeAgo(short.renderedAt)}` : `Script written ${timeAgo(short.createdAt)}`}
              </span>
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TopBar() {
  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-2 border-b border-border bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:px-6">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 data-vertical:h-5 data-vertical:self-center" />
      <div className="ml-auto flex items-center gap-1">
        <Suspense fallback={<BellButton />}>
          <ActivityMenu />
        </Suspense>
        <ProfileMenu />
      </div>
    </header>
  );
}
