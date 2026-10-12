"use client";

import {
  Article,
  CalendarBlank,
  ChartLineUp,
  FilmStrip,
  FlowArrow,
  Gear,
  ImageSquare,
  Lightbulb,
  MusicNotes,
  PaperPlaneTilt,
  Play,
  SquaresFour,
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ComponentType } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";

type NavItem = { href: string; label: string; Icon: ComponentType<{ className?: string }>; soon?: boolean };

const WORKSPACE: NavItem[] = [
  { href: "/", label: "Overview", Icon: SquaresFour },
  { href: "/research", label: "Research", Icon: Lightbulb },
  { href: "/planner", label: "Planner", Icon: CalendarBlank, soon: true },
  { href: "/shorts", label: "Scripts", Icon: Article },
  { href: "/studio", label: "Video studio", Icon: FilmStrip },
  { href: "/music", label: "Music", Icon: MusicNotes },
  { href: "/thumbnails", label: "Thumbnails", Icon: ImageSquare },
  { href: "/publishing", label: "Publishing", Icon: PaperPlaneTilt },
  { href: "/analytics", label: "Analytics", Icon: ChartLineUp },
  { href: "/workflows", label: "Workflows", Icon: FlowArrow, soon: true },
];

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ items, pathname }: { items: NavItem[]; pathname: string | null }) {
  return (
    <SidebarMenu>
      {items.map(({ href, label, Icon, soon }) => (
        <SidebarMenuItem key={href}>
          <SidebarMenuButton asChild isActive={isActive(pathname, href)} tooltip={label}>
            <Link href={href}>
              <Icon />
              <span>{label}</span>
            </Link>
          </SidebarMenuButton>
          {soon && <SidebarMenuBadge className="text-[10px] font-normal text-subtle">Soon</SidebarMenuBadge>}
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

/** The current URL is request-time data, so the active highlight streams in after the static shell. */
function ActiveNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return <NavLinks items={items} pathname={pathname} />;
}

function Nav({ items }: { items: NavItem[] }) {
  return (
    <Suspense fallback={<NavLinks items={items} pathname={null} />}>
      <ActiveNav items={items} />
    </Suspense>
  );
}

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-16 justify-center border-b border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild className="hover:bg-transparent active:bg-transparent">
              <Link href="/">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
                  <Play weight="fill" className="size-4" />
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="text-[15px] font-semibold tracking-tight">PilotTube</span>
                  <span className="text-xs text-muted-foreground">AI YouTube Studio</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] tracking-wide uppercase">Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <Nav items={WORKSPACE} />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator className="mx-0" />
      <SidebarFooter>
        <Nav items={[{ href: "/settings", label: "Settings", Icon: Gear }]} />
      </SidebarFooter>
    </Sidebar>
  );
}
