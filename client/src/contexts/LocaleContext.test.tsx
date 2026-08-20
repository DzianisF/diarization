// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LocaleProvider, translateInterfaceText, useLocale } from "./LocaleContext";

afterEach(() => localStorage.clear());

function LocaleFixture() {
  const { locale, toggleLocale } = useLocale();
  return <div><button onClick={toggleLocale}>switch</button><p>{locale}</p><span>Begin analysis</span></div>;
}

describe("interface locale dictionary", () => {
  it("translates the central intake actions in both directions", () => {
    expect(translateInterfaceText("Begin analysis", "ru")).toBe("Начать анализ");
    expect(translateInterfaceText("Начать анализ", "en")).toBe("Begin analysis");
    expect(translateInterfaceText("Save a video", "ru")).toBe("Сохранить видео");
    expect(translateInterfaceText("Saving the verified response · 42%.", "ru")).toBe("Сохранение подтверждённого ответа · 42%.");
    expect(translateInterfaceText("The video stream could not start.", "ru")).toBe("Видеопоток не удалось запустить.");
    expect(translateInterfaceText("Browser audio preparation stopped unexpectedly.", "ru")).toBe("Подготовка аудио в браузере неожиданно остановилась.");
    expect(translateInterfaceText("meeting.mp4 · 18.0 MB — needs preparation for the 16 MB limit", "ru")).toBe("meeting.mp4 · 18.0 MB — требуется подготовка для лимита 16 МБ");
  });

  it("switches rendered interface text and persists the Russian choice", async () => {
    render(<LocaleProvider><LocaleFixture /></LocaleProvider>);
    fireEvent.click(screen.getByRole("button", { name: "switch" }));
    await waitFor(() => expect(screen.getByText("Начать анализ")).toBeTruthy());
    expect(localStorage.getItem("diarize.locale")).toBe("ru");
  });
});
