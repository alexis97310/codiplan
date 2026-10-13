import type { Page } from "@playwright/test";

/**
 * LES SIX MESURES AUTOMATIQUES DU POINT 4 DU TICKET — calculées dans la page,
 * sur le SITE rendu (jamais sur la maquette, qui n'est qu'une référence
 * visuelle) : la barre de défilement parasite se mesure comme un vrai
 * écran la montrerait, pas comme une capture d'écran la dessinerait.
 */
export type MesuresPage = {
  readonly defilementsEnTrop: readonly string[];
  readonly debordementHorizontal: boolean;
  readonly haloApresClicDansLeContenu: boolean;
  readonly contrastesInsuffisants: readonly string[];
  readonly troncatures: readonly string[];
  readonly controlesNatifs: readonly string[];
  readonly imagesCassees: readonly string[];
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
    const debordementHorizontal =
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth + 1;
    return { defilements, debordementHorizontal };
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

  return {
    defilementsEnTrop: defilementsEtDebordement.defilements,
    debordementHorizontal: defilementsEtDebordement.debordementHorizontal,
    haloApresClicDansLeContenu: halo,
    contrastesInsuffisants,
    troncatures,
    controlesNatifs,
    imagesCassees,
  };
}
