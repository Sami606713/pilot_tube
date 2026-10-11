"use client";

import { CaretDown, CaretUp } from "@phosphor-icons/react";
import { useState } from "react";
import type { VideoStat } from "@/lib/youtube/analytics";

type SortKey = "publishedAt" | "views" | "likes" | "comments" | "durationSeconds";

const COLUMNS: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "publishedAt", label: "Published" },
  { key: "durationSeconds", label: "Length", align: "right" },
  { key: "views", label: "Views", align: "right" },
  { key: "likes", label: "Likes", align: "right" },
  { key: "comments", label: "Comments", align: "right" },
];

const length = (s: number) => (s === 0 ? "Live" : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);
const date = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/** Every recent upload; click a column to sort and see what works best. */
export function VideosTable({ videos }: { videos: VideoStat[] }) {
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "publishedAt", desc: true });
  const rows = [...videos].sort((a, b) => {
    const diff = sort.key === "publishedAt" ? a.publishedAt.localeCompare(b.publishedAt) : a[sort.key] - b[sort.key];
    return sort.desc ? -diff : diff;
  });

  if (videos.length === 0) return <p className="text-sm text-muted-foreground">No uploads yet.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th className="py-2 pr-3 text-left font-medium">Video</th>
            {COLUMNS.map((c) => {
              const active = sort.key === c.key;
              return (
                <th key={c.key} className={`px-3 py-2 font-medium ${c.align === "right" ? "text-right" : "text-left"}`} aria-sort={active ? (sort.desc ? "descending" : "ascending") : "none"}>
                  <button
                    type="button"
                    onClick={() => setSort({ key: c.key, desc: active ? !sort.desc : true })}
                    className={`inline-flex items-center gap-1 hover:text-foreground ${active ? "text-foreground" : ""}`}
                  >
                    {c.label}
                    {active && (sort.desc ? <CaretDown weight="bold" className="size-3" /> : <CaretUp weight="bold" className="size-3" />)}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((v) => (
            <tr key={v.id} className="border-b border-border last:border-0 hover:bg-secondary/40">
              <td className="py-2 pr-3">
                <a href={v.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 hover:text-brand">
                  {v.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element -- YouTube thumbnail
                    <img src={v.thumbnail} alt="" loading="lazy" className="aspect-video w-16 shrink-0 rounded object-cover ring-1 ring-border" />
                  ) : (
                    <span className="aspect-video w-16 shrink-0 rounded bg-secondary" />
                  )}
                  <span className="flex min-w-0 flex-col">
                    <span className="line-clamp-2 max-w-[42ch] font-medium">{v.title}</span>
                    {v.privacy !== "public" && <span className="text-xs text-subtle capitalize">{v.privacy}</span>}
                  </span>
                </a>
              </td>
              <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{date(v.publishedAt)}</td>
              <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">{length(v.durationSeconds)}</td>
              <td className="px-3 py-2 text-right font-medium tabular-nums">{v.views.toLocaleString("en-US")}</td>
              <td className="px-3 py-2 text-right tabular-nums">{v.likes.toLocaleString("en-US")}</td>
              <td className="px-3 py-2 text-right tabular-nums">{v.comments.toLocaleString("en-US")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
