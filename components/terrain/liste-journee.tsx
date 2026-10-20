"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Priorite } from "@/components/ui/priorite";
import {
  minutesDepuisMinuit,
  versLocal,
  type Fuseau,
  type JourLocal,
} from "@/lib/calendar/fuseau";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";
import type { LignePlanning } from "@/lib/interventions/depot";
import { CLASSES_LIEN } from "@/lib/theme/apparence";
import { CLASSES_STATUT, type StatutAffiche } from "@/lib/theme/statuts";
import { marquerOuverte, mettreAJourVues } from "@/lib/terrain/vues-locales";

import {
  jourEtDateAbregee,
  machinesAffichees,
} from "@/app/(back-office)/interventions/presentation";

import {
  libelleDatesSuite,
  libelleJoursSuivantsVide,
  libelleTitreDemain,
  premiereLignePanne,
} from "./presentation";

/**
 * LA LISTE DE MA JOURNÉE (9F4H5-TERRAIN-VIVANT, point 3) — reprend TEL QUEL
 * ce que `app/(mobile)/terrain/page.tsx` composait en server component
 * (`Section`, `SectionJoursSuivants`, `Carte`), déplacé ici pour une seule
 * raison : savoir si une intervention est « Nouvelle » (point 3) est une
 * mémoire D'APPAREIL (`localStorage`), illisible côté serveur. Une seule
 * composante calcule cette nouveauté, UNE FOIS, pour TOUTE la liste — jamais
 * chaque carte séparément, qui s'exposerait à lire la mémoire avant qu'elle
 * ait été mise à jour pour les cartes précédentes du même rendu.
 *
 * L'annonce `role="status"` (point 3) est posée EN TÊTE de cette liste,
 * avant « En retard » — elle compte les pastilles PAS ENCORE OUVERTES parmi
 * ce qui est affiché MAINTENANT, pas seulement celles détectées à ce rendu
 * précis : rouvrir Ma journée sans avoir ouvert une fiche annoncée doit
 * encore l'annoncer (voir le docblock de `lib/terrain/vues-locales.ts`).
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
  libellesMachines,
  utilisateurId,
}: {
  readonly journee: {
    readonly enRetard: readonly LignePlanning[];
    readonly aujourdHui: readonly LignePlanning[];
    readonly demain: readonly LignePlanning[];
    readonly suite: {
      readonly nombre: number;
      readonly dates: readonly JourLocal[];
    };
    readonly sansDate: readonly LignePlanning[];
  };
  /** « Aujourd'hui », au sens calendaire — distinct de `journee.aujourdHui`,
   * qui est la LISTE des lignes du jour, pas le jour lui-même. */
  readonly jourActuel: JourLocal;
  readonly fuseau: Fuseau;
  readonly libellesMachines: ReadonlyMap<string, string>;
  readonly utilisateurId: string;
}) {
  const lignesAffichees = [
    ...journee.enRetard,
    ...journee.aujourdHui,
    ...journee.demain,
    ...journee.sansDate,
  ];
  const [enAttente, setEnAttente] = useState<ReadonlySet<string>>(new Set());
  const idsAffiches = lignesAffichees.map((ligne) => ligne.id);
  // UNE CLÉ STABLE, JAMAIS LE TABLEAU LUI-MÊME (point 3, 9F4H5-TERRAIN-
  // VIVANT) — `lignesAffichees` est un littéral neuf à CHAQUE rendu (la
  // page serveur le reconstruit), et `useEffect` exige un tableau de
  // dépendances de TAILLE CONSTANTE : y étaler les ids un par un ferait
  // varier cette taille d'un rendu à l'autre, ce que React refuse. La clé
  // capture le même fait (le contenu a changé) sans violer la règle.
  const idsAffichesCle = idsAffiches.join(",");

  useEffect(() => {
    const resultat = mettreAJourVues(utilisateurId, idsAffiches);
    setEnAttente(resultat.enAttente);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `idsAffichesCle` est la forme stable du même contenu que `idsAffiches` ; les deux dans les dépendances redirait la même chose deux fois (§9, 01/09).
  }, [utilisateurId, idsAffichesCle]);

  const nombreEnAttenteAffiche = lignesAffichees.filter((ligne) =>
    enAttente.has(ligne.id),
  ).length;

  function ouvrir(id: string): void {
    marquerOuverte(utilisateurId, id);
  }

  return (
    <>
      {nombreEnAttenteAffiche === 0 ? null : (
        <p
          role="status"
          className="border-app-bleu-bord bg-app-bleu-fond text-app-bleu-encre rounded-md border px-3 py-2 text-16 font-bold"
        >
          {libelleAnnonceNouvelles(nombreEnAttenteAffiche)}
        </p>
      )}

      {journee.enRetard.length === 0 ? null : (
        <Section
          titre={t("terrain.en_retard")}
          lignes={journee.enRetard}
          vide={t("terrain.rien_aujourdhui")}
          fuseau={fuseau}
          libellesMachines={libellesMachines}
          enAttente={enAttente}
          onOuvrir={ouvrir}
          enRetard
        />
      )}

      <Section
        titre={t("terrain.aujourdhui")}
        lignes={journee.aujourdHui}
        vide={t("terrain.rien_aujourdhui")}
        fuseau={fuseau}
        libellesMachines={libellesMachines}
        enAttente={enAttente}
        onOuvrir={ouvrir}
      />

      <Section
        titre={libelleTitreDemain(jourActuel)}
        lignes={journee.demain}
        vide={t("terrain.demain.vide")}
        fuseau={fuseau}
        libellesMachines={libellesMachines}
        enAttente={enAttente}
        onOuvrir={ouvrir}
      />

      <SectionJoursSuivants suite={journee.suite} aujourdHui={jourActuel} />

      {journee.sansDate.length === 0 ? null : (
        <Section
          titre={t("terrain.sans_date")}
          lignes={journee.sansDate}
          vide={t("terrain.rien_aujourdhui")}
          fuseau={fuseau}
          libellesMachines={libellesMachines}
          enAttente={enAttente}
          onOuvrir={ouvrir}
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
  libellesMachines,
  enAttente,
  onOuvrir,
  enRetard = false,
}: {
  readonly titre: string;
  readonly lignes: readonly LignePlanning[];
  readonly vide: string;
  readonly fuseau: Fuseau;
  readonly libellesMachines: ReadonlyMap<string, string>;
  readonly enAttente: ReadonlySet<string>;
  readonly onOuvrir: (id: string) => void;
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
              libellesMachines={libellesMachines}
              estNouvelle={enAttente.has(ligne.id)}
              onOuvrir={onOuvrir}
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
  libellesMachines,
  estNouvelle,
  onOuvrir,
  enRetard = false,
}: {
  readonly ligne: LignePlanning;
  readonly fuseau: Fuseau;
  readonly libellesMachines: ReadonlyMap<string, string>;
  readonly estNouvelle: boolean;
  readonly onOuvrir: (id: string) => void;
  readonly enRetard?: boolean;
}) {
  const cleStatut = `statut.${ligne.statut}`;
  const panne = premiereLignePanne(ligne.description);
  return (
    <li>
      <Link
        href={`/terrain/${ligne.id}`}
        onClick={() => onOuvrir(ligne.id)}
        className={`bg-app-surface border-app-bord flex flex-col gap-1.5 rounded-lg border px-4 py-3 ${CLASSES_LIEN}`}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5">
            <Priorite valeur={ligne.priorite} />
            <span className="text-16 font-bold tabular-nums">
              {heureOuTiret(ligne.creneau_debut, ligne.creneau_fin, fuseau)}
            </span>
          </span>
          <span className="flex items-center gap-1.5">
            {/* LE BADGE « NOUVEAU » (AVERTISSEMENTS-1) — tant que la fiche
              n'a pas été ouverte par CE technicien ; voir
              `marquerVuParTechnicien`, appelée par `/terrain/[id]`. */}
            {ligne.vue_technicien_le === null ? (
              <span className="border-app-orange-bord bg-app-orange-fond text-app-orange-encre rounded-full border px-2 py-0.5 text-12 font-bold">
                {t("terrain.badge_nouveau")}
              </span>
            ) : null}
            {/* LE BADGE « NOUVELLE » (point 3, 9F4H5-TERRAIN-VIVANT) — une
              mémoire D'APPAREIL, distincte de `vue_technicien_le` ci-dessus
              (voir le docblock de `lib/terrain/vues-locales.ts`). */}
            {estNouvelle ? (
              <span className="border-app-bleu-bord bg-app-bleu-fond text-app-bleu-encre rounded-full border px-2 py-0.5 text-12 font-bold">
                {t("terrain.badge_nouvelle")}
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
        {ligne.machines.length === 0 ? null : (
          <p className="text-app-encre-faible truncate text-16 font-bold">
            {machinesAffichees(ligne, libellesMachines)}
          </p>
        )}
        {panne === null ? null : (
          <p className="truncate text-16 font-bold">{panne}</p>
        )}
        {/* LA CARTE « EN RETARD » PORTE SA PROPRE DATE (9F2-TERRAIN-JOURS-
          MAQUETTE, D210) — elle n'est jamais dans la section « Aujourd'hui »
          ou « Demain », et sans cette ligne, rien à l'écran ne dirait QUAND
          elle était attendue. */}
        {!enRetard || ligne.date_planifiee === null ? null : (
          <p className="text-app-rouge-encre text-16 font-bold">
            {t("terrain.carte.en_retard_prevue")}{" "}
            {jourEtDateAbregee(ligne.date_planifiee, false)}
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
