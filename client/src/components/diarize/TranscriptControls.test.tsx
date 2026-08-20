// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ copyTranscript: vi.fn(), downloadTranscript: vi.fn() }));
vi.mock("@/lib/transcript", () => ({ copyTranscript: mocks.copyTranscript, downloadTranscript: mocks.downloadTranscript }));
import { TranscriptControls } from "./TranscriptControls";

describe("TranscriptControls", () => {
  beforeEach(() => vi.clearAllMocks());

  it("toggles timestamps and sends the same content to copy and TXT download actions", () => {
    const onTimestampsChange = vi.fn();
    render(<TranscriptControls timestamps content="[00:00:01] Alice: Hello." onTimestampsChange={onTimestampsChange} />);
    fireEvent.click(screen.getByRole("switch"));
    fireEvent.click(screen.getByRole("button", { name: "Copy transcript" }));
    fireEvent.click(screen.getByRole("button", { name: "Download transcript as text" }));
    expect(onTimestampsChange).toHaveBeenCalledWith(false);
    expect(mocks.copyTranscript).toHaveBeenCalledWith("[00:00:01] Alice: Hello.");
    expect(mocks.downloadTranscript).toHaveBeenCalledWith("diarize-transcript.txt", "[00:00:01] Alice: Hello.");
  });
});
