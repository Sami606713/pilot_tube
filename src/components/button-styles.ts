/** Shared button classes. Kept outside "use client" files so server components can use them too. */
export const buttonStyles = {
  base: "inline-flex h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3.5 text-sm font-medium transition-[background-color,border-color,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink",
  primary: "bg-accent text-accent-fg hover:brightness-95",
  secondary: "border border-line bg-surface text-fg hover:border-line-strong hover:bg-surface-2",
};
