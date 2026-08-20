// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ copyTranscript: vi.fn(), downloadTranscript: vi.fn() }));
vi.mock("@/lib/transcript", () => ({ copyTranscript: mocks.copyTranscript, downloadTranscript: mocks.downloadTranscript }));
import { TranscriptControls } from "./TranscriptControls";

describe("TranscriptControls", () => {
  beforeEach(() => vi.clearAllMocks());

  it("toggles timestamps and sends TXT, SRT, and VTT exports with their matching extensions", () => {
    const onTimestampsChange = vi.fn();
    render(<TranscriptControls timestamps content="[00:00:01] Alice: Hello." srtContent="1\n00:00:01,000 --> 00:00:02,000\nAlice: Hello." vttContent="WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nAlice: Hello." onTimestampsChange={onTimestampsChange} />);
    fireEvent.click(screen.getByRole("switch"));
    fireEvent.click(screen.getByRole("button", { name: "Copy transcript" }));
    fireEvent.click(screen.getByRole("button", { name: "Download transcript as text" }));
    fireEvent.click(screen.getByRole("button", { name: "Download transcript as SRT subtitles" }));
    fireEvent.click(screen.getByRole("button", { name: "Download transcript as WebVTT subtitles" }));
    expect(onTimestampsChange).toHaveBeenCalledWith(false);
    expect(mocks.copyTranscript).toHaveBeenCalledWith("[00:00:01] Alice: Hello.");
    expect(mocks.downloadTranscript).toHaveBeenCalledWith("diarize-transcript.txt", "[00:00:01] Alice: Hello.");
    expect(mocks.downloadTranscript).toHaveBeenCalledWith("diarize-transcript.srt", expect.stringContaining("00:00:01,000"));
    expect(mocks.downloadTranscript).toHaveBeenCalledWith("diarize-transcript.vtt", expect.stringContaining("WEBVTT"));
  });
});
