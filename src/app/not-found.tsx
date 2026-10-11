import Link from "next/link";
import { buttonStyles } from "@/components/button-styles";

export default function NotFound() {
  return (
    <div className="flex flex-col items-start gap-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">This Short does not exist</h1>
      <p className="text-sm text-muted">It may have been removed, or the link has a typo.</p>
      <Link href="/shorts" className={`${buttonStyles.base} ${buttonStyles.secondary}`}>
        Back to Shorts
      </Link>
    </div>
  );
}
