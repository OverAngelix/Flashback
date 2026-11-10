import { describe, expect, it } from "vitest";
import { joinBase, joinLink } from "./joinUrl";

const loc = (hostname: string, port = "3000", protocol = "http:") => ({
  protocol,
  hostname,
  port,
  origin: `${protocol}//${hostname}${port ? `:${port}` : ""}`,
});

describe("joinBase", () => {
  it("remplace localhost par l'adresse du réseau local, en gardant le port de la page", () => {
    expect(joinBase(loc("localhost", "5173"), ["http://192.168.1.153:3000"])).toBe("http://192.168.1.153:5173");
    expect(joinBase(loc("127.0.0.1"), ["http://192.168.1.153:3000"])).toBe("http://192.168.1.153:3000");
    expect(joinBase(loc("localhost", ""), ["http://10.0.0.2:3000"])).toBe("http://10.0.0.2");
  });
  it("garde l'adresse de la page quand elle est déjà joignable", () => {
    expect(joinBase(loc("192.168.1.153"), ["http://10.0.0.2:3000"])).toBe("http://192.168.1.153:3000");
    expect(joinBase(loc("jeu.exemple.fr", "", "https:"), [])).toBe("https://jeu.exemple.fr");
  });
  it("retombe sur l'adresse de la page sans réseau détecté", () => {
    expect(joinBase(loc("localhost"), [])).toBe("http://localhost:3000");
  });
  it("construit le lien direct vers la salle", () => {
    expect(joinLink("http://192.168.1.153:3000", "ABC234")).toBe("http://192.168.1.153:3000/join/ABC234");
  });
});
