"use client";

import QRCodeStyling from "qr-code-styling";
import {
  startTransition,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { compositeQrOverBackground, downloadBlob } from "@/lib/compose-qr-png";
import type { PayloadMode, WifiFields, WifiEncryption } from "@/lib/qr-payload";
import { buildPayload } from "@/lib/qr-payload";
import { buildQrOptions, QR_SIZE } from "@/lib/qr-instance";

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const ACCEPT_IMAGES = "image/jpeg,image/png,image/webp,image/gif,image/svg+xml";

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function useObjectUrl(file: File | null): string | undefined {
  const url = useMemo(
    () => (file ? URL.createObjectURL(file) : undefined),
    [file]
  );
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);
  return url;
}

const defaultWifi: WifiFields = {
  ssid: "",
  password: "",
  encryption: "WPA",
  hidden: false,
};

export function QrWorkspace() {
  const baseId = useId();
  const mountRef = useRef<HTMLDivElement>(null);
  const qrRef = useRef<QRCodeStyling | null>(null);

  const [mode, setMode] = useState<PayloadMode>("url");
  const [urlText, setUrlText] = useState("https://");
  const [plainText, setPlainText] = useState("");
  const [wifi, setWifi] = useState<WifiFields>(defaultWifi);
  const [imageUrlField, setImageUrlField] = useState("");
  const [imageEmbedFile, setImageEmbedFile] = useState<File | null>(null);
  const [imageDataUri, setImageDataUri] = useState<string | null>(null);

  const [centerFile, setCenterFile] = useState<File | null>(null);
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);

  const centerImageUrl = useObjectUrl(centerFile);
  const backgroundObjectUrl = useObjectUrl(backgroundFile);

  const [uploadHint, setUploadHint] = useState<string | undefined>();
  const [compositedPreview, setCompositedPreview] = useState<string | null>(
    null
  );

  const { data: payloadData, error: builtError } = buildPayload(
    mode,
    urlText,
    plainText,
    wifi,
    imageUrlField,
    imageDataUri
  );

  const effectiveError = builtError;
  const qrData = effectiveError ? "" : payloadData;

  const syncQr = useCallback(async () => {
    const mount = mountRef.current;
    if (!mount || !qrData.trim()) {
      if (mount) mount.innerHTML = "";
      qrRef.current = null;
      setCompositedPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }

    const hasBg = Boolean(backgroundObjectUrl);
    const opts = buildQrOptions(qrData, centerImageUrl, hasBg);

    if (!qrRef.current) {
      qrRef.current = new QRCodeStyling(opts);
      qrRef.current.append(mount);
    } else {
      qrRef.current.update(opts);
    }

    await new Promise<void>((r) => requestAnimationFrame(() => r()));

    const blob = await qrRef.current?.getRawData("png");
    if (!blob || !(blob instanceof Blob)) return;

    if (!hasBg || !backgroundObjectUrl) {
      setCompositedPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }

    try {
      const composed = await compositeQrOverBackground(
        blob,
        backgroundObjectUrl
      );
      const url = URL.createObjectURL(composed);
      setCompositedPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    } catch {
      setCompositedPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    }
  }, [
    qrData,
    centerImageUrl,
    backgroundObjectUrl,
  ]);

  useEffect(() => {
    startTransition(() => {
      void syncQr();
    });
  }, [syncQr]);

  useEffect(() => {
    return () => {
      setCompositedPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, []);

  const validateAndSetFile = (
    file: File | null,
    setter: (f: File | null) => void
  ) => {
    setUploadHint(undefined);
    if (!file) {
      setter(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setUploadHint("Please choose an image file.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadHint(`Image must be ${MAX_UPLOAD_BYTES / 1024 / 1024} MB or smaller.`);
      return;
    }
    setter(file);
  };

  const handleDownload = async () => {
    if (!qrRef.current || !qrData.trim() || effectiveError) return;
    const blob = await qrRef.current.getRawData("png");
    if (!blob || !(blob instanceof Blob)) return;
    if (backgroundObjectUrl) {
      const composed = await compositeQrOverBackground(blob, backgroundObjectUrl);
      downloadBlob(composed, "qr-code.png");
    } else {
      downloadBlob(blob, "qr-code.png");
    }
  };

  const modeTabs: { id: PayloadMode; label: string }[] = [
    { id: "url", label: "URL" },
    { id: "text", label: "Text" },
    { id: "wifi", label: "Wi‑Fi" },
    { id: "image", label: "Image" },
  ];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-10 md:flex-row md:items-start md:gap-12">
      <div className="flex min-w-0 flex-1 flex-col gap-8">
        <section
          className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
          aria-labelledby={`${baseId}-content-heading`}
        >
          <h2
            id={`${baseId}-content-heading`}
            className="text-lg font-semibold text-zinc-900 dark:text-zinc-100"
          >
            QR content
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Choose what gets encoded. URLs and text are encoded as-is (no remote
            fetching).
          </p>

          <div
            className="mt-4 flex flex-wrap gap-2"
            role="tablist"
            aria-label="Content type"
          >
            {modeTabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={mode === t.id ? "true" : "false"}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  mode === t.id
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                }`}
                onClick={() => setMode(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="mt-6 space-y-4">
            {mode === "url" && (
              <div>
                <label
                  htmlFor={`${baseId}-url`}
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Website URL
                </label>
                <input
                  id={`${baseId}-url`}
                  type="url"
                  autoComplete="url"
                  value={urlText}
                  onChange={(e) => setUrlText(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                  placeholder="https://example.com"
                />
              </div>
            )}

            {mode === "text" && (
              <div>
                <label
                  htmlFor={`${baseId}-text`}
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Plain text
                </label>
                <textarea
                  id={`${baseId}-text`}
                  value={plainText}
                  onChange={(e) => setPlainText(e.target.value)}
                  rows={5}
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                  placeholder="Any text to encode"
                />
              </div>
            )}

            {mode === "wifi" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label
                    htmlFor={`${baseId}-ssid`}
                    className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    Network name (SSID)
                  </label>
                  <input
                    id={`${baseId}-ssid`}
                    value={wifi.ssid}
                    onChange={(e) =>
                      setWifi((w) => ({ ...w, ssid: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label
                    htmlFor={`${baseId}-wifi-pass`}
                    className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    Password
                  </label>
                  <input
                    id={`${baseId}-wifi-pass`}
                    type="password"
                    autoComplete="new-password"
                    value={wifi.password}
                    onChange={(e) =>
                      setWifi((w) => ({ ...w, password: e.target.value }))
                    }
                    disabled={wifi.encryption === "nopass"}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label
                    htmlFor={`${baseId}-enc`}
                    className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    Security
                  </label>
                  <select
                    id={`${baseId}-enc`}
                    value={wifi.encryption}
                    onChange={(e) =>
                      setWifi((w) => ({
                        ...w,
                        encryption: e.target.value as WifiEncryption,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                  >
                    <option value="WPA">WPA / WPA2</option>
                    <option value="WEP">WEP</option>
                    <option value="nopass">None (open)</option>
                  </select>
                </div>
                <div className="flex items-end pb-2 sm:col-span-2">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                    <input
                      type="checkbox"
                      checked={wifi.hidden}
                      onChange={(e) =>
                        setWifi((w) => ({ ...w, hidden: e.target.checked }))
                      }
                      className="rounded border-zinc-400"
                    />
                    Hidden network
                  </label>
                </div>
              </div>
            )}

            {mode === "image" && (
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor={`${baseId}-img-url`}
                    className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    Link to image (URL)
                  </label>
                  <input
                    id={`${baseId}-img-url`}
                    type="url"
                    value={imageUrlField}
                    onChange={(e) => setImageUrlField(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                    placeholder="https://…/photo.jpg"
                  />
                </div>
                <div>
                  <label
                    htmlFor={`${baseId}-img-embed`}
                    className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    Or embed a small image file
                  </label>
                  <input
                    id={`${baseId}-img-embed`}
                    type="file"
                    accept={ACCEPT_IMAGES}
                    onChange={async (e) => {
                      const f = e.target.files?.[0] ?? null;
                      setUploadHint(undefined);
                      if (!f) {
                        setImageEmbedFile(null);
                        setImageDataUri(null);
                        return;
                      }
                      if (!f.type.startsWith("image/")) {
                        setUploadHint("Please choose an image file.");
                        setImageEmbedFile(null);
                        setImageDataUri(null);
                        return;
                      }
                      if (f.size > MAX_UPLOAD_BYTES) {
                        setUploadHint(
                          `Image must be ${MAX_UPLOAD_BYTES / 1024 / 1024} MB or smaller.`
                        );
                        setImageEmbedFile(null);
                        setImageDataUri(null);
                        return;
                      }
                      setImageEmbedFile(f);
                      try {
                        setImageDataUri(await readFileAsDataUrl(f));
                      } catch {
                        setImageDataUri(null);
                      }
                    }}
                    className="mt-1 block w-full text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-900 hover:file:bg-zinc-200 dark:text-zinc-400 dark:file:bg-zinc-800 dark:file:text-zinc-100 dark:hover:file:bg-zinc-700"
                  />
                  {imageEmbedFile && (
                    <p className="mt-1 text-xs text-zinc-500">
                      Selected: {imageEmbedFile.name}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {effectiveError && (
            <p className="mt-4 text-sm text-red-600 dark:text-red-400" role="alert">
              {effectiveError}
            </p>
          )}
        </section>

        <section
          className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
          aria-labelledby={`${baseId}-look-heading`}
        >
          <h2
            id={`${baseId}-look-heading`}
            className="text-lg font-semibold text-zinc-900 dark:text-zinc-100"
          >
            Appearance (separate from QR data)
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Background and center images are decorative only; they are not added
            to the encoded payload.
          </p>

          <div className="mt-6 space-y-6">
            <div>
              <label
                htmlFor={`${baseId}-bg`}
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Background image
              </label>
              <input
                id={`${baseId}-bg`}
                type="file"
                accept={ACCEPT_IMAGES}
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  validateAndSetFile(f, setBackgroundFile);
                }}
                className="mt-1 block w-full text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-900 hover:file:bg-zinc-200 dark:text-zinc-400 dark:file:bg-zinc-800 dark:file:text-zinc-100 dark:hover:file:bg-zinc-700"
              />
              {backgroundFile && (
                <button
                  type="button"
                  className="mt-2 text-sm text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                  onClick={() => setBackgroundFile(null)}
                >
                  Remove background
                </button>
              )}
            </div>

            <div>
              <label
                htmlFor={`${baseId}-center`}
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Center image (logo)
              </label>
              <input
                id={`${baseId}-center`}
                type="file"
                accept={ACCEPT_IMAGES}
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  validateAndSetFile(f, setCenterFile);
                }}
                className="mt-1 block w-full text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-900 hover:file:bg-zinc-200 dark:text-zinc-400 dark:file:bg-zinc-800 dark:file:text-zinc-100 dark:hover:file:bg-zinc-700"
              />
              {centerFile && (
                <button
                  type="button"
                  className="mt-2 text-sm text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                  onClick={() => setCenterFile(null)}
                >
                  Remove logo
                </button>
              )}
            </div>
          </div>

          {uploadHint && (
            <p className="mt-4 text-sm text-amber-700 dark:text-amber-300" role="status">
              {uploadHint}
            </p>
          )}
        </section>
      </div>

      <aside className="flex w-full flex-col items-center md:w-[min(100%,380px)] md:shrink-0">
        <div className="sticky top-8 w-full">
          <p className="mb-3 text-center text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Preview
          </p>
          <div
            className="relative mx-auto flex aspect-square h-auto max-h-[512px] w-full max-w-[min(100vw-2rem,512px)] items-center justify-center overflow-hidden rounded-2xl border border-zinc-200 bg-[repeating-conic-gradient(#e4e4e7_0%_25%,#fafafa_0%_50%)_50%/24px_24px] dark:border-zinc-700 dark:bg-[repeating-conic-gradient(#27272a_0%_25%,#18181b_0%_50%)_50%/24px_24px]"
          >
            {compositedPreview && (
              // eslint-disable-next-line @next/next/no-img-element -- dynamic blob preview
              <img
                src={compositedPreview}
                alt="QR code preview with background"
                className="absolute inset-0 h-full w-full object-contain"
                width={QR_SIZE}
                height={QR_SIZE}
              />
            )}
            <div
              ref={mountRef}
              className={
                compositedPreview
                  ? "sr-only"
                  : "flex h-full w-full items-center justify-center [&_canvas]:max-h-full [&_canvas]:max-w-full"
              }
            />
          </div>

          {!qrData.trim() && (
            <p className="mt-3 text-center text-sm text-zinc-500">
              Enter valid content to generate a QR code.
            </p>
          )}

          <button
            type="button"
            onClick={handleDownload}
            disabled={Boolean(effectiveError) || !qrData.trim()}
            className="mt-6 w-full rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white shadow transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Download PNG
          </button>
        </div>
      </aside>
    </div>
  );
}
