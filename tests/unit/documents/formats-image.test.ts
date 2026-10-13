import { describe, expect, it } from "vitest";

import { formatImageReconnu } from "@/lib/documents/formats-image";

describe("formatImageReconnu — lu dans les octets, jamais dans un nom ni un en-tête", () => {
  it("reconnaît un JPEG par ses trois octets magiques", () => {
    expect(
      formatImageReconnu(Uint8Array.from([0xff, 0xd8, 0xff, 1, 2, 3])),
    ).toBe("image/jpeg");
  });

  it("reconnaît un PNG par ses huit octets magiques", () => {
    expect(
      formatImageReconnu(
        Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9]),
      ),
    ).toBe("image/png");
  });

  it("refuse un SVG — du texte, aucune signature binaire", () => {
    expect(
      formatImageReconnu(new TextEncoder().encode("<svg></svg>")),
    ).toBeNull();
  });

  it("refuse des octets quelconques, même en nombre suffisant", () => {
    expect(
      formatImageReconnu(Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8])),
    ).toBeNull();
  });

  it("refuse un tableau trop court pour porter la signature PNG", () => {
    expect(formatImageReconnu(Uint8Array.from([0x89, 0x50, 0x4e]))).toBeNull();
  });

  it("ne confond pas les trois premiers octets d'un PNG avec un JPEG", () => {
    // 0x89 0x50 0x4e — ne commence pas par 0xff 0xd8 0xff.
    expect(
      formatImageReconnu(Uint8Array.from([0x89, 0x50, 0x4e, 0x47])),
    ).toBeNull();
  });
});
