import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import qrcode from "qrcode-generator";

import { t } from "@/lib/i18n/fr";

const PUSH = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: PUSH }),
}));

import { ScannerQr } from "@/components/machines/scanner-qr";

/**
 * LE LECTEUR DE QR, ÉPROUVÉ SUR UNE VRAIE IMAGE (9G10-SCANNER-QR-APPLI).
 *
 * `imageDataDUnQr` dessine la MÊME grille que `components/ui/qr-code.tsx`
 * (`qrcode-generator`, déjà au dépôt) — jamais une image inventée : si ce
 * paquet changeait de forme de sortie, cette épreuve le verrait aussi. jsdom
 * ne porte aucun moteur de canevas (`getContext` rend `null`) : `drawImage`
 * et `getImageData` sont donc remplacés par un espion qui rend cette image,
 * jamais la vidéo réelle — ce que `ScannerQr` fait de l'image, lui, n'est
 * pas remplacé.
 *
 * `requestAnimationFrame` REND LE VRAI, de jsdom — jamais un double : React
 * s'en sert pour ses propres mises à jour (celles qui naissent d'une
 * promesse, hors d'un gestionnaire d'événement), et le remplacer casse sa
 * boucle en silence, bien plus tard qu'ici.
 */
const TAILLE_MODULE = 4;
const MARGE_SILENCE = 4;

function imageDataDUnQr(valeur: string): {
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
} {
  const qr = qrcode(0, "M");
  qr.addData(valeur);
  qr.make();
  const modules = qr.getModuleCount();
  const cote = (modules + MARGE_SILENCE * 2) * TAILLE_MODULE;
  const data = new Uint8ClampedArray(cote * cote * 4).fill(255);
  for (let ligne = 0; ligne < modules; ligne++) {
    for (let colonne = 0; colonne < modules; colonne++) {
      if (!qr.isDark(ligne, colonne)) continue;
      for (let dy = 0; dy < TAILLE_MODULE; dy++) {
        for (let dx = 0; dx < TAILLE_MODULE; dx++) {
          const x = (colonne + MARGE_SILENCE) * TAILLE_MODULE + dx;
          const y = (ligne + MARGE_SILENCE) * TAILLE_MODULE + dy;
          const indice = (y * cote + x) * 4;
          data[indice] = 0;
          data[indice + 1] = 0;
          data[indice + 2] = 0;
          data[indice + 3] = 255;
        }
      }
    }
  }
  return { data, width: cote, height: cote };
}

const JETON_LU = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

describe("ScannerQr — le lecteur de QR dans l'application (9G10-SCANNER-QR-APPLI)", () => {
  let arreterPiste: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    arreterPiste = vi.fn();
    PUSH.mockReset();

    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: true,
    });
    vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(true);
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);

    Object.defineProperty(window.navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: arreterPiste }],
        }),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    cleanup();
  });

  /**
   * Arme la vidéo (dimensions non nulles) dès que le flux est attaché — la
   * vraie boucle de `requestAnimationFrame` (jsdom) prend le relais seule.
   */
  async function armerLaVideo(
    container: HTMLElement,
    image: ReturnType<typeof imageDataDUnQr>,
  ): Promise<void> {
    await waitFor(() => {
      const video = container.querySelector("video");
      expect(video?.srcObject).not.toBeNull();
    });
    const video = container.querySelector("video");
    if (video === null) throw new Error("vidéo introuvable");
    Object.defineProperty(video, "videoWidth", {
      configurable: true,
      value: image.width,
    });
    Object.defineProperty(video, "videoHeight", {
      configurable: true,
      value: image.height,
    });
  }

  it("décode par jsqr une vraie image de QR (qrcode-generator) quand BarcodeDetector est absent, puis arrête la caméra", async () => {
    delete (window as unknown as { BarcodeDetector?: unknown }).BarcodeDetector;
    const image = imageDataDUnQr(JETON_LU);
    const getImageData = vi.fn().mockReturnValue(image);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(),
      getImageData,
    } as unknown as CanvasRenderingContext2D);

    const resoudre = vi
      .fn()
      .mockResolvedValue({ suite: "rediriger", url: "/parc/m1" });

    const { container } = render(<ScannerQr resoudre={resoudre} />);
    await armerLaVideo(container, image);

    await waitFor(() => expect(resoudre).toHaveBeenCalledWith(JETON_LU));
    await waitFor(() => expect(PUSH).toHaveBeenCalledWith("/parc/m1"));
    // LA CAMÉRA S'ARRÊTE DÈS LA LECTURE — avant même que le serveur ait
    // répondu (voir l'en-tête de `scanner-qr.tsx`).
    expect(arreterPiste).toHaveBeenCalled();
  });

  it("choisit BarcodeDetector quand il existe, et ne retombe pas sur jsqr", async () => {
    const detect = vi
      .fn()
      .mockResolvedValue([{ rawValue: JETON_LU, format: "qr_code" }]);
    class DetecteurFactice {
      detect = detect;
    }
    (
      window as unknown as { BarcodeDetector: typeof DetecteurFactice }
    ).BarcodeDetector = DetecteurFactice;

    const getImageData = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(),
      getImageData,
    } as unknown as CanvasRenderingContext2D);

    const resoudre = vi
      .fn()
      .mockResolvedValue({ suite: "rediriger", url: "/parc/m1" });

    const { container } = render(<ScannerQr resoudre={resoudre} />);
    await armerLaVideo(container, imageDataDUnQr(JETON_LU));

    await waitFor(() => expect(detect).toHaveBeenCalled());
    await waitFor(() => expect(resoudre).toHaveBeenCalledWith(JETON_LU));
    // LE MOTEUR NATIF LU, JAMAIS LE REPLI : `jsqr` n'a jamais eu besoin de
    // l'image — `getImageData` n'est appelée que par son chemin.
    expect(getImageData).not.toHaveBeenCalled();
    expect(arreterPiste).toHaveBeenCalled();

    delete (window as unknown as { BarcodeDetector?: unknown }).BarcodeDetector;
  });

  it("une autorisation refusée affiche le refus, jamais la caméra", async () => {
    Object.defineProperty(window.navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi
          .fn()
          .mockRejectedValue(new DOMException("non", "NotAllowedError")),
      },
    });
    const resoudre = vi.fn();

    render(<ScannerQr resoudre={resoudre} />);

    await waitFor(() =>
      expect(document.body.textContent).toContain(t("machine.scanner.refusee")),
    );
    expect(resoudre).not.toHaveBeenCalled();
  });

  it("le repli par saisie manuelle résout le texte tapé, sans passer par la caméra", async () => {
    const resoudre = vi
      .fn()
      .mockResolvedValue({ suite: "introuvable" } as const);

    const { getByLabelText, getByText } = render(
      <ScannerQr resoudre={resoudre} />,
    );

    const champ = getByLabelText(
      t("machine.scanner.saisie_label"),
    ) as HTMLInputElement;
    fireEvent.change(champ, { target: { value: JETON_LU } });
    fireEvent.click(getByText(t("machine.scanner.saisie_bouton")));

    await waitFor(() => expect(resoudre).toHaveBeenCalledWith(JETON_LU));
    await waitFor(() =>
      expect(document.body.textContent).toContain(
        t("machine.scanner.non_reconnu"),
      ),
    );
  });
});
