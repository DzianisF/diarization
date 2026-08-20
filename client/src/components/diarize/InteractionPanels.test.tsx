// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MediaIntakePanel, ParticipantRenamePanel, SessionHistoryPanel } from "./InteractionPanels";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

describe("Diarize interaction panels", () => {
  it("submits a rights-confirmed direct URL intake", () => {
    const onSubmit = vi.fn();
    render(<MediaIntakePanel onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("button", { name: "Direct URL" }));
    fireEvent.change(screen.getByLabelText("Direct media URL"), { target: { value: "https://cdn.example.org/call.mp3" } });
    fireEvent.click(screen.getByLabelText("Confirm media rights"));
    fireEvent.click(screen.getByRole("button", { name: "Begin analysis" }));
    expect(onSubmit).toHaveBeenCalledWith({ mode: "url", url: "https://cdn.example.org/call.mp3" });
  });

  it("saves a participant rename and selects a session history entry", () => {
    const onSave = vi.fn(); const onOpen = vi.fn();
    render(<><ParticipantRenamePanel initialName="Speaker 1" onSave={onSave} /><SessionHistoryPanel jobs={[{ id: "job-a", title: "Call A" }]} onOpen={onOpen} /></>);
    fireEvent.change(screen.getByLabelText("Participant name"), { target: { value: "Alice" } });
    fireEvent.click(screen.getByRole("button", { name: "Save participant" }));
    fireEvent.click(screen.getByRole("button", { name: "Call A" }));
    expect(onSave).toHaveBeenCalledWith("Alice");
    expect(onOpen).toHaveBeenCalledWith("job-a");
  });
});
