import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

beforeEach(() => {
  // user-event@14's setup() unconditionally installs its own navigator.clipboard
  // stub (overriding any pre-installed vi.fn). Pre-installing the stub here means
  // subsequent userEvent.setup() calls inside tests hit the isClipboardStub
  // early-return, and our vi.spyOn on writeText survives intact for assertions.
  userEvent.setup();
  vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
