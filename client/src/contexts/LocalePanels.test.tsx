// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LocalMediaPreparationDock } from "../components/diarize/LocalMediaPreparationDock";
import { PlatformDownloadDock } from "../components/diarize/PlatformDownloadDock";
import { TranscriptControls } from "../components/diarize/TranscriptControls";
import { LocaleProvider, useLocale } from "./LocaleContext";

afterEach(() => { cleanup(); localStorage.clear(); });

function Toggle() {
  const { toggleLocale } = useLocale();
  return <button onClick={toggleLocale}>switch</button>;
}

describe("Russian locale panels", () => {
  it("translates processing, exports, platform download, and local preparation controls", async () => {
    render(<LocaleProvider><Toggle /><p>Uploading source</p><TranscriptControls timestamps content="Speaker: Hello" srtContent="1" vttContent="WEBVTT" onTimestampsChange={() => undefined} /><LocalMediaPreparationDock embedded /><PlatformDownloadDock embedded /></LocaleProvider>);
    fireEvent.click(screen.getByRole("button", { name: "switch" }));
    await waitFor(() => expect(screen.getByText("Загрузка источника")).toBeTruthy());
    expect(screen.getByRole("button", { name: "Скачать расшифровку как субтитры SRT" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Подготовить длинное видео" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Сохранить видео" }));
    await waitFor(() => expect(screen.getByLabelText("Публичная ссылка на видео")).toBeTruthy());
  });
});
