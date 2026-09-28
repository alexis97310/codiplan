import { type TypeIntervention } from "@prisma/client";

import type { Annuaire } from "@/lib/auth/annuaire";
import type { Fuseau } from "@/lib/calendar/fuseau";
import { enDuree } from "@/lib/calendar/duree";
import { t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";
import {
  TAUX_PLEIN,
  tauxCompact,
  type OccupationTechnicien,
} from "@/lib/interventions/statistiques";
import { nomSeul } from "@/lib/interventions/personnes";
import type { DonneesMateriel } from "@/lib/machines/depot";
import { libelleMaterielComplet } from "@/lib/machines/presentation";

import { heureDuCreneau } from "../interventions/presentation";
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

/**
 * LE LIBELLÉ DU SITE, AVEC SA COMMUNE QUAND ELLE EST CONNUE
 * (9BJA-REPRISE-9BJ, point 4b) — même convention que `lieuDeLaLigne`
 * (page.tsx). *Ni la maquette ni la passation de 9BJ ne demandaient un
 * second champ séparé* : la commune complète le site, elle ne le remplace
 * pas — une seule ligne, comme avant ce lot.
 */
export function siteDeLaCarte(site: {
  readonly libelle: string;
  readonly commune: string | null;
}): string {
  const base = `${mot("site")} ${site.libelle}`;
  return site.commune === null ? base : `${base} (${site.commune})`;
}

/**
 * LE TIRET DU CRÉNEAU — exporté pour que `creneauDeLaCarte` n'ait qu'une
 * écriture, et pour qu'un scénario compose sa requête d'écran depuis cette
 * constante plutôt que depuis une chaîne recopiée (gardien
 * `tests/unit/i18n/sans-chaine-visible-en-dur.test.ts`, L0-11 : ce caractère
 * n'est pas un mot du dictionnaire — une date/heure n'y passe pas — mais un
 * test de rendu qui l'attend recopie ici, jamais un littéral).
 */
export const TIRET_CRENEAU = "–";

/**
 * LE CRÉNEAU D'UNE CARTE DE LA GRILLE SEMAINE — « 08:00–09:30 », jamais
 * l'heure de début seule (PG-C3-CARTES-COLONNES, décision QG-1 du 27/09/2026,
 * carte normalisée sur `.event` de la maquette).
 *
 * `null` sans heure de début connue — la file d'attente n'en a pas, et rien
 * n'invente une heure ici. Sans fin connue, l'intervalle retombe sur l'heure
 * de début seule : `heureDuCreneau` (`../interventions/presentation.ts`) est
 * réutilisée deux fois plutôt que recopiée, la même fonction pure qui sert déjà
 * `resumeDuCreneau` sur la fiche.
 */
export function creneauDeLaCarte(
  ligne: {
    readonly creneau_debut: Date | null;
    readonly creneau_fin: Date | null;
  },
  fuseau: Fuseau,
): string | null {
  const debut = heureDuCreneau(ligne, fuseau);
  if (debut === null) {
    return null;
  }
  const fin = heureDuCreneau({ creneau_debut: ligne.creneau_fin }, fuseau);
  return fin === null ? debut : `${debut}${TIRET_CRENEAU}${fin}`;
}

/**
 * LA CARTE DE LA FILE « À PLANIFIER » TITRÉE PAR LE CLIENT, JAMAIS PAR LE
 * SEUL NUMÉRO (99X-GR8-FILE, audit GR du 26/09/2026, constat G2).
 *
 * *Mesuré à l'audit : une carte se lisait « Local-000001 », le client rejeté
 * en sous-ligne grise — un numéro provisoire ne dit rien au planificateur qui
 * cherche son dossier.* La maquette titre par le client et sous-titre par la
 * nature (`<h4>Garage de Magenta</h4><p>Entretien pont · 2 h</p>`,
 * maquette-complete).
 *
 * **La panne signalée prime sur la nature** : c'est ce que le client a dit
 * avoir, pas la catégorie administrative de l'intervention. Même choix de
 * repli que `panneOuNature` (`../tableau-de-bord/presentation.ts`, GR7,
 * 27/09/2026) — REPRIS ICI, jamais importé : les modules `presentation.ts`
 * de deux écrans restent testables sans dépendance croisée entre eux, même
 * principe que celui qui a fait écrire `panneOuNature` plutôt qu'importer
 * `objetDuBloc` (`../interventions/presentation.ts`). `null` pour toute
 * intervention créée avant PARCOURS-1 (23/09/2026, colonne nullable) : la
 * nature comble alors le vide, jamais un tiret muet.
 */
export function panneOuNatureDeLaCarte(ligne: {
  readonly description: string | null;
  readonly type: TypeIntervention;
}): string {
  return ligne.description ?? t(`type_intervention.${ligne.type}`);
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
  return enDuree(minutes);
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

/**
 * LA BARRE DE CHARGE D'UN JOUR, DANS LA CASE (9BJA-REPRISE-9BJ, point 4c —
 * PG-C4-CHARGE point 2, que 9BJ n'avait pas fait : « demande un dénominateur
 * PAR JOUR … et de le croiser avec les interventions déjà posées dans
 * `cellule.lignes` », passation de 9BJ, « ce qui reste à faire »).
 *
 * **Formule INCHANGÉE** (`lib/interventions/statistiques.ts`, D107/D111) :
 * cette fonction ne fait que LIRE `tauxCompact`, jamais une seconde écriture
 * du taux — même raison que `TauxDUneAgence` (`page.tsx`) : passer par
 * `tauxCompact` plutôt que par `tauxOccupation` nu exempte cet affichage de
 * D56 (un technicien n'a qu'une agence, jamais deux taux — la condition de
 * réouverture est tenue par `tests/unit/interventions/taux-compact.test.ts`).
 * L'appelant construit `occupation` avec `occupationTechnicien(technicienId,
 * cellule.lignes, minutesOuvreesDuJour, SANS_TRAJET)` — le dénominateur d'UN
 * SEUL jour, jamais celui de la semaine.
 *
 * `null` SANS CALENDRIER CONNU : rien à comparer, donc pas de barre plutôt
 * qu'une barre à 0 % qui se lirait comme un fait.
 */
export type BarreChargeJour = {
  /**
   * Largeur de la barre, en pourcent, BORNÉE à 100 — c'est un gabarit visuel,
   * jamais le taux lui-même : `depasse` dit le dépassement, `infobulle` porte
   * le chiffre exact (le taux, lui, ne se plafonne pas, `tauxOccupation`).
   */
  readonly largeurPourcent: number;
  /** Au-delà de `TAUX_PLEIN` (seul seuil existant, D107) — aucun palier inventé. */
  readonly depasse: boolean;
  readonly infobulle: string;
};

export function barreChargeDuJour(
  occupation: OccupationTechnicien,
): BarreChargeJour | null {
  const compact = tauxCompact(occupation);
  if (compact.etat === "sans_calendrier") {
    return null;
  }
  const pourcent = compact.etat === "infime" ? 0 : compact.pourcent;
  return {
    largeurPourcent: Math.min(Math.max(pourcent, 0), 100),
    depasse: pourcent > TAUX_PLEIN,
    infobulle:
      `${enDuree(occupation.minutesEngagees)} ${t("statistiques.heures_engagees")}` +
      `${t("ponctuation.point_median")}${enDuree(occupation.minutesOuvrables)} ${t("statistiques.heures_ouvrables")}`,
  };
}
