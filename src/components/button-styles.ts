/** Shared button classes. Kept outside "use client" files so server components can use them too. */
export const buttonStyles = {
  base: "inline-flex h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3.5 text-sm font-medium transition-[background-color,border-color,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
  primary: "bg-primary text-primary-foreground hover:brightness-95",
  secondary: "border border-border bg-card text-foreground hover:border-border-strong hover:bg-secondary",
};
