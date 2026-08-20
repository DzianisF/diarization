// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LOCAL_FILE_SELECTED_EVENT } from "./PlatformDownloadDock";
import { LocalCompanionDock } from "./LocalCompanionDock";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("LocalCompanionDock", () => {
  it("checks the localhost companion and creates an authorized local job", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ nonce: "handshake-1" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "job-1", stage: "queued", progress: 0, error: null, filename: null }), { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<LocalCompanionDock embedded />);
    fireEvent.click(screen.getByRole("button", { name: /use local companion/i }));
    fireEvent.change(screen.getByLabelText(/public youtube url/i), { target: { value: "https://www.youtube.com/watch?v=8bMXdkVpHn4" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /prepare with companion/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:38491/v1/jobs", expect.objectContaining({ method: "POST", headers: expect.objectContaining({ "x-diarize-handshake": "handshake-1" }) })));
  });

  it("hands companion audio back to Diarize when the local job is ready", async () => {
    const received: File[] = [];
    window.addEventListener(LOCAL_FILE_SELECTED_EVENT, event => received.push((event as CustomEvent<File>).detail), { once: true });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ nonce: "handshake-2" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "job-2", stage: "ready", progress: 100, error: null, filename: "speech.mp3" }), { status: 202 }))
      .mockResolvedValueOnce(new Response("audio", { status: 200, headers: { "content-type": "audio/mpeg" } }));
    vi.stubGlobal("fetch", fetchMock);
    render(<LocalCompanionDock embedded />);
    fireEvent.click(screen.getByRole("button", { name: /use local companion/i }));
    fireEvent.change(screen.getByLabelText(/public youtube url/i), { target: { value: "https://www.youtube.com/watch?v=8bMXdkVpHn4" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /prepare with companion/i }));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    await waitFor(() => expect(received[0]?.name).toBe("speech.mp3"));
    expect(received[0]?.type).toBe("audio/mpeg");
  });

  it("turns a browser fetch failure into startup instructions", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    render(<LocalCompanionDock embedded />);
    fireEvent.click(screen.getByRole("button", { name: /use local companion/i }));
    fireEvent.change(screen.getByLabelText(/public youtube url/i), { target: { value: "https://www.youtube.com/watch?v=8bMXdkVpHn4" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /prepare with companion/i }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/start it in the repository/i));
    expect(screen.getByRole("note").textContent).toMatch(/npm start/);
  });

  it("explains when browser local-network permission has been denied", async () => {
    Object.defineProperty(navigator, "permissions", { configurable: true, value: { query: vi.fn().mockResolvedValue({ state: "denied" }) } });
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    render(<LocalCompanionDock embedded />);
    fireEvent.click(screen.getByRole("button", { name: /use local companion/i }));
    fireEvent.change(screen.getByLabelText(/public youtube url/i), { target: { value: "https://www.youtube.com/watch?v=8bMXdkVpHn4" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /prepare with companion/i }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/local-network access/i));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
