import QRCode from "qrcode";

/** QR code en image PNG (data URL). Fond blanc et marge : les lecteurs l'exigent, même en thème sombre. */
export function qrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 360,
    color: { dark: "#1a1433", light: "#ffffff" },
  });
}
