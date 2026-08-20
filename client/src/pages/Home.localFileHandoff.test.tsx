// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LOCAL_FILE_SELECTED_EVENT } from "../components/diarize/PlatformDownloadDock";
import { LocaleProvider } from "../contexts/LocaleContext";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

const mocks = vi.hoisted(() => ({
  list: vi.fn(() => ({ data: [], refetch: vi.fn() })),
  get: vi.fn(() => ({ data: undefined, refetch: vi.fn() })),
  mutation: vi.fn(() => ({ isPending: false, mutate: vi.fn(), mutateAsync: vi.fn() })),
  createMutation: { isPending: false, mutate: vi.fn(), mutateAsync: vi.fn() },
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    jobs: {
      list: { useQuery: mocks.list },
      get: { useQuery: mocks.get },
      create: { useMutation: () => mocks.createMutation },
      advance: { useMutation: mocks.mutation },
      renameSpeaker: { useMutation: mocks.mutation },
      suggestRoles: { useMutation: mocks.mutation },
    },
  },
}));

vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess, error: mocks.toastError } }));
vi.mock("../lib/session", () => ({ getSessionId: () => "test-session" }));

import Home from "./Home";

describe("Home local-file handoff", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mocks.createMutation.mutateAsync.mockResolvedValue({ job: { id: "new-job" } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  });
  afterEach(() => cleanup());

  it("switches the visible intake controls to Russian", async () => {
    render(<LocaleProvider><Home /></LocaleProvider>);
    fireEvent.click(screen.getByRole("button", { name: /переключить интерфейс на русский/i }));
    await waitFor(() => expect(screen.getByText("Начать анализ")).toBeTruthy());
    expect(screen.getByText("Локальный файл")).toBeTruthy();
    expect(screen.getByText("Необязательные имена участников")).toBeTruthy();
  });

  it("returns from direct URL mode to a valid local-file submission after a saved file is selected", async () => {
    render(<LocaleProvider><Home /></LocaleProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Direct URL" }));
    expect(screen.getByLabelText("Direct public media URL")).toBeTruthy();

    const savedFile = new File(["media"], "saved-session.webm", { type: "video/webm" });
    act(() => window.dispatchEvent(new CustomEvent<File>(LOCAL_FILE_SELECTED_EVENT, { detail: savedFile })));

    expect(screen.queryByLabelText("Direct public media URL")).toBeNull();
    expect(screen.getByText("saved-session.webm")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Begin analysis" })).toBeTruthy();
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Local file selected. Confirm rights and begin analysis when ready.");

    fireEvent.click(screen.getByRole("checkbox"));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Begin analysis" })));
    expect(mocks.createMutation.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: "test-session",
      sourceType: "upload",
      sourceName: "saved-session.webm",
      rightsConfirmed: true,
    }));
    expect(globalThis.fetch).toHaveBeenCalledWith("/api/media-upload", expect.objectContaining({ method: "POST" }));
  });
});
