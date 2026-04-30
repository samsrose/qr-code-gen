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
import { AppearanceSection } from "@/components/qr-workspace/appearance-section";
import { ContentSection } from "@/components/qr-workspace/content-section";
import { PreviewPanel } from "@/components/qr-workspace/preview-panel";
import { compositeQrOverBackground, downloadBlob } from "@/lib/compose-qr-png";
import type { PayloadMode, WifiFields } from "@/lib/qr-payload";
import { buildPayload } from "@/lib/qr-payload";
import { buildQrOptions } from "@/lib/qr-instance";

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

  const handleImageEmbedChange = useCallback(
    async (file: File | null) => {
      setUploadHint(undefined);
      if (!file) {
        setImageEmbedFile(null);
        setImageDataUri(null);
        return;
      }
      if (!file.type.startsWith("image/")) {
        setUploadHint("Please choose an image file.");
        setImageEmbedFile(null);
        setImageDataUri(null);
        return;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        setUploadHint(
          `Image must be ${MAX_UPLOAD_BYTES / 1024 / 1024} MB or smaller.`
        );
        setImageEmbedFile(null);
        setImageDataUri(null);
        return;
      }
      setImageEmbedFile(file);
      try {
        setImageDataUri(await readFileAsDataUrl(file));
      } catch {
        setImageDataUri(null);
      }
    },
    []
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-10 md:flex-row md:items-start md:gap-12">
      <div className="flex min-w-0 flex-1 flex-col gap-8">
        <ContentSection
          baseId={baseId}
          mode={mode}
          setMode={setMode}
          urlText={urlText}
          setUrlText={setUrlText}
          plainText={plainText}
          setPlainText={setPlainText}
          wifi={wifi}
          setWifi={setWifi}
          imageUrlField={imageUrlField}
          setImageUrlField={setImageUrlField}
          imageEmbedFile={imageEmbedFile}
          onImageEmbedChange={handleImageEmbedChange}
          acceptImages={ACCEPT_IMAGES}
          effectiveError={effectiveError}
        />

        <AppearanceSection
          baseId={baseId}
          acceptImages={ACCEPT_IMAGES}
          backgroundFile={backgroundFile}
          centerFile={centerFile}
          uploadHint={uploadHint}
          onBackgroundChange={(file) => validateAndSetFile(file, setBackgroundFile)}
          onCenterChange={(file) => validateAndSetFile(file, setCenterFile)}
          clearBackground={() => setBackgroundFile(null)}
          clearCenter={() => setCenterFile(null)}
        />
      </div>
      <PreviewPanel
        compositedPreview={compositedPreview}
        qrData={qrData}
        effectiveError={effectiveError}
        mountRef={mountRef}
        onDownload={handleDownload}
      />
    </div>
  );
}
