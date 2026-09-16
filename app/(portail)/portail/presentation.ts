import { t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";

import type { MachineDuPortail, SiteDuPortail } from "@/lib/portail/depot";

/**
 * CE QUE L'ÉCRAN DU PORTAIL ÉCRIT, COMPOSÉ HORS DU JSX (L0-11).
 *
 * La ponctuation de liaison — le tiret cadratin, les deux-points — est du texte
 * qu'un humain lit. Écrite entre deux accolades dans une page, elle est une
 * chaîne en dur, et le gardien de L0-11 la refuse à juste titre : *c'est la
 * DESTINATION du texte qui décide, jamais sa longueur.*
 *
 * Elle vit donc ici, dans un module sans JSX, à côté des libellés qu'elle
 * relie — même rangement que `app/(back-office)/interventions/presentation.ts`.
 */

/** La ponctuation de liaison. Écrite UNE fois, pour ne pas diverger. */
const TIRET = "—";
const DEUX_POINTS = ":";

/** « Vos sites » — la notion est nommée, jamais le mot (D5, D47). */
export function titreDesSites(): string {
  return `${t("portail.vos")} ${mot("site", true)}`;
}

/** « Atelier principal — Nouméa », ou le libellé seul quand la commune manque. */
export function libelleDuSite(site: SiteDuPortail): string {
  return site.commune === null
    ? site.libelle
    : `${site.libelle} ${TIRET} ${site.commune}`;
}

/** « Site : Atelier principal ». Le libellé vient de la carte des sites lus. */
export function siteDeLaMachine(
  machine: MachineDuPortail,
  libelleParId: ReadonlyMap<string, string>,
): string {
  return `${mot("site")} ${DEUX_POINTS} ${libelleParId.get(machine.siteId) ?? ""}`;
}

/** « Emplacement : quai 3 ». Rendu vide quand la machine n'en porte pas. */
export function emplacementDeLaMachine(machine: MachineDuPortail): string {
  return machine.localisation === null
    ? ""
    : `${t("portail.machine.localisation")} ${DEUX_POINTS} ${machine.localisation}`;
}

/**
 * LES DEUX PLACES RÉSERVÉES — lots 8 (D87) et 9 (D88), non construits.
 *
 * Elles disent qu'elles sont VIDES. Elles n'affichent ni un compte de documents
 * à zéro, ni un état VGP « à jour » : le premier se lirait comme une mesure
 * (§9, 06/09), et le second serait faux au sens de D88 — *« sans information »
 * n'est ni « à jour » ni « en retard ».*
 */
export function placeDesDocuments(): string {
  return `${t("portail.documents")} ${TIRET} ${t("portail.documents.a_venir")}`;
}

export function placeDuVgp(): string {
  return `${t("portail.vgp")} ${TIRET} ${t("portail.vgp.sans_information")}`;
}
