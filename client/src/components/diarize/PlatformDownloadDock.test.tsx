import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { LOCAL_FILE_SELECTED_EVENT, PlatformDownloadDock } from "./PlatformDownloadDock";

describe("PlatformDownloadDock", () => {
  it("enables a browser-download link only after a public URL and rights confirmation", () => {
    render(<PlatformDownloadDock />);
    fireEvent.click(screen.getByRole("button", { name: /save a video/i }));
    const input = screen.getByLabelText(/public video url/i);
    fireEvent.change(input, { target: { value: "https://www.youtube.com/watch?v=aqz-KE-bpKQ" } });
    fireEvent.click(screen.getByRole("checkbox"));
    const link = screen.getByRole("link", { name: /save video to device/i });
    expect(link.getAttribute("href")).toContain("/api/platform-download?");
    expect(link.getAttribute("href")).toContain("rights=true");
  });

  it("hands a user-selected saved file back to the diarization intake", () => {
    const received = vi.fn();
    window.addEventListener(LOCAL_FILE_SELECTED_EVENT, received as EventListener);
    render(<PlatformDownloadDock />);
    fireEvent.click(screen.getByRole("button", { name: /save a video/i }));
    const file = new File(["video"], "saved-video.webm", { type: "video/webm" });
    const fileInput = screen.getAllByLabelText(/choose a saved file for diarize/i).find(element => element instanceof HTMLInputElement && element.type === "file");
    fireEvent.change(fileInput as HTMLInputElement, { target: { files: [file] } });
    expect(received).toHaveBeenCalledTimes(1);
    window.removeEventListener(LOCAL_FILE_SELECTED_EVENT, received as EventListener);
  });
});
