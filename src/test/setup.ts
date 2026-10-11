import { afterEach } from "vitest";

// Component tests (jsdom) get the DOM matchers and automatic cleanup; the
// pure-logic tests run in node and skip this.
if (typeof document !== "undefined") {
  await import("@testing-library/jest-dom/vitest");
  const { cleanup } = await import("@testing-library/react");
  afterEach(() => cleanup());
}
