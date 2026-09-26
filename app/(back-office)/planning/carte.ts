import type { Annuaire } from "@/lib/auth/annuaire";
import { t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";
import { nomSeul } from "@/lib/interventions/personnes";
import type { DonneesMateriel } from "@/lib/machines/depot";
import { libelleMaterielComplet } from "@/lib/machines/presentation";

import { decompte } from "../presentation";

/**
 * CE QUE LA VUE JOUR DIT, EN PLUS DE LA GRILLE ELLE-MÊME (PLANNING-2 ;
 * résumé d'en-tête ajouté par 99G-PLANNING-JOUR, 26/09/2026).
 *
 * *Mesuré le 23/09/2026 en production : une carte se lisait « SIDAPS /
 * Curatif », sans heure saisie — deux interventions du même jour chez le même
 * client étaient indiscernables, et rien ne disait le SITE ni la DURÉE.*
 *
 * Séparé de `page.tsx` pour que ces fonctions PURES s'éprouvent seules
 * (`tests/unit/planning/carte.test.ts`), sans lever de contexte cloisonné —
 * `resumeDesTechniciens` en profite au même titre que les trois fonctions de
 * carte, bien qu'elle résume l'EN-TÊTE de la vue et non une carte : aucune
 * seconde maison pour « une fonction pure de la vue jour, testable seule »
 * n'existait, et en ouvrir une aurait été une seconde écriture du même motif
 * (§9, 01/09).
 */

/** Le libellé du site — même convention que `lieuDeLaLigne` (page.tsx). */
export function siteDeLaCarte(site: { readonly libelle: string }): string {
  return `${mot("site")} ${site.libelle}`;
}

/**
 * LE MATÉRIEL D'UNE CARTE — famille, marque, référence, numéro de série
 * (AFFICHAGE-MATERIEL-1, 23/09/2026).
 *
 * *Mesuré le 23/09/2026 en production : une carte se lisait « SIDAPS /
 * Curatif » sans dire QUEL matériel.* Une intervention sans machine affectée
 * n'est pas une donnée manquante — RG-INT-01 autorise le dépannage à
 * l'aveugle —, et le mot le dit plutôt qu'un tiret muet. **Plusieurs
 * machines** se joignent par une virgule, comme `machinesAffichees`
 * (`../interventions/presentation.ts`) le fait déjà pour le registre : ni
 * l'une ni l'autre ne borne leur nombre (chapitre 11.3).
 */
export function materielDeLaCarte(
  ligne: { readonly machines: readonly { readonly machine_id: string }[] },
  donneesMateriel: ReadonlyMap<string, DonneesMateriel>,
): string {
  if (ligne.machines.length === 0) {
    return t("planning.materiel_non_precise");
  }
  return ligne.machines
    .map((m) => {
      const donnees = donneesMateriel.get(m.machine_id);
      return donnees === undefined
        ? t("planning.materiel_non_precise")
        : libelleMaterielComplet(donnees);
    })
    .join(", ");
}

/**
 * LA DURÉE D'UNE CARTE — « 1 h 30 », jamais un zéro.
 *
 * **`null` pour une durée inconnue ou nulle** — l'écran ne l'affiche alors pas
 * du tout : un zéro écrit se lirait comme une mesure, et il n'y en a pas à
 * faire (l'alerte « sans durée saisie » existe déjà dans le panneau de charge,
 * cette carte ne la duplique pas).
 */
export function dureeCarteAffichee(minutes: number): string | null {
  if (minutes <= 0) {
    return null;
  }
  const heures = Math.floor(minutes / 60);
  const reste = minutes % 60;
  if (heures === 0) {
    return `${reste} ${t("terrain.minutes")}`;
  }
  return `${heures} ${t("terrain.heures")} ${String(reste).padStart(2, "0")}`;
}

/** Le minimum qu'une colonne de la vue jour porte pour se résumer. */
export type ColonneAResumer = {
  readonly technicienId: string | null;
  readonly bloquee: boolean;
};

/**
 * QUI EST LÀ, ET QUI EST BLOQUÉ, EN TÊTE DE LA VUE JOUR (99G-PLANNING-JOUR,
 * audit d'ergonomie du 25/09/2026, constat 14).
 *
 * *Mesuré le 25/09/2026, à 1280 px : l'en-tête disait « 56 créneaux libres »
 * sans dire QUI travaille ce jour-là ni QUI est injoignable — la légende qui
 * le disait était à ~1 480 px du haut, sous la grille entière.*
 *
 * **La colonne sans technicien (`technicienId` nul) ne compte pas** : ce
 * n'est personne à nommer (voir `quiTravaille`), et la compter aurait fait
 * dire « 5 techniciens » quand 4 seulement sont des personnes.
 *
 * **Le compte de blocages ne remplace jamais le compte de créneaux libres**
 * (`docs/backlog.md`, ticket R2-14) : cette fonction ne rend QUE la partie
 * « qui », le résumé des trous restant celui de `resumeDesTrous` (page.tsx),
 * composé À CÔTÉ, jamais à sa place.
 *
 * Un nom manquant (`nomSeul` rend `null` — refus ou anomalie du cloisonnement)
 * est tu plutôt qu'inventé : le compte reste vrai, la parenthèse se réduit
 * aux noms qu'on a le droit de dire.
 */
export function resumeDesTechniciens(
  colonnes: readonly ColonneAResumer[],
  annuaire: Annuaire,
): string {
  const techniciens = colonnes.filter(
    (colonne): colonne is ColonneAResumer & { technicienId: string } =>
      colonne.technicienId !== null,
  );
  const base = decompte(
    techniciens.length,
    t("planning.resume_technicien_un"),
    t("planning.resume_techniciens"),
  );
  const bloques = techniciens.filter((colonne) => colonne.bloquee);
  if (bloques.length === 0) {
    return base;
  }
  const compte = decompte(
    bloques.length,
    t("planning.resume_agenda_bloque_un"),
    t("planning.resume_agendas_bloques"),
  );
  const noms = bloques
    .map((colonne) => nomSeul(colonne.technicienId, annuaire))
    .filter((nom): nom is string => nom !== null);
  const parenthese = noms.length > 0 ? ` (${noms.join(", ")})` : "";
  return `${base} · ${compte}${parenthese}`;
}
