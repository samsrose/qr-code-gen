import type { Options } from "qr-code-styling";

export const QR_SIZE = 512;

export function buildQrOptions(
  data: string,
  centerImageUrl: string | undefined,
  useTransparentBackground: boolean
): Options {
  const hasLogo = Boolean(centerImageUrl);
  return {
    type: "canvas",
    shape: "square",
    width: QR_SIZE,
    height: QR_SIZE,
    data,
    image: centerImageUrl,
    margin: 10,
    qrOptions: {
      errorCorrectionLevel: hasLogo ? "H" : "Q",
    },
    imageOptions: {
      hideBackgroundDots: true,
      imageSize: 0.35,
      margin: 6,
      crossOrigin: "anonymous",
      saveAsBlob: true,
    },
    dotsOptions: {
      color: "#111827",
      type: "rounded",
    },
    cornersSquareOptions: {
      type: "extra-rounded",
      color: "#111827",
    },
    cornersDotOptions: {
      type: "dot",
      color: "#111827",
    },
    backgroundOptions: {
      color: useTransparentBackground ? "transparent" : "#ffffff",
    },
  };
}
