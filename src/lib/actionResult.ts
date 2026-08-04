/**
 * Result shape for server actions that can fail on a business rule.
 *
 * Throwing inside a server action surfaces to the browser as an opaque
 * HTTP 500 with only a digest, hiding the reason from the user. Rules
 * like gatekeeping, the release gate, and discount authority are
 * expected outcomes rather than crashes, so they travel back as data and
 * get rendered inline.
 *
 * Lives outside the "use server" modules because those may only export
 * async functions.
 */
export interface ActionResult {
  ok: boolean;
  error?: string;
}

/** True for the control-flow exceptions Next.js throws (redirect, notFound). */
export function isNextControlFlowError(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "digest" in e &&
    String((e as { digest?: string }).digest).startsWith("NEXT_")
  );
}

export function toActionError(e: unknown, fallback: string): ActionResult {
  return {
    ok: false,
    error: e instanceof Error ? e.message : fallback,
  };
}
