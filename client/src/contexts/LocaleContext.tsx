import React, { createContext, useContext, useEffect, useState } from "react";

export type Locale = "en" | "ru";

const translations: Record<string, string> = {
  "Private session workspace": "Личное рабочее пространство",
  "YouTube links are supported on a best-effort basis: Diarize attempts to fetch the lightest available public audio stream. If the platform blocks access or a file exceeds the limit, upload the permitted audio/video file instead.": "Ссылки YouTube поддерживаются в best-effort режиме: Diarize пытается получить самый лёгкий общедоступный аудиопоток. Если платформа блокирует доступ или файл превышает лимит, загрузите разрешённый аудио- или видеофайл.",
  "Archive": "Архив", "This session": "Эта сессия", "Start a transcription": "Начать расшифровку", "Turn a conversation into a considered record.": "Превратите разговор в структурированную запись.",
  "Upload a recording or provide a direct public file URL. We will extract audio, transcribe the dialogue, and separate the participating voices.": "Загрузите запись или укажите прямую публичную ссылку на файл. Мы извлечём звук, расшифруем диалог и разделим голоса участников.",
  "Local file": "Локальный файл", "Direct URL": "Прямая ссылка", "Choose an audio or video file": "Выберите аудио- или видеофайл", "Optional participant names": "Необязательные имена участников",
  "Names are applied in the first-detected speaker order after diarization and can still be edited later.": "Имена применяются к первым обнаруженным говорящим после диаризации; их можно изменить позже.",
  "I confirm I have the right to process this recording and the URL, if used, points directly to the media file.": "Я подтверждаю право на обработку записи; при использовании ссылка ведёт непосредственно к медиафайлу.",
  "Begin analysis": "Начать анализ", "Participants": "Участники", "Voices in focus": "Голоса в фокусе", "Speaker labels will appear here after diarization.": "Метки говорящих появятся здесь после диаризации.",
  "Your completed transcripts will appear here for this browser session.": "Готовые расшифровки появятся здесь для текущей сессии браузера.",
  "Save a video": "Сохранить видео", "Save to device": "Сохранить на устройство", "Stream a public video": "Скачать публичное видео", "Public video URL": "Публичная ссылка на видео",
  "I confirm I have the right to save this media. Platform verification may still prevent access.": "Я подтверждаю право на сохранение медиа. Проверка платформы всё равно может заблокировать доступ.",
  "Save video to device": "Сохранить видео на устройство", "Save video with progress": "Сохранить видео с прогрессом", "Choose a saved file for Diarize": "Выбрать сохранённый файл для Diarize",
  "Prepare long video": "Подготовить длинное видео", "Local preparation": "Локальная подготовка", "Prepare a long video": "Подготовить длинное видео", "Choose a long video to prepare": "Выберите длинное видео для подготовки",
  "Create smaller audio copy": "Создать компактную аудиокопию", "Use in Diarize": "Использовать в Diarize", "Copy": "Копировать", "TXT": "TXT", "SRT": "SRT", "VTT": "VTT",
  "Processing record": "Обработка записи", "Completed dialogue": "Готовый диалог", "New source": "Новый источник", "Transcript": "Расшифровка", "Times": "Таймкоды", "Rename": "Переименовать", "Save": "Сохранить",
  "Uploading source": "Загрузка источника", "Preparing direct URL": "Подготовка прямой ссылки", "Getting YouTube media": "Получение медиа YouTube", "Extracting audio": "Извлечение аудио", "Transcribing with Whisper": "Расшифровка Whisper", "Separating speakers": "Разделение говорящих", "Ready": "Готово", "Needs attention": "Требуется внимание",
  "Close save video panel": "Закрыть панель сохранения видео", "Close long video panel": "Закрыть панель подготовки длинного видео", "Direct public media URL": "Прямая публичная ссылка на медиа", "Participant name": "Имя участника",
  "MP3, WAV, M4A, MP4, MOV or WebM · up to 16 MB": "MP3, WAV, M4A, MP4, MOV или WebM · до 16 МБ",
  "A final audio or video file URL is required. Page URLs from YouTube, social media, and other platforms are intentionally unsupported here.": "Нужна прямая ссылка на итоговый аудио- или видеофайл. Ссылки на страницы YouTube, соцсетей и других платформ здесь намеренно не поддерживаются.",
  "Role suggestions appear after transcript analysis.": "Подсказки ролей появятся после анализа расшифровки.", "Suggested role:": "Предложенная роль:", "Processing stopped": "Обработка остановлена",
  "Local file selected. Confirm rights and begin analysis when ready.": "Локальный файл выбран. Подтвердите права и начните анализ, когда будете готовы.", "Media accepted. Processing will begin shortly.": "Медиа принято. Обработка начнётся в ближайшее время.",
  "Confirm you have the right to process this media.": "Подтвердите право на обработку этого медиа.", "Choose an audio or video file.": "Выберите аудио- или видеофайл.", "Paste a public media or YouTube URL.": "Вставьте публичную ссылку на медиа или YouTube.",
  "For supported public YouTube URLs, Diarize streams the lightest available video directly to your browser’s download manager. No complete video file is stored in this app.": "Для поддерживаемых публичных ссылок YouTube Diarize передаёт самый лёгкий доступный видеопоток прямо в менеджер загрузок браузера. Полный видеофайл не хранится в приложении.",
  "After the download finishes, select Local file in Diarize to transcribe it. If the source blocks this free host, use your permitted local file instead.": "После завершения загрузки выберите «Локальный файл» в Diarize для расшифровки. Если источник блокирует бесплатный хост, используйте разрешённый локальный файл.",
  "Connected to the download route. Waiting for the source stream.": "Подключение к маршруту загрузки установлено. Ожидание потока источника.", "Saved to the selected device location.": "Файл сохранён в выбранном месте на устройстве.",
  "This browser uses its native download UI for start, byte progress, cancellation, and errors. No success state is inferred by Diarize.": "Этот браузер использует собственный интерфейс загрузки для запуска, байтового прогресса, отмены и ошибок. Diarize не предполагает успешное завершение без подтверждения браузера.",
  "For diarization, video is not needed. On supported browsers, this creates a compact speech-audio copy locally; the original video never leaves your device.": "Для диаризации видео не требуется. В поддерживаемых браузерах здесь локально создаётся компактная аудиокопия речи; исходное видео не покидает устройство.",
  "This browser cannot create a local audio copy. You can still choose a file already under 16 MB or prepare/trim the recording locally.": "Этот браузер не может создать локальную аудиокопию. Вы всё равно можете выбрать файл до 16 МБ или подготовить/обрезать запись локально.",
  "Creating a smaller audio copy in this browser. Keep this tab open until it finishes.": "В браузере создаётся компактная аудиокопия. Не закрывайте вкладку до завершения.",
  "This browser does not expose direct file saving.": "Этот браузер не поддерживает прямое сохранение файла.", "The video stream could not start.": "Видеопоток не удалось запустить.", "The browser could not save this video.": "Браузер не смог сохранить это видео.",
  "Only oversized video files can be prepared in this browser. Choose a shorter audio file or prepare it locally.": "В этом браузере можно подготовить только видеофайлы, превышающие лимит. Выберите более короткий аудиофайл или подготовьте его локально.",
  "This browser cannot create a local audio copy. Use a current Chromium or Firefox browser, or prepare a smaller file locally.": "Этот браузер не может создать локальную аудиокопию. Используйте актуальный Chromium или Firefox либо подготовьте файл меньшего размера локально.",
  "This browser cannot record a compatible compressed audio stream.": "Этот браузер не может записать совместимый сжатый аудиопоток.", "The browser could not read this video file.": "Браузер не смог прочитать этот видеофайл.",
  "The video does not expose a usable duration for browser preparation.": "Видео не содержит доступной длительности для подготовки в браузере.", "The browser could not access an audio track in this video. Choose a file with audio or prepare it locally.": "Браузер не смог получить аудиодорожку из этого видео. Выберите файл со звуком или подготовьте его локально.",
  "The browser could not start a compressed audio recording for this video.": "Браузер не смог начать запись сжатого аудио для этого видео.", "Browser audio preparation stopped unexpectedly.": "Подготовка аудио в браузере неожиданно остановилась.",
  "The compressed audio copy is still above the 16 MB analysis limit. Trim the recording and try again.": "Сжатая аудиокопия всё ещё превышает лимит анализа 16 МБ. Обрежьте запись и повторите попытку.",
  "The browser prevented local video playback needed for preparation. Start again from this panel.": "Браузер заблокировал локальное воспроизведение видео, нужное для подготовки. Запустите процесс снова из этой панели.",
  "Unable to create the job.": "Не удалось создать задание.", "Unable to create this job.": "Не удалось создать это задание.", "Upload failed.": "Загрузка не удалась.", "Transcript copied.": "Расшифровка скопирована.",
  "Copy transcript": "Копировать расшифровку", "Download transcript as text": "Скачать расшифровку как текст", "Download transcript as SRT subtitles": "Скачать расшифровку как субтитры SRT", "Download transcript as WebVTT subtitles": "Скачать расшифровку как субтитры WebVTT",
  "Use local companion": "Использовать локальный companion", "On this device": "На этом устройстве", "Close local companion panel": "Закрыть панель локального companion", "Public YouTube URL": "Публичная ссылка YouTube",
  "The companion uses your device’s network, downloads permitted public media locally, extracts compact audio, then selects it in Diarize. Keep the companion terminal running.": "Companion использует сеть вашего устройства, локально получает разрешённое публичное медиа, извлекает компактное аудио и выбирает его в Diarize. Не закрывайте окно companion.",
  "I confirm I have the right to process this media locally.": "Я подтверждаю право на локальную обработку этого медиа.", "Preparing audio locally": "Локальная подготовка аудио", "Prepare with companion": "Подготовить через companion",
  "Local audio is ready and has been selected in Diarize.": "Локальное аудио готово и выбрано в Diarize.", "The local companion is not ready.": "Локальный companion не готов.", "The local companion rejected this request.": "Локальный companion отклонил этот запрос.",
  "Unable to connect to the local companion. Start it and try again.": "Не удаётся подключиться к локальному companion. Запустите его и повторите попытку.", "Unable to reach the local companion.": "Не удаётся связаться с локальным companion.", "The local companion did not return a job status.": "Локальный companion не вернул статус задания.",
  "The companion audio is unavailable.": "Аудио из companion недоступно.", "Unable to receive prepared companion audio.": "Не удалось получить подготовленное companion аудио.",
  "Start it first:": "Сначала запустите:", "in the repository folder, open a terminal and run": "в папке репозитория откройте терминал и выполните", "Keep that terminal open. Open the published Diarize site in a browser on this same computer—not Manus Preview—and allow local-network access if the browser asks.": "Не закрывайте это окно терминала. Откройте опубликованный сайт Diarize в браузере на этом же компьютере, а не Manus Preview, и разрешите доступ к локальной сети, если браузер спросит.",
  "Cannot reach the local companion. Start it in the repository’s companion folder with npm start, keep that terminal open, then allow local-network access if your browser asks.": "Не удаётся подключиться к локальному companion. Запустите его в папке companion репозитория командой npm start, не закрывайте терминал и разрешите браузеру доступ к локальной сети, если он спросит.",
  "The local companion cannot be reached from Manus Preview. Open the published Diarize site in a browser on the same computer where companion is running, then try again.": "Локальный companion недоступен из Manus Preview. Откройте опубликованный сайт Diarize в браузере на том же компьютере, где запущен companion, и повторите попытку.",
  "Your browser has blocked local-network access for Diarize. Open the site controls next to the address bar, set Local network access to Allow, then reload this page.": "Браузер заблокировал доступ Diarize к локальной сети. Откройте настройки сайта рядом с адресной строкой, установите «Доступ к локальной сети» в «Разрешить», затем обновите страницу.",
  "If status is OK but this panel fails, open the site controls next to the address bar, set": "Если status возвращает OK, но панель не работает, откройте настройки сайта рядом с адресной строкой, установите",
  "Local network access": "Доступ к локальной сети",
  "to Allow, then reload.": "в «Разрешить», затем обновите страницу.",
  "queued": "в очереди", "inspecting": "проверка", "downloading": "скачивание", "extracting audio": "извлечение аудио", "ready": "готово", "handed off": "передано в Diarize", "failed": "ошибка",
};

const reverseTranslations = Object.fromEntries(Object.entries(translations).map(([english, russian]) => [russian, english]));

export function translateInterfaceText(text: string, locale: Locale): string {
  if (locale === "ru") {
    const saving = text.match(/^Saving the verified response(?: · (\d+%))?\.$/);
    if (saving) return `Сохранение подтверждённого ответа${saving[1] ? ` · ${saving[1]}` : ""}.`;
    const playback = text.match(/^(\d+)% of the video played locally$/);
    if (playback) return `${playback[1]}% видео локально обработано`;
    const prepared = text.match(/^Audio copy ready: (.+)\. It is now selected in Diarize\.$/);
    if (prepared) return `Аудиокопия готова: ${prepared[1]}. Она выбрана в Diarize.`;
    const readyFile = text.match(/^(.+) · (.+) — ready for Diarize$/);
    if (readyFile) return `${readyFile[1]} · ${readyFile[2]} — готово для Diarize`;
    const needsPreparation = text.match(/^(.+) · (.+) — needs preparation for the 16 MB limit$/);
    if (needsPreparation) return `${needsPreparation[1]} · ${needsPreparation[2]} — требуется подготовка для лимита 16 МБ`;
    const oversized = text.match(/^The compressed audio copy is (.+), still above the 16 MB analysis limit\. Trim the recording and try again\.$/);
    if (oversized) return `Сжатая аудиокопия имеет размер ${oversized[1]} и всё ещё превышает лимит анализа 16 МБ. Обрежьте запись и повторите попытку.`;
  }
  return (locale === "ru" ? translations[text] : reverseTranslations[text]) ?? text;
}

type LocaleContextValue = { locale: Locale; toggleLocale: () => void };
const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

function applyLocaleToNode(node: Node, locale: Locale) {
  if (node.nodeType === Node.TEXT_NODE) {
    const value = node.textContent ?? "";
    const trimmed = value.trim();
    const translated = translateInterfaceText(trimmed, locale);
    if (translated !== trimmed) node.textContent = value.replace(trimmed, translated);
    return;
  }
  if (!(node instanceof HTMLElement) || ["SCRIPT", "STYLE"].includes(node.tagName)) return;
  ["aria-label", "placeholder", "title"].forEach(attribute => {
    const value = node.getAttribute(attribute);
    if (!value) return;
    const translated = translateInterfaceText(value, locale);
    if (translated !== value) node.setAttribute(attribute, translated);
  });
  node.childNodes.forEach(child => applyLocaleToNode(child, locale));
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>(() => (localStorage.getItem("diarize.locale") as Locale) || (navigator.language.startsWith("ru") ? "ru" : "en"));
  useEffect(() => {
    localStorage.setItem("diarize.locale", locale);
    document.documentElement.lang = locale;
    applyLocaleToNode(document.body, locale);
    const observer = new MutationObserver(records => records.forEach(record => {
      if (record.type === "characterData") applyLocaleToNode(record.target, locale);
      record.addedNodes.forEach(node => applyLocaleToNode(node, locale));
    }));
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [locale]);
  return <LocaleContext.Provider value={{ locale, toggleLocale: () => setLocale(current => current === "en" ? "ru" : "en") }}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale must be used within LocaleProvider");
  return context;
}
