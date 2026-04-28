export type PayloadMode = "url" | "text" | "wifi" | "image";

export type WifiEncryption = "WPA" | "WPA-EAP" | "WEP" | "nopass";

export type WifiFields = {
  ssid: string;
  password: string;
  encryption: WifiEncryption;
  hidden: boolean;
};

const MAX_QR_STRING = 2048;

/** Escape special chars per WIFI QR convention */
function escapeWifiValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,");
}

export function buildWifiPayload(fields: WifiFields): string {
  const { ssid, password, encryption, hidden } = fields;
  const T = encryption === "nopass" ? "nopass" : encryption;
  const P =
    encryption === "nopass"
      ? ""
      : escapeWifiValue(password);
  const S = escapeWifiValue(ssid);
  const H = hidden ? "true" : "false";
  return `WIFI:T:${T};S:${S};P:${P};H:${H};;`;
}

function normalizeUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

export function buildPayload(
  mode: PayloadMode,
  urlText: string,
  plainText: string,
  wifi: WifiFields,
  imageUrl: string,
  imageDataUri: string | null
): { data: string; error?: string } {
  switch (mode) {
    case "url": {
      const data = normalizeUrl(urlText);
      if (!data) return { data: "", error: "Enter a URL." };
      if (data.length > MAX_QR_STRING) return { data: "", error: "URL is too long." };
      return { data };
    }
    case "text": {
      const data = plainText;
      if (!data.trim()) return { data: "", error: "Enter some text." };
      if (data.length > MAX_QR_STRING)
        return { data: "", error: `Text must be under ${MAX_QR_STRING} characters.` };
      return { data };
    }
    case "wifi": {
      if (!wifi.ssid.trim()) return { data: "", error: "Network name (SSID) is required." };
      const data = buildWifiPayload(wifi);
      if (data.length > MAX_QR_STRING) return { data: "", error: "Wi‑Fi fields are too long." };
      return { data };
    }
    case "image": {
      if (imageDataUri) {
        if (imageDataUri.length > MAX_QR_STRING) {
          return {
            data: "",
            error: `Embedded image data exceeds ~${MAX_QR_STRING} characters. Paste an image URL instead.`,
          };
        }
        return { data: imageDataUri };
      }
      const data = imageUrl.trim();
      if (!data) return { data: "", error: "Paste an image URL or upload a small image file." };
      const normalized = normalizeUrl(data);
      if (normalized.length > MAX_QR_STRING)
        return { data: "", error: "URL is too long for this QR size." };
      return { data: normalized };
    }
    default:
      return { data: "", error: "Unknown mode." };
  }
}
