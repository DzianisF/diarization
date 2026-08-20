import { storagePut } from "../storage";
import { validatePublicMediaUrl } from "./urlSafety";

export const MAX_SOURCE_BYTES = 16 * 1024 * 1024;

type StoragePut = (key: string, data: Buffer | Uint8Array | string, contentType?: string) => Promise<{ key: string; url: string }>;

type StoreRemoteMediaInput = {
  jobId: string;
  sourceUrl: string;
  maxBytes?: number;
  fetcher?: typeof fetch;
  put?: StoragePut;
};

type StoredRemoteMedia = {
  key: string;
  mimeType: string;
  byteLength: number;
};

function allowedMimeType(value: string): boolean {
  return value.startsWith("audio/") || value.startsWith("video/");
}

function extensionFromPathname(pathname: string): string {
  const lastPart = pathname.split("/").pop() ?? "";
  const extension = lastPart.split(".").pop()?.toLowerCase();
  return extension && extension !== lastPart.toLowerCase() ? extension : "bin";
}

async function fetchMedia(
  initialUrl: URL,
  fetcher: typeof fetch,
  maxBytes: number,
): Promise<{ response: Response; finalUrl: URL }> {
  let currentUrl = initialUrl;

  for (let redirects = 0; redirects < 4; redirects += 1) {
    const response = await fetcher(currentUrl, { redirect: "manual" });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Media host returned an invalid redirect.");
      currentUrl = validatePublicMediaUrl(new URL(location, currentUrl).toString());
      continue;
    }

    if (!response.ok) throw new Error(`Media host rejected the request (${response.status}).`);
    const declaredLength = Number(response.headers.get("content-length") ?? "0");
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      throw new Error(`Media exceeds ${maxBytes} bytes.`);
    }
    return { response, finalUrl: currentUrl };
  }

  throw new Error("Media host redirected too many times.");
}

export async function storeRemoteMedia({
  jobId,
  sourceUrl,
  maxBytes = MAX_SOURCE_BYTES,
  fetcher = fetch,
  put = storagePut,
}: StoreRemoteMediaInput): Promise<StoredRemoteMedia> {
  const source = validatePublicMediaUrl(sourceUrl);
  const { response, finalUrl } = await fetchMedia(source, fetcher, maxBytes);
  const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!allowedMimeType(mimeType)) {
    throw new Error("The direct URL did not return an audio or video file.");
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > maxBytes) {
    throw new Error(`Media exceeds ${maxBytes} bytes.`);
  }

  const extension = extensionFromPathname(finalUrl.pathname);
  const stored = await put(`jobs/${jobId}/source.${extension}`, buffer, mimeType);
  return { key: stored.key, mimeType, byteLength: buffer.byteLength };
}
