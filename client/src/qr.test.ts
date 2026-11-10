import jsQR from "jsqr";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { joinLink } from "./joinUrl";
import { qrDataUrl } from "./qr";

/** Décode l'image comme le ferait l'appareil photo d'un téléphone. */
function decode(dataUrl: string): string | null {
  const png = PNG.sync.read(Buffer.from(dataUrl.split(",")[1]!, "base64"));
  return jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data ?? null;
}

describe("qrDataUrl", () => {
  it("produit une image PNG qui se décode en lien direct vers la salle", async () => {
    const link = joinLink("http://192.168.1.153:3000", "ABC234");
    const url = await qrDataUrl(link);
    expect(url.startsWith("data:image/png;base64,")).toBe(true);
    expect(decode(url)).toBe(link);
  });

  it("reste lisible avec un lien plus long", async () => {
    const link = joinLink("https://un-nom-de-domaine-assez-long.exemple.fr:8443", "ZZ9X2K");
    expect(decode(await qrDataUrl(link))).toBe(link);
  });
});
