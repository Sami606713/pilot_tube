import { ArrowSquareOut, DotsThree, DownloadSimple, FilmSlate, FolderOpen } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { NewShortButton } from "@/components/shorts-list";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { timeAgo } from "@/lib/format";
import { shortStatus, type ShortSummary } from "@/lib/shorts";

const TONE: Record<ReturnType<typeof shortStatus>["tone"], string> = {
  muted: "text-muted-foreground",
  progress: "text-muted-foreground",
  ready: "text-brand",
  done: "text-success",
};

export function RecentVideos({ shorts }: { shorts: ShortSummary[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent videos</CardTitle>
        {shorts.length > 0 && (
          <CardAction>
            <Link href="/shorts" className="text-sm text-muted-foreground hover:text-foreground">
              View all
            </Link>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="px-2 sm:px-3">
        {shorts.length === 0 ? (
          <div className="flex flex-col items-start gap-3 px-2 py-6">
            <p className="text-sm text-muted-foreground">No videos yet. PilotTube writes the first one from today&apos;s AI news.</p>
            <NewShortButton />
          </div>
        ) : (
          <ul className="flex flex-col">
            {shorts.map((short) => {
              const status = shortStatus(short);
              return (
                <li key={short.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-secondary/60">
                  <Link href={`/shorts/${short.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="relative grid aspect-[9/16] w-9 shrink-0 place-items-center overflow-hidden rounded-md bg-secondary ring-1 ring-border">
                      {short.thumbUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- local 270px poster
                        <img src={short.thumbUrl} alt="" loading="lazy" className="size-full object-cover" />
                      ) : (
                        <FilmSlate className="size-4 text-muted-foreground" />
                      )}
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate text-sm font-medium">{short.title}</span>
                      <span className="text-xs">
                        <span className={TONE[status.tone]}>{status.label}</span>
                        <span className="text-subtle"> / {timeAgo(short.createdAt)}</span>
                      </span>
                    </span>
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label={`Actions for ${short.title}`}>
                        <DotsThree weight="bold" className="size-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem asChild>
                        <Link href={`/shorts/${short.id}`}>
                          <FolderOpen /> Open
                        </Link>
                      </DropdownMenuItem>
                      {short.renderedAt && (
                        <DropdownMenuItem asChild>
                          <a href={`/api/script/${short.id}/video?download=1&v=${encodeURIComponent(short.renderedAt)}`}>
                            <DownloadSimple /> Download MP4
                          </a>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <a href={short.storyUrl} target="_blank" rel="noreferrer">
                          <ArrowSquareOut /> Source article
                        </a>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
