import type { Page } from "@playwright/test";

/**
 * LES MESURES AUTOMATIQUES DE L'AUDIT (point 1.d et point 3 du ticket
 * 9F6A-DOSSIER-AUDIT-8-AGENTS) — calculées dans la page, sur le SITE rendu
 * (jamais sur la maquette, qui n'est qu'une référence visuelle), SAUF les
 * mesures de forme (rectangles, tableaux, intitulés) qui sont aussi relevées
 * sur la maquette pour nourrir la comparaison du point 3.
 */
export type RectangleMesure = {
  readonly x: number;
  readonly y: number;
  readonly largeur: number;
  readonly hauteur: number;
} | null;

export type TableauMesure = { readonly colonnes: number; readonly lignes: number };

export type MesuresPage = {
  readonly defilementsEnTrop: readonly string[];
  readonly debordementHorizontal: boolean;
  readonly elementsDebordants: readonly string[];
  readonly haloApresClicDansLeContenu: boolean;
  readonly contrastesInsuffisants: readonly string[];
  readonly troncatures: readonly string[];
  readonly controlesNatifs: readonly string[];
  readonly imagesCassees: readonly string[];
  readonly boutonsSansNom: readonly string[];
  readonly champsSansEtiquette: readonly string[];
  readonly rectangleH1: RectangleMesure;
  readonly rectanglePremierBouton: RectangleMesure;
  readonly rectangleBarre: RectangleMesure;
  readonly tableaux: readonly TableauMesure[];
  readonly intitules: readonly string[];
};

export async function mesurerLaPage(page: Page): Promise<MesuresPage> {
  const defilementsEtDebordement = await page.evaluate(() => {
    function descripteur(el: Element): string {
      const id = el.id ? `#${el.id}` : "";
      const classe =
        typeof el.className === "string" && el.className.length > 0
          ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".")
          : "";
      return `${el.tagName.toLowerCase()}${id}${classe}`;
    }
    const tous = Array.from(document.querySelectorAll("*"));
    const defilements: string[] = [];
    for (const el of tous) {
      const style = getComputedStyle(el);
      const overflow = `${style.overflowX} ${style.overflowY} ${style.overflow}`;
      if (!/auto|scroll/.test(overflow)) continue;
      const deborde =
        el.scrollHeight > el.clientHeight + 1 ||
        el.scrollWidth > el.clientWidth + 1;
      if (deborde && el.clientWidth > 0 && el.clientHeight > 0) {
        defilements.push(descripteur(el));
      }
    }
    const largeurDocument = document.documentElement.clientWidth;
    const debordementHorizontal =
      document.documentElement.scrollWidth > largeurDocument + 1;
    // LES ÉLÉMENTS QUI DÉPASSENT, NOMMÉS — un booléen dit QU'il y a un
    // débordement, jamais QUI le cause ; le point 1.d du ticket demande les
    // deux. On ne redescend pas dans les enfants d'un élément déjà signalé :
    // le PARENT qui dépasse suffit à nommer la cause.
    const elementsDebordants: string[] = [];
    if (debordementHorizontal) {
      for (const el of tous) {
        const rect = el.getBoundingClientRect();
        if (rect.right > largeurDocument + 1 && rect.width > 0) {
          elementsDebordants.push(
            `${descripteur(el)} (droite ${Math.round(rect.right)}px, document ${largeurDocument}px)`,
          );
        }
        if (elementsDebordants.length >= 15) break;
      }
    }
    return { defilements, debordementHorizontal, elementsDebordants };
  });

  // FOCUS PROGRAMMATIQUE, JAMAIS UN CLIC — `#contenu` porte `tabIndex={-1}`,
  // la cible du lien d'évitement (`components/mise-en-page/page.tsx`) : c'est
  // CE geste-là que le point 2 de 9EWA-RENDU-VISUEL-1 corrigeait (encadré
  // bleu autour de toute la page). *Mesuré en construisant cet outil* : un
  // clic à une position fixe dans `#contenu` atterrit, sur beaucoup
  // d'écrans, sur le fil d'Ariane ou un lien « Retour » posé tout en haut du
  // conteneur — un clic RÉEL (`locator.click`) suit alors ce lien et change
  // de page avant la capture, qui photographie alors la MAUVAISE page. Le
  // focus programmatique évite tout risque de navigation.
  const halo = await page.evaluate(() => {
    const contenu = document.querySelector("#contenu");
    if (contenu === null || !(contenu instanceof HTMLElement)) return false;
    contenu.focus();
    if (document.activeElement !== contenu) return false;
    const style = getComputedStyle(contenu);
    return style.boxShadow !== "none" && style.boxShadow.length > 0;
  });

  const contrastesInsuffisants = await page.evaluate(() => {
    function luminance(r: number, g: number, b: number): number {
      const canal = (v: number) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
    }
    function rgbDe(couleur: string): [number, number, number, number] | null {
      const m = couleur.match(
        /rgba?\((\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)(?:,\s*(\d*\.?\d+))?\)/,
      );
      if (!m) return null;
      return [
        Number(m[1]),
        Number(m[2]),
        Number(m[3]),
        m[4] ? Number(m[4]) : 1,
      ];
    }
    function fondEffectif(el: Element): [number, number, number] {
      let courant: Element | null = el;
      while (courant !== null) {
        const style = getComputedStyle(courant);
        const rgba = rgbDe(style.backgroundColor);
        if (rgba && rgba[3] > 0) return [rgba[0], rgba[1], rgba[2]];
        courant = courant.parentElement;
      }
      return [255, 255, 255];
    }
    // Le TEXTE PROPRE de l'élément, celui porté par ses nœuds texte
    // directs — jamais `textContent`, qui descend dans les enfants. *Mesuré
    // en construisant cet outil* : la marque « CODIPLAN SAV » du chrome
    // (`components/navigation/barre.tsx`) est un seul `<a>` autour de DEUX
    // `<span>` de couleurs différentes ; lire `textContent` sur le `<a>`
    // concatène « CODIPLAN » et « SAV » et compare leur réunion à la couleur
    // du conteneur, qui n'est celle d'AUCUN des deux textes réellement
    // rendus — un ratio de 1.04 sur un logo parfaitement lisible.
    function texteProprE(el: Element): string {
      return Array.from(el.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent ?? "")
        .join("")
        .trim();
    }
    const resultats: string[] = [];
    const selecteur = "h1, h2, h3, label, button, a, .titre, th, td";
    const elements = Array.from(document.querySelectorAll(selecteur));
    for (const el of elements) {
      const texte = texteProprE(el);
      if (texte.length === 0) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const style = getComputedStyle(el);
      const premierPlan = rgbDe(style.color);
      if (!premierPlan) continue;
      const [fr, fg, fb] = fondEffectif(el);
      const lFond = luminance(fr, fg, fb);
      const lTexte = luminance(premierPlan[0], premierPlan[1], premierPlan[2]);
      const plusClair = Math.max(lFond, lTexte) + 0.05;
      const plusFonce = Math.min(lFond, lTexte) + 0.05;
      const ratio = plusClair / plusFonce;
      if (ratio < 4.5) {
        const id = el.id ? `#${el.id}` : "";
        resultats.push(
          `${el.tagName.toLowerCase()}${id} « ${texte.slice(0, 40)} » (ratio ${ratio.toFixed(2)})`,
        );
      }
    }
    return resultats.slice(0, 30);
  });

  const troncatures = await page.evaluate(() => {
    const resultats: string[] = [];
    const elements = Array.from(
      document.querySelectorAll("select, button, [role=button]"),
    );
    for (const el of elements) {
      if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) {
        const texte = (el.textContent ?? "").trim().slice(0, 40);
        const id = el.id ? `#${el.id}` : "";
        resultats.push(`${el.tagName.toLowerCase()}${id} « ${texte} »`);
      }
    }
    return resultats.slice(0, 30);
  });

  // `components/ui/case-a-cocher.tsx` GARDE délibérément l'apparence native
  // (CG8) — seule la cible tactile change sous 768 px. Un décompte non nul
  // ici n'est donc PAS un défaut en soi : à lire au regard de la capture,
  // jamais comme un verdict.
  const controlesNatifs = await page.evaluate(() => {
    const resultats: string[] = [];
    const cases = Array.from(
      document.querySelectorAll('input[type="checkbox"], input[type="radio"]'),
    );
    for (const el of cases) {
      const style = getComputedStyle(el);
      const appearance =
        style.getPropertyValue("appearance") ||
        style.getPropertyValue("-webkit-appearance");
      if (appearance !== "none") {
        const id = el.id ? `#${el.id}` : "";
        resultats.push(`${el.getAttribute("type")}${id}`);
      }
    }
    // AUCUN contrôle sur `<details>` ici : `getComputedStyle(summary,
    // "::-webkit-details-marker")` ne reflète pas, sous Chromium headless, la
    // règle `[&::-webkit-details-marker]:hidden` posée au point 6 de
    // 9EWA-RENDU-VISUEL-1 — *mesuré en construisant cet outil* : le
    // signalait encore sur la page `/planning` dont ce point avait
    // explicitement masqué le triangle. Le triangle natif se vérifie à l'œil
    // sur la capture, pas par cette mesure.
    return resultats.slice(0, 30);
  });

  const imagesCassees = await page.evaluate(() => {
    const images = Array.from(document.querySelectorAll("img"));
    return images
      .filter((img) => img.complete && img.naturalWidth === 0)
      .map((img) => img.src || img.alt || "image sans source")
      .slice(0, 30);
  });

  const accessibilite = await page.evaluate(() => {
    function nomAccessible(element: Element): string {
      const aria = element.getAttribute("aria-label");
      if (aria !== null && aria.trim().length > 0) return aria.trim();
      const texte = (element.textContent ?? "").trim();
      if (texte.length > 0) return texte;
      const titre = element.getAttribute("title");
      return titre !== null ? titre.trim() : "";
    }
    function descripteur(el: Element): string {
      const id = el.id ? `#${el.id}` : "";
      const classe =
        typeof el.className === "string" && el.className.length > 0
          ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".")
          : "";
      return `${el.tagName.toLowerCase()}${id}${classe}`;
    }
    const interactifs = Array.from(
      document.querySelectorAll('button, a[href], [role="button"]'),
    );
    const boutonsSansNom = interactifs
      .filter((el) => nomAccessible(el).length === 0)
      .map(descripteur)
      .slice(0, 30);

    const champs = Array.from(
      document.querySelectorAll("input, select, textarea"),
    ).filter((el) => el.getAttribute("type") !== "hidden");
    const champsSansEtiquette = champs
      .filter((el) => {
        if (
          el.getAttribute("aria-label") !== null ||
          el.getAttribute("aria-labelledby") !== null
        ) {
          return false;
        }
        const id = el.getAttribute("id");
        if (id !== null && document.querySelector(`label[for="${id}"]`) !== null) {
          return false;
        }
        return el.closest("label") === null;
      })
      .map(descripteur)
      .slice(0, 30);

    return { boutonsSansNom, champsSansEtiquette };
  });

  const forme = await page.evaluate(() => {
    function rect(el: Element | null) {
      if (el === null) return null;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return null;
      return {
        x: Math.round(r.x),
        y: Math.round(r.y),
        largeur: Math.round(r.width),
        hauteur: Math.round(r.height),
      };
    }
    const h1 = document.querySelector("h1");
    const boutonPrincipal = document.querySelector(
      'main button, main a[role="button"], main [data-bouton-principal]',
    );
    const barre =
      document.querySelector("nav") ??
      document.querySelector('[role="navigation"]') ??
      document.querySelector("header");

    const tableaux = Array.from(document.querySelectorAll("table"))
      .filter((t) => {
        const r = t.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      })
      .map((t) => {
        const ligneEntete = t.querySelector("thead tr");
        const colonnes = ligneEntete
          ? ligneEntete.querySelectorAll("th, td").length
          : (t.querySelector("tr")?.querySelectorAll("th, td").length ?? 0);
        const lignes = Array.from(
          t.querySelectorAll("tbody tr, tr:not(:first-child)"),
        ).filter((tr) => tr.getBoundingClientRect().height > 0).length;
        return { colonnes, lignes };
      });

    const intitules = Array.from(document.querySelectorAll("h1, h2, h3"))
      .map((el) => (el.textContent ?? "").trim())
      .filter((t) => t.length > 0)
      .slice(0, 30);

    return {
      rectangleH1: rect(h1),
      rectanglePremierBouton: rect(boutonPrincipal),
      rectangleBarre: rect(barre),
      tableaux,
      intitules,
    };
  });

  return {
    defilementsEnTrop: defilementsEtDebordement.defilements,
    debordementHorizontal: defilementsEtDebordement.debordementHorizontal,
    elementsDebordants: defilementsEtDebordement.elementsDebordants,
    haloApresClicDansLeContenu: halo,
    contrastesInsuffisants,
    troncatures,
    controlesNatifs,
    imagesCassees,
    boutonsSansNom: accessibilite.boutonsSansNom,
    champsSansEtiquette: accessibilite.champsSansEtiquette,
    rectangleH1: forme.rectangleH1,
    rectanglePremierBouton: forme.rectanglePremierBouton,
    rectangleBarre: forme.rectangleBarre,
    tableaux: forme.tableaux,
    intitules: forme.intitules,
  };
}

// ── INSTRUMENTATION RÉSEAU/CONSOLE (point 1.d) ──────────────────────────────
// Posée AVANT `page.goto` : les réponses et requêtes échouées de la
// navigation elle-même ne sont visibles qu'aux écouteurs actifs par avance.

export type ReponseEnEchec = { readonly url: string; readonly statut: number };
export type RequeteEnEchec = { readonly url: string; readonly erreur: string };

export type ReleveReseau = {
  readonly reponsesEnEchec: readonly ReponseEnEchec[];
  readonly requetesAvorteesPrechargement: readonly RequeteEnEchec[];
  readonly requetesEnEchec: readonly RequeteEnEchec[];
  readonly erreursConsole: readonly string[];
  readonly erreursPage: readonly string[];
};

export type Instrumentation = {
  /** Vide les tampons — à appeler juste avant chaque `page.goto`. */
  demarrerReleve(): void;
  /** Lit les tampons accumulés depuis le dernier `demarrerReleve`. */
  releve(): ReleveReseau;
};

export function instrumenter(page: Page): Instrumentation {
  let reponsesEnEchec: ReponseEnEchec[] = [];
  let requetesAvorteesPrechargement: RequeteEnEchec[] = [];
  let requetesEnEchec: RequeteEnEchec[] = [];
  let erreursConsole: string[] = [];
  let erreursPage: string[] = [];

  page.on("response", (reponse) => {
    if (reponse.status() >= 400) {
      reponsesEnEchec.push({ url: reponse.url(), statut: reponse.status() });
    }
  });
  page.on("requestfailed", (requete) => {
    const erreur = requete.failure()?.errorText ?? "erreur inconnue";
    const entree = { url: requete.url(), erreur };
    // `net::ERR_ABORTED` sur une requête `_rsc=` est le préchargement Next.js
    // d'un lien survolé puis abandonné à la navigation suivante — pas un
    // défaut du site. On le sépare plutôt que de le mêler à un vrai échec.
    if (erreur.includes("ERR_ABORTED") || requete.url().includes("_rsc=")) {
      requetesAvorteesPrechargement.push(entree);
    } else {
      requetesEnEchec.push(entree);
    }
  });
  page.on("console", (message) => {
    if (message.type() === "error") erreursConsole.push(message.text());
  });
  page.on("pageerror", (erreur) => erreursPage.push(String(erreur)));

  return {
    demarrerReleve(): void {
      reponsesEnEchec = [];
      requetesAvorteesPrechargement = [];
      requetesEnEchec = [];
      erreursConsole = [];
      erreursPage = [];
    },
    releve(): ReleveReseau {
      return {
        reponsesEnEchec: [...reponsesEnEchec],
        requetesAvorteesPrechargement: [...requetesAvorteesPrechargement],
        requetesEnEchec: [...requetesEnEchec],
        erreursConsole: [...erreursConsole],
        erreursPage: [...erreursPage],
      };
    },
  };
}

// ── LE VERDICT AUTOMATIQUE (point 3) — JAMAIS À LA MAIN ────────────────────

export type Verdict =
  | "C"
  | "ecart mesure"
  | "non mesure"
  | "sans maquette";

function rectanglesProches(a: RectangleMesure, b: RectangleMesure): boolean {
  if (a === null || b === null) return a === b;
  return (
    Math.abs(a.x - b.x) <= 8 &&
    Math.abs(a.y - b.y) <= 8 &&
    Math.abs(a.largeur - b.largeur) <= 8 &&
    Math.abs(a.hauteur - b.hauteur) <= 8
  );
}

function tableauxIdentiques(
  a: readonly TableauMesure[],
  b: readonly TableauMesure[],
): boolean {
  if (a.length !== b.length) return false;
  return a.every((t, i) => t.colonnes === b[i]?.colonnes && t.lignes === b[i]?.lignes);
}

function memeListe(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * Calcule le verdict automatique d'un écran à une largeur — JAMAIS un
 * jugement humain. « C » exige l'absence de toute anomalie mesurée ET,
 * quand la maquette existe, une comparaison de forme qui passe.
 */
export function calculerVerdict(
 site: MesuresPage | null,
 maquette: MesuresPage | null,
 reseau: ReleveReseau | null,
 maquetteExiste: boolean,
): { verdict: Verdict; detail: readonly string[] } {
  if (site === null || reseau === null) {
    return { verdict: "non mesure", detail: ["Aucune mesure du site."] };
  }
  const detail: string[] = [];
  if (site.debordementHorizontal) detail.push("Débordement horizontal à 375.");
  if (site.elementsDebordants.length > 0) {
    detail.push(`${site.elementsDebordants.length} élément(s) débordant(s).`);
  }
  if (site.defilementsEnTrop.length > 0) {
    detail.push(`${site.defilementsEnTrop.length} défilement(s) parasite(s).`);
  }
  if (site.haloApresClicDansLeContenu) detail.push("Halo après focus du contenu.");
  if (site.contrastesInsuffisants.length > 0) {
    detail.push(`${site.contrastesInsuffisants.length} contraste(s) insuffisant(s).`);
  }
  if (site.troncatures.length > 0) {
    detail.push(`${site.troncatures.length} troncature(s).`);
  }
  if (site.imagesCassees.length > 0) {
    detail.push(`${site.imagesCassees.length} image(s) cassée(s).`);
  }
  if (site.boutonsSansNom.length > 0) {
    detail.push(`${site.boutonsSansNom.length} bouton(s) sans nom accessible.`);
  }
  if (site.champsSansEtiquette.length > 0) {
    detail.push(`${site.champsSansEtiquette.length} champ(s) sans étiquette.`);
  }
  if (reseau.reponsesEnEchec.length > 0) {
    detail.push(`${reseau.reponsesEnEchec.length} réponse(s) 4xx/5xx.`);
  }
  if (reseau.requetesEnEchec.length > 0) {
    detail.push(`${reseau.requetesEnEchec.length} requête(s) en échec.`);
  }
  if (reseau.erreursConsole.length > 0) {
    detail.push(`${reseau.erreursConsole.length} erreur(s) console.`);
  }
  if (reseau.erreursPage.length > 0) {
    detail.push(`${reseau.erreursPage.length} erreur(s) page.`);
  }

  if (!maquetteExiste) {
    return detail.length === 0
      ? { verdict: "sans maquette", detail: ["Aucune maquette pour cet écran."] }
      : { verdict: "ecart mesure", detail };
  }
  if (maquette === null) {
    return { verdict: "non mesure", detail: ["Maquette non mesurée."] };
  }
  if (!rectanglesProches(site.rectangleH1, maquette.rectangleH1)) {
    detail.push("Rectangle du h1 écarté de plus de 8px de la maquette.");
  }
  if (!rectanglesProches(site.rectanglePremierBouton, maquette.rectanglePremierBouton)) {
    detail.push("Rectangle du bouton principal écarté de plus de 8px de la maquette.");
  }
  if (!rectanglesProches(site.rectangleBarre, maquette.rectangleBarre)) {
    detail.push("Rectangle de la barre écarté de plus de 8px de la maquette.");
  }
  if (!tableauxIdentiques(site.tableaux, maquette.tableaux)) {
    detail.push("Colonnes/lignes de tableau différentes de la maquette.");
  }
  if (!memeListe(site.intitules, maquette.intitules)) {
    detail.push("Intitulés de section différents de la maquette.");
  }

  return detail.length === 0
    ? { verdict: "C", detail: [] }
    : { verdict: "ecart mesure", detail };
}
