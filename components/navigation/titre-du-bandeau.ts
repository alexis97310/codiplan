/**
 * LE TITRE DU BANDEAU, SANS LA PASTILLE (9AD-GR13-FICHE-TELEPHONE, constat
 * G11 de l'audit du 26/09/2026) — extrait du `<h1>` lu par `BandeauMobile`.
 *
 * `<h1>` porte parfois DEUX morceaux : le titre de l'écran, et une pastille
 * de statut (`data-hors-bandeau`, ex. la fiche intervention) collée juste
 * derrière — `element.textContent` les concatène sans espace, et le bandeau
 * affichait « Intervention I-000123Terminée ». Cette fonction retire tout
 * descendant marqué `data-hors-bandeau` (même imbriqué) avant de lire le
 * texte restant.
 */
export function titreDuBandeau(h1: Element): string {
  const clone = h1.cloneNode(true) as Element;
  clone
    .querySelectorAll("[data-hors-bandeau]")
    .forEach((noeud) => noeud.remove());
  return (clone.textContent ?? "").replace(/\s+/g, " ").trim();
}
