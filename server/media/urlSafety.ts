const mediaExtensions = new Set([
  "aac",
  "flac",
  "m4a",
  "m4v",
  "mkv",
  "mov",
  "mp3",
  "mp4",
  "mpeg",
  "mpga",
  "oga",
  "ogg",
  "opus",
  "wav",
  "webm",
]);

function isPrivateIpv4(hostname: string): boolean {
  const octets = hostname.split(".").map(Number);
  if (octets.length !== 4 || octets.some(octet => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return false;
  }

  const [first, second] = octets;
  return first === 0 || first === 10 || first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168);
}

function hasMediaExtension(pathname: string): boolean {
  const lastPart = pathname.split("/").pop()?.toLowerCase() ?? "";
  const extension = lastPart.split(".").pop();
  return extension !== undefined && mediaExtensions.has(extension);
}

export function validatePublicMediaUrl(input: string): URL {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("Enter a valid direct HTTPS media URL.");
  }

  if (url.protocol !== "https:") {
    throw new Error("Only HTTPS media URLs are accepted.");
  }
  if (url.username || url.password) {
    throw new Error("Media URLs with embedded credentials are not accepted.");
  }

  const hostname = url.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "::1" ||
    hostname.startsWith("fc") ||
    hostname.startsWith("fd") ||
    isPrivateIpv4(hostname)
  ) {
    throw new Error("Private or local media addresses are not accepted.");
  }

  if (!hasMediaExtension(url.pathname)) {
    throw new Error("Use a direct URL to an audio or video file.");
  }

  return url;
}
