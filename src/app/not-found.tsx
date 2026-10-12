import Link from "next/link";
import { buttonStyles } from "@/components/button-styles";

export default function NotFound() {
  return (
    <div className="flex flex-col items-start gap-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">This page does not exist</h1>
      <p className="text-sm text-muted-foreground">It may have been removed, or the link has a typo.</p>
      <Link href="/" className={`${buttonStyles.base} ${buttonStyles.secondary}`}>
        Back to Overview
      </Link>
    </div>
  );
}
