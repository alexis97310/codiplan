"use client";

import Link from "next/link";

import { Priorite } from "@/components/ui/priorite";
import {
  minutesDepuisMinuit,
  versLocal,
  type Fuseau,
  type JourLocal,
} from "@/lib/calendar/fuseau";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";
import type { LigneJourneeAffichee } from "@/lib/terrain/projection-journee";
import { CLASSES_LIEN } from "@/lib/theme/apparence";
import { CLASSES_STATUT, type StatutAffiche } from "@/lib/theme/statuts";

import {
  libelleDatesSuite,
  libelleJoursSuivantsVide,
  libelleTitreDemain,
} from "./presentation";

/**
 * LA LISTE DE MA JOURNÉE — reprend TEL QUEL ce que `app/(mobile)/terrain/
 * page.tsx` composait en server component (`Section`, `SectionJoursSuivants`,
 * `Carte`), déplacé ici pour pouvoir réagir au rafraîchissement automatique
 * sans recharger la page (`components/terrain/rafraichissement-auto.tsx`).
 *
 * UN SEUL COMPOSANT CLIENT, UNE SEULE PORTE D'ENTRÉE (9F4H5B-JOURNEE-SANS-
 * MONTANT, point 1) : il ne reçoit que `LigneJourneeAffichee`
 * (`lib/terrain/projection-journee.ts`), jamais `LignePlanning` — qui porte
 * les montants, les temps et les champs internes que la matrice du §5.2
 * refuse au technicien, et qu'un composant "use client" sérialiserait vers
 * le téléphone au premier rendu.
 *
 * LA PASTILLE « NOUVEAU » (point 2) EST LA SEULE, FONDÉE SUR LE SERVEUR
 * (`vue_technicien_le`, AVERTISSEMENTS-1) — 9F4H5-TERRAIN-VIVANT en posait
 * une SECONDE, tenue par une mémoire D'APPAREIL (`lib/terrain/vues-locales.ts`,
 * retiré par ce lot) : le pilote avait mesuré à tort qu'aucune colonne « vue »
 * n'existait déjà côté serveur. Une mémoire locale donnait en plus de faux
 * « nouveau » à chaque changement de jour (les lignes de J+2 à J+7 ne sont
 * jamais « connues » de l'appareil).
 *
 * L'annonce `role="status"` est posée EN TÊTE de cette liste, avant « En
 * retard » — elle compte les lignes affichées dont `vue_technicien_le` est
 * nul. Elle reste TOUJOURS dans le DOM, texte vide quand ce compte est nul :
 * un lecteur d'écran n'annonce la mise à jour d'une région vivante que si
 * cette région existait déjà avant le changement (le rafraîchissement
 * automatique la remplit sans qu'aucune fiche n'ait été rouverte).
 */

/** `N nouvelle(s) intervention(s) transmise(s)` — composé hors du JSX (L0-11). */
function libelleAnnonceNouvelles(n: number): string {
  const suffixe =
    n === 1 ? t("terrain.nouvelles.singulier") : t("terrain.nouvelles.pluriel");
  return `${n} ${suffixe}`;
}

export function ListeJournee({
  journee,
  jourActuel,
  fuseau,
}: {
  readonly journee: {
    readonly enRetard: readonly LigneJourneeAffichee[];
    readonly aujourdHui: readonly LigneJourneeAffichee[];
    readonly demain: readonly LigneJourneeAffichee[];
    readonly suite: {
      readonly nombre: number;
      readonly dates: readonly JourLocal[];
    };
    readonly sansDate: readonly LigneJourneeAffichee[];
  };
  /** « Aujourd'hui », au sens calendaire — distinct de `journee.aujourdHui`,
   * qui est la LISTE des lignes du jour, pas le jour lui-même. */
  readonly jourActuel: JourLocal;
  readonly fuseau: Fuseau;
}) {
  const lignesAffichees = [
    ...journee.enRetard,
    ...journee.aujourdHui,
    ...journee.demain,
    ...journee.sansDate,
  ];
  const nombreNonOuvertes = lignesAffichees.filter(
    (ligne) => ligne.vue_technicien_le === null,
  ).length;

  return (
    <>
      <p
        role="status"
        className={
          nombreNonOuvertes === 0
            ? "sr-only"
            : "border-app-bleu-bord bg-app-bleu-fond text-app-bleu-encre rounded-md border px-3 py-2 text-16 font-bold"
        }
      >
        {nombreNonOuvertes === 0
          ? ""
          : libelleAnnonceNouvelles(nombreNonOuvertes)}
      </p>

      {journee.enRetard.length === 0 ? null : (
        <Section
          titre={t("terrain.en_retard")}
          lignes={journee.enRetard}
          vide={t("terrain.rien_aujourdhui")}
          fuseau={fuseau}
          enRetard
        />
      )}

      <Section
        titre={t("terrain.aujourdhui")}
        lignes={journee.aujourdHui}
        vide={t("terrain.rien_aujourdhui")}
        fuseau={fuseau}
      />

      <Section
        titre={libelleTitreDemain(jourActuel)}
        lignes={journee.demain}
        vide={t("terrain.demain.vide")}
        fuseau={fuseau}
      />

      <SectionJoursSuivants suite={journee.suite} aujourdHui={jourActuel} />

      {journee.sansDate.length === 0 ? null : (
        <Section
          titre={t("terrain.sans_date")}
          lignes={journee.sansDate}
          vide={t("terrain.rien_aujourdhui")}
          fuseau={fuseau}
        />
      )}
    </>
  );
}

function Section({
  titre,
  lignes,
  vide,
  fuseau,
  enRetard = false,
}: {
  readonly titre: string;
  readonly lignes: readonly LigneJourneeAffichee[];
  readonly vide: string;
  readonly fuseau: Fuseau;
  readonly enRetard?: boolean;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-app-encre-faible text-[12px] font-bold tracking-[0.6px] uppercase">
        {titre}
      </h2>
      {lignes.length === 0 ? (
        <p className="bg-app-surface border-app-bord text-app-encre-faible rounded-lg border px-4 py-6 text-center text-16 font-bold">
          {vide}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {lignes.map((ligne) => (
            <Carte
              key={ligne.id}
              ligne={ligne}
              fuseau={fuseau}
              enRetard={enRetard}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * « LES JOURS SUIVANTS » — UN RÉSUMÉ, JAMAIS DES CARTES (9F2-TERRAIN-JOURS-
 * MAQUETTE, D210).
 *
 * **Aucun lien** : à la différence des autres sections, cette carte ne mène
 * nulle part — la page Profil n'affiche aucune intervention, et un lien qui
 * n'y mènerait à rien serait une impasse (écart nommé à la maquette du
 * 28/09, voir `docs/arbitrages.md`, D210).
 */
function SectionJoursSuivants({
  suite,
  aujourdHui,
}: {
  readonly suite: {
    readonly nombre: number;
    readonly dates: readonly JourLocal[];
  };
  readonly aujourdHui: JourLocal;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-app-encre-faible text-[12px] font-bold tracking-[0.6px] uppercase">
        {t("terrain.jours_suivants.titre")}
      </h2>
      {suite.nombre === 0 ? (
        <p className="bg-app-surface border-app-bord text-app-encre-faible rounded-lg border px-4 py-6 text-center text-16 font-bold">
          {libelleJoursSuivantsVide(aujourdHui)}
        </p>
      ) : (
        <p className="bg-app-surface border-app-bord flex flex-col gap-1 rounded-lg border px-4 py-3">
          <span className="text-16 font-semibold">
            {suite.nombre}{" "}
            {suite.nombre === 1
              ? t("terrain.jours_suivants.intervention_singulier")
              : t("terrain.jours_suivants.interventions_pluriel")}
          </span>
          <span className="text-app-encre-faible text-16 font-bold">
            {libelleDatesSuite(suite.dates)}
          </span>
        </p>
      )}
    </section>
  );
}

/**
 * UNE CARTE, ET NON UNE LIGNE DE TABLEAU.
 *
 * *Un tableau à cinq colonnes se lit de travers à 390 px* : ou bien il déborde,
 * ou bien ses colonnes deviennent illisibles. La carte empile — l'heure et le
 * statut en tête, le client, puis le lieu — et se lit du pouce.
 */
function Carte({
  ligne,
  fuseau,
  enRetard = false,
}: {
  readonly ligne: LigneJourneeAffichee;
  readonly fuseau: Fuseau;
  readonly enRetard?: boolean;
}) {
  const cleStatut = `statut.${ligne.statut}`;
  return (
    <li>
      <Link
        href={`/terrain/${ligne.id}`}
        className={`bg-app-surface border-app-bord flex flex-col gap-1.5 rounded-lg border px-4 py-3 ${CLASSES_LIEN}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          <span className="flex min-w-0 flex-wrap items-center gap-1.5">
            <Priorite valeur={ligne.priorite} />
            <span className="text-16 font-bold tabular-nums">
              {heureOuTiret(ligne.creneau_debut, ligne.creneau_fin, fuseau)}
            </span>
          </span>
          <span className="flex min-w-0 flex-wrap items-center gap-1.5">
            {/* LE BADGE « NOUVEAU » (AVERTISSEMENTS-1) — tant que la fiche
              n'a pas été ouverte par CE technicien ; voir
              `marquerVuParTechnicien`, appelée par `/terrain/[id]`. SEULE
              pastille de nouveauté depuis ce lot (point 2) — fondée sur
              `vue_technicien_le`, jamais sur une mémoire d'appareil. */}
            {ligne.vue_technicien_le === null ? (
              <span className="border-app-orange-bord bg-app-orange-fond text-app-orange-encre rounded-full border px-2 py-0.5 text-12 font-bold">
                {t("terrain.badge_nouveau")}
              </span>
            ) : null}
            <span
              className={`${CLASSES_STATUT[ligne.statut as StatutAffiche]} rounded-full px-2 py-0.5 text-12 font-bold`}
            >
              {estCleTraduction(cleStatut) ? t(cleStatut) : ligne.statut}
            </span>
          </span>
        </div>
        <p className="text-16 font-semibold">{ligne.client.raison_sociale}</p>
        <p className="text-app-encre-faible text-16 font-bold">
          {lieuDit(ligne.site.libelle)}
        </p>
        {/* LE TYPE, parce qu'une carte qui dit OÙ sans dire QUOI envoie
          quelqu'un en déplacement sans lui dire ce qu'il va faire. Le libellé
          vient du dictionnaire, jamais de l'énumération : `curatif` est un nom
          de statut, et un nom de statut ne se lit pas à l'écran (L0-11). */}
        <p className="text-app-encre-faible text-16 font-bold">
          {typeLu(ligne.type)}
        </p>
        {ligne.machinesLibelle === null ? null : (
          <p className="text-app-encre-faible truncate text-16 font-bold">
            {ligne.machinesLibelle}
          </p>
        )}
        {ligne.panneResume === null ? null : (
          <p className="truncate text-16 font-bold">{ligne.panneResume}</p>
        )}
        {/* LA CARTE « EN RETARD » PORTE SA PROPRE DATE (9F2-TERRAIN-JOURS-
          MAQUETTE, D210) — elle n'est jamais dans la section « Aujourd'hui »
          ou « Demain », et sans cette ligne, rien à l'écran ne dirait QUAND
          elle était attendue. */}
        {!enRetard || ligne.enRetardPrevueLibelle === null ? null : (
          <p className="text-app-rouge-encre text-16 font-bold">
            {t("terrain.carte.en_retard_prevue")} {ligne.enRetardPrevueLibelle}
          </p>
        )}
      </Link>
    </li>
  );
}

/** Le libellé du type d'intervention, ou son code si le dictionnaire l'ignore. */
function typeLu(type: string): string {
  const cle = `type_intervention.${type}`;
  return estCleTraduction(cle) ? t(cle) : type;
}

/**
 * `Site : Atelier Ducos` — composé hors du JSX, où aucun littéral n'est admis
 * (L0-11). Le mot vient du vocabulaire imposé, jamais écrit en toutes lettres :
 * « agence » et « site » ne sont pas interchangeables, et le code nomme la
 * notion.
 */
function lieuDit(libelle: string): string {
  return `${mot("site")} : ${libelle}`;
}

/** `08:00 – 10:00`, ou un tiret quand le créneau n'est pas posé. */
function heureOuTiret(
  debut: Date | null,
  fin: Date | null,
  fuseau: Fuseau,
): string {
  if (debut === null) {
    return t("terrain.sans_creneau");
  }
  const depart = enHeureLocale(debut, fuseau);
  return fin === null ? depart : `${depart} – ${enHeureLocale(fin, fuseau)}`;
}

function enHeureLocale(instant: Date, fuseau: Fuseau): string {
  const minutes = minutesDepuisMinuit(versLocal(instant, fuseau));
  const heures = Math.floor(minutes / 60);
  return `${String(heures).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
