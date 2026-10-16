import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";

import { expect, test } from "@playwright/test";

import {
  CID_LOGO_SOCIETE,
  miseEnPageMetier,
} from "@/lib/courriel/gabarit-metier";
import { t } from "@/lib/i18n/fr";

/**
 * 9EZ-LOGO-SOCIETE-4-COURRIELS-SOLDE — LE RENDU DES COURRIELS, CAPTURÉ : LE
 * PIED DES MENTIONS LÉGALES (point 2) ET LE REPLI D'UNE LECTURE DE LOGO EN
 * ÉCHEC (point 1).
 *
 * Même technique que `9ez-logo-societe-2-courriels.spec.ts` : `miseEnPageMetier`
 * est une fonction PURE, appelée directement — `page.setContent(html)` affiche
 * la chaîne telle que le gabarit la produit réellement, sans route ni base.
 *
 * **Captures EN VIEWPORT, jamais `fullPage`** (leçon de 9EZ-LOGO-SOCIETE-3-
 * CORRECTIFS, point 4) : une capture plein contenu ne montre pas forcément ce
 * qui est visible sans défiler.
 *
 * **La capture « sans logo » représente le REPLI du point 1** — une lecture
 * du logo qui lève une erreur, absorbée par `lireLogoEtRaisonSocialePourCourriel`
 * (`lib/societes/logo.ts`) : aucun logo, aucun pied, et la raison sociale de
 * repli `t("app.nom")` — jamais la raison sociale réelle de la société, que la
 * lecture en échec n'a justement pas pu lire.
 */

const DOSSIER =
  process.env.CAPTURES_9EZ4 ??
  join(
    "docs",
    "propositions",
    "9EZ-LOGO-SOCIETE-4-COURRIELS-SOLDE",
    "captures",
  );

/** Même générateur que `9ez-logo-societe-2-courriels.spec.ts` — un PNG RÉEL (I9 : jamais un vrai logo d'entreprise). */
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
      brut[debut + 1 + x * 3] = 0xff;
      brut[debut + 1 + x * 3 + 1] = 0x7a;
      brut[debut + 1 + x * 3 + 2] = 0x00;
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
  mkdirSync(DOSSIER, { recursive: true });
  // JAMAIS fullPage (9EZ-LOGO-SOCIETE-3-CORRECTIFS, point 4) : la capture ne
  // montre que ce qui est visible dans le viewport, sans défiler.
  await page.screenshot({ path: join(DOSSIER, `${nom}-${largeur}.png`) });
}

const RAISON_SOCIALE = "zz9EZ4-Société (test)";
const MENTIONS_LEGALES =
  "zz9EZ4 — RCS Nouméa 000 000 000 — SARL au capital de 1 000 000 XPF";

function htmlAvecLogoEtMentionsLegales(): string {
  const html = miseEnPageMetier({
    societe: {
      raisonSociale: RAISON_SOCIALE,
      logo: { cid: CID_LOGO_SOCIETE },
    },
    titre: "Votre intervention est planifiée",
    paragraphes: [
      "Date : 16/11/2026 à 08:00",
      "Lieu : zz9EZ4-Lieu (test) — Nouméa",
      "Nature : Maintenance préventive",
    ],
    pied: MENTIONS_LEGALES,
  });
  // SEULEMENT POUR LA CAPTURE : `cid:` est un renvoi multipart qu'un
  // navigateur seul ne résout pas ; la production envoie réellement `cid:`.
  return html.replace(
    `src="cid:${CID_LOGO_SOCIETE}"`,
    `src="data:image/png;base64,${PNG_DE_TEST.toString("base64")}"`,
  );
}

/**
 * LE REPLI DU POINT 1 — exactement ce que
 * `lireLogoEtRaisonSocialePourCourriel` rend quand la lecture du logo lève :
 * aucun logo, aucun pied, raison sociale de repli `t("app.nom")`.
 */
function htmlRepliSurEchecDeLecture(): string {
  return miseEnPageMetier({
    societe: { raisonSociale: t("app.nom") },
    titre: "Votre intervention est planifiée",
    paragraphes: [
      "Date : 16/11/2026 à 08:00",
      "Lieu : zz9EZ4-Lieu (test) — Nouméa",
      "Nature : Maintenance préventive",
    ],
  });
}

for (const largeur of [375, 1280] as const) {
  test(`capture — courriel métier AVEC logo et mentions légales, à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1000 });
    await page.setContent(htmlAvecLogoEtMentionsLegales());
    await expect(page.locator("img")).toBeVisible();
    const texte = await page.locator("body").innerText();
    expect(texte).toContain(RAISON_SOCIALE);
    expect(texte).toContain(MENTIONS_LEGALES);
    await capturer(page, "courriel-avec-logo-et-mentions-legales", largeur);
  });

  test(`capture — repli du point 1, lecture du logo en échec, à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1000 });
    await page.setContent(htmlRepliSurEchecDeLecture());
    await expect(page.locator("img")).toHaveCount(0);
    const texte = await page.locator("body").innerText();
    expect(texte).toContain(t("app.nom"));
    await capturer(page, "courriel-repli-echec-logo", largeur);
  });
}
