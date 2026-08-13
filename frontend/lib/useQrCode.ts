"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** Generates a QR code data URL for the given text, client-side only. */
export function useQrCode(text: string): string | null {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!text) {
      setDataUrl(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(text, {
      width: 240,
      margin: 1,
      color: { dark: "#15803d", light: "#ffffff00" }
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => setDataUrl(null));
    return () => {
      cancelled = true;
    };
  }, [text]);

  return dataUrl;
}
