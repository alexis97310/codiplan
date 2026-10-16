import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";

import { expect, test } from "@playwright/test";

import { corpsPremierAcces } from "@/lib/courriel/premier-acces";
import {
  CID_LOGO_SOCIETE,
  miseEnPageMetier,
} from "@/lib/courriel/gabarit-metier";

/**
 * 9EZ-LOGO-SOCIETE-2 (D89) — LE RENDU DES COURRIELS, CAPTURÉ.
 *
 * **Ce qu'aucune épreuve unitaire ne peut montrer.**
 * `tests/unit/courriel/gabarit-metier.test.ts` prouve l'échappement, le logo
 * présent/absent, l'absence de ressource distante — sur la CHAÎNE produite.
 * Ce fichier capture ce que cette chaîne rend VISUELLEMENT, à 375 et 1280 px,
 * pour un courriel métier avec logo, un courriel métier sans logo, et le
 * texte simple d'un courriel de premier accès.
 *
 * **`miseEnPageMetier` est appelée DIRECTEMENT** — fonction pure, aucune base
 * ni session n'est nécessaire : `page.setContent(html)` affiche la chaîne
 * telle que `lib/courriel/gabarit-metier.ts` la produit réellement, sans
 * passer par une route de l'application (il n'en existe aucune pour prévisu-
 * aliser un courriel).
 *
 * **Le `cid:` est remplacé par une donnée EN LIGNE, SEULEMENT pour la
 * capture.** `src="cid:…"` est un renvoi vers une pièce jointe MULTIPART — un
 * mécanisme de courriel, que ni un fichier HTML seul ni un navigateur ne
 * savent résoudre. La production envoie réellement `cid:` (voir
 * `lib/courriel/resend.ts` et ses épreuves) ; substituer une donnée EN LIGNE
 * ici ne change que ce que CETTE capture affiche, jamais ce qui est généré
 * par le gabarit lui-même.
 */

const DOSSIER = process.env.CAPTURES_9EZ2 ?? "";

/** Même générateur que `tests/e2e/9ez-logo-societe.spec.ts` — un PNG RÉEL, décodable par un navigateur (I9 : jamais un vrai logo d'entreprise). */
function construirePngDeTest(largeur: number, hauteur: number): Buffer {
  const crc32 = (() => {
    const table = Array.from({ length: 256 }, (_unused, n) => {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      return c >>> 0;
    });
    return (buf: Buffer): number => {
      let crc = 0xffffffff;
      for (const octet of buf) {
        crc = (table[(crc ^ octet) & 0xff] ?? 0) ^ (crc >>> 8);
      }
      return (crc ^ 0xffffffff) >>> 0;
    };
  })();
  const chunk = (type: string, data: Buffer): Buffer => {
    const longueur = Buffer.alloc(4);
    longueur.writeUInt32BE(data.length, 0);
    const typeEtDonnees = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typeEtDonnees), 0);
    return Buffer.concat([longueur, typeEtDonnees, crc]);
  };
  const signature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largeur, 0);
  ihdr.writeUInt32BE(hauteur, 4);
  ihdr[8] = 8; // 8 bits par canal
  ihdr[9] = 2; // couleur vraie (RGB)
  const brut = Buffer.alloc(hauteur * (1 + largeur * 3));
  for (let y = 0; y < hauteur; y++) {
    const debut = y * (1 + largeur * 3);
    for (let x = 0; x < largeur; x++) {
      brut[debut + 1 + x * 3] = 0x0b;
      brut[debut + 1 + x * 3 + 1] = 0x5c;
      brut[debut + 1 + x * 3 + 2] = 0xad;
    }
  }
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(brut)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const PNG_DE_TEST = construirePngDeTest(64, 24);

async function capturer(
  page: import("@playwright/test").Page,
  nom: string,
  largeur: number,
): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-${largeur}.png`),
    fullPage: true,
  });
}

const RAISON_SOCIALE = "zz9EZ-Société (test)";

function htmlAnnulationAvecLogo(): string {
  const html = miseEnPageMetier({
    societe: {
      raisonSociale: RAISON_SOCIALE,
      logo: { cid: CID_LOGO_SOCIETE },
    },
    titre: "Votre intervention est annulée",
    paragraphes: [
      "Date : 14/10/2026 à 09:00",
      "Lieu : zz9EZ-Lieu (test) — Nouméa",
      "Nature : Maintenance préventive",
      "Motif : Site fermé",
    ],
    pied: "zz9EZ-Société (test) — RCS Nouméa 000 000 000",
  });
  // SEULEMENT POUR LA CAPTURE (voir l'en-tête du fichier) :
  return html.replace(
    `src="cid:${CID_LOGO_SOCIETE}"`,
    `src="data:image/png;base64,${PNG_DE_TEST.toString("base64")}"`,
  );
}

function htmlAnnulationSansLogo(): string {
  return miseEnPageMetier({
    societe: { raisonSociale: RAISON_SOCIALE },
    titre: "Votre intervention est annulée",
    paragraphes: [
      "Date : 14/10/2026 à 09:00",
      "Lieu : zz9EZ-Lieu (test) — Nouméa",
      "Nature : Maintenance préventive",
      "Motif : Site fermé",
    ],
  });
}

function htmlPremierAccesTexte(): string {
  const texte = corpsPremierAcces(
    "https://exemple.test/premier-acces?jeton=zz9ez2",
    "adv@zz9ez2.test",
    RAISON_SOCIALE,
  );
  // Un courriel de CONNEXION reste du texte seul (D89) — cette page n'ajoute
  // qu'un `<pre>` pour en permettre la capture, aucune mise en page.
  return `<!DOCTYPE html><html lang="fr"><body style="margin:0;padding:24px;background:#fff;"><pre style="font-family:monospace;font-size:14px;white-space:pre-wrap;">${texte
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")}</pre></body></html>`;
}

for (const largeur of [375, 1280] as const) {
  test(`capture — courriel d'annulation AVEC logo, à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1000 });
    await page.setContent(htmlAnnulationAvecLogo());
    await expect(page.getByText(RAISON_SOCIALE).first()).toBeVisible();
    await expect(page.locator("img")).toBeVisible();
    await capturer(page, "courriel-annulation-avec-logo", largeur);
  });

  test(`capture — courriel d'annulation SANS logo, à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1000 });
    await page.setContent(htmlAnnulationSansLogo());
    await expect(page.getByText(RAISON_SOCIALE)).toBeVisible();
    await expect(page.locator("img")).toHaveCount(0);
    await capturer(page, "courriel-annulation-sans-logo", largeur);
  });

  test(`capture — texte du courriel de premier accès, à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1000 });
    await page.setContent(htmlPremierAccesTexte());
    await expect(page.getByText(RAISON_SOCIALE)).toBeVisible();
    await capturer(page, "courriel-premier-acces-texte", largeur);
  });
}
