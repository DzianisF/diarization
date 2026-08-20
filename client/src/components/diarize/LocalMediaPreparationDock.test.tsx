// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LOCAL_FILE_SELECTED_EVENT } from "./PlatformDownloadDock";
import { LocalMediaPreparationDock } from "./LocalMediaPreparationDock";

afterEach(() => cleanup());

describe("LocalMediaPreparationDock", () => {
  it("hands an already compliant local file to Diarize without client compression", () => {
    const received = vi.fn();
    window.addEventListener(LOCAL_FILE_SELECTED_EVENT, received as EventListener);
    render(<LocalMediaPreparationDock />);
    fireEvent.click(screen.getByRole("button", { name: /prepare long video/i }));
    const file = new File([new Uint8Array(1_024)], "brief-call.webm", { type: "video/webm" });
    fireEvent.change(screen.getByLabelText(/choose a long video to prepare/i), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: /use in diarize/i }));
    expect(received).toHaveBeenCalledTimes(1);
    window.removeEventListener(LOCAL_FILE_SELECTED_EVENT, received as EventListener);
  });
});
