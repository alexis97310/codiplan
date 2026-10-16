import type { Metadata } from "next";

import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { BandeauCompteurEnCours } from "@/components/terrain/bandeau-compteur";
import {
  libelleDatesSuite,
  libelleJoursSuivantsVide,
  libelleTitreDemain,
  premiereLignePanne,
} from "@/components/terrain/presentation";
import { Priorite } from "@/components/ui/priorite";
import { obtenirSession } from "@/lib/auth/session";
import { avecContexteApplicatif } from "@/lib/db/client";
import { fuseauDuTechnicien } from "@/lib/calendar/technicien";
import {
  instantDuJour,
  jourDe,
  jourSuivant,
  maintenant,
  minutesDepuisMinuit,
  versLocal,
  type Fuseau,
  type JourLocal,
} from "@/lib/calendar/fuseau";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";
import {
  interventionsEnRetard,
  listerPlanning,
  type LignePlanning,
} from "@/lib/interventions/depot";
import { compteurEnCours } from "@/lib/interventions/depot-compteur";
import { repartirJourneeTechnicien } from "@/lib/interventions/journee-technicien";
import { perimetreDuPlanning } from "@/lib/interventions/perimetre-technicien";
import { donneesMaterielDesMachines } from "@/lib/machines/depot";
import { libelleMaterielComplet } from "@/lib/machines/presentation";
import { CLASSES_LIEN } from "@/lib/theme/apparence";
import { CLASSES_STATUT, type StatutAffiche } from "@/lib/theme/statuts";

import {
  jourEtDateAbregee,
  machinesAffichees,
} from "@/app/(back-office)/interventions/presentation";

export const metadata: Metadata = { title: t("terrain.titre") };

/**
 * LA JOURNÉE DU TECHNICIEN — le premier écran de l'application de terrain
 * (R5-01, première moitié de L3-08).
 *
 * ## CE QU'IL MONTRE, ET RIEN D'AUTRE
 *
 * Ses interventions, à lui — en retard, aujourd'hui, demain, les sept jours
 * suivants (un résumé seulement), et sans date (9F2-TERRAIN-JOURS-MAQUETTE,
 * décision n° 92 d'Alexis, D210 : la maquette du 28/09 et le CDC §13.3
 * prévoyaient plus qu'une seule journée). Pas de montant — la matrice du §5.2
 * ne donne au technicien aucun `voir_montants_vente` —, pas de charge, pas de
 * grille, pas de collègue. *Un écran de terrain qui montre le planning de
 * l'agence est un écran de back-office affiché sur un téléphone.*
 *
 * ## LE FILTRE N'EST PAS ÉCRIT ICI, ET C'EST LE POINT
 *
 * `listerPlanning` applique le périmètre de `perimetre-technicien.ts`, qui lit
 * la matrice. Cette page n'écrit **aucune** comparaison d'identité : une
 * seconde lecture du même critère divergerait en silence, et elle divergerait
 * sur « qui voit quoi » (§9, 01/09).
 *
 * Ce que la page lit de ce module est une seule chose — **pour qui cet écran
 * est fait**. Un rôle à accès complet est renvoyé au back-office : le planning
 * d'une agence a déjà son écran, et le lui rendre ici en ferait un second, que
 * personne ne tiendrait d'accord avec le premier.
 *
 * ## L'HEURE VIENT DU FUSEAU DE L'AGENCE, JAMAIS DE L'APPAREIL (L0-08)
 *
 * Le téléphone d'un technicien en déplacement peut porter n'importe quel
 * fuseau. Le jour affiché est celui de son agence de rattachement — celle de
 * `technicien.agence_id`, qui est déjà celle qui décide de son calendrier
 * (D72, I7) — et retombe sur celui de la société quand l'agence n'en porte
 * pas, exactement comme à l'écriture.
 *
 * ## LES LIGNES SANS DATE SONT MONTRÉES, ET SÉPARÉMENT
 *
 * `listerPlanning` rend aussi ce qui n'a pas de date. Les taire ferait
 * disparaître du travail qui lui est bel et bien affecté ; les mêler à la
 * journée ferait croire qu'il est attendu aujourd'hui. *Deux sections, parce
 * que ce sont deux faits.*
 *
 * ## CHAQUE CARTE MÈNE À SON INTERVENTION
 *
 * Le lien est arrivé avec sa destination, et pas avant : *un lien vers un 404
 * se lit comme une panne* (D95, à propos des entrées inertes). `/terrain/<id>`
 * porte le détail et le compteur.
 *
 * **La carte ENTIÈRE est le lien, et c'est une décision de doigt** : une cible
 * de la taille d'un mot se rate sur un téléphone tenu d'une main, souvent avec
 * des gants.
 */
export default async function PageTerrain() {
  const session = await obtenirSession(await headers());
  if (session === null) {
    redirect("/connexion");
  }
  if (session.contexte.societeId === null || session.contexte.role === null) {
    redirect("/arrivee");
  }
  const contexte = {
    ...session.contexte,
    societeId: session.contexte.societeId,
    role: session.contexte.role,
  };

  const perimetre = perimetreDuPlanning(contexte);
  if (perimetre.acces === "complet") {
    // Le planning d'une agence a son écran — en rendre une seconde version
    // ici serait deux écrans pour une même question. AVANT QT-24
    // (9DU-TP-NAV3-RECHERCHE-RAIL), ce renvoi était SILENCIEUX
    // (`redirect("/planning")`) : un rôle de bureau qui ouvrait `/terrain`
    // par curiosité ou par un favori atterrissait ailleurs sans qu'aucun
    // message ne le lui dise. Un refus nommé plutôt qu'un renvoi muet.
    return <ReserveAuxTechniciens />;
  }
  if (perimetre.acces === "aucun") {
    redirect("/arrivee");
  }

  // Le fuseau vient de `lib/calendar`, comme tout ce qui lit une heure : la
  // route du compteur en a besoin du même, et deux écritures d'un même critère
  // divergent en silence (§9, 01/09).
  const fuseau = await avecContexteApplicatif(contexte, (tx) =>
    fuseauDuTechnicien(tx, {
      societeId: contexte.societeId,
      utilisateurId: contexte.utilisateurId,
    }),
  );
  const aujourdHui = jourDe(maintenant(fuseau).local);
  // LA FENÊTRE S'ÉTEND D'AUJOURD'HUI À J+7 INCLUS (9F2-TERRAIN-JOURS-
  // MAQUETTE, D210) — la borne haute passée à `listerPlanning` reste
  // EXCLUSIVE (12/09/2026), donc J+8. Les lignes SANS DATE arrivent dans la
  // même lecture, quelle que soit la fenêtre (`listerPlanning` les inclut
  // toujours).
  const lignes = await listerPlanning(
    contexte,
    instantDuJour(aujourdHui),
    instantDuJour(jourSuivant(aujourdHui, 8)),
    undefined,
    // LE TERRAIN NE VOIT QUE LE TRANSMIS (D141 14C) — une PLANIFIEE est
    // encore préparée par le bureau, invisible du terrain tant qu'elle n'a
    // pas été transmise (« Transmettre au technicien », D141). Une ANNULEE
    // n'a plus rien à faire sur une journée (TR-20, audit du 28/09/2026,
    // constat C3) — même règle déjà posée pour /planning par PG-A8, qui
    // manquait sur cet appelant précis.
    { inclurePlanifiees: false, inclureAnnulees: false },
  );

  // « EN RETARD » SE LIT À PART (PG-C1a) — une ligne en retard a une date
  // PASSÉE, hors de la fenêtre `[aujourd'hui, J+7]` lue ci-dessus.
  // `interventionsEnRetard` accepte aussi `planifiee` (le registre du bureau
  // en a besoin) ; le terrain ne montre jamais de PLANIFIEE (D141 14C), d'où
  // le filtre sur `affectee` seul.
  const retard = (
    await interventionsEnRetard(contexte, instantDuJour(aujourdHui))
  ).filter((l) => l.statut === "affectee");

  const journee = repartirJourneeTechnicien(lignes, retard, aujourdHui);

  // LES MACHINES DES LIGNES AFFICHÉES, UNE SEULE LECTURE (9DI-TP-TER1-
  // JOURNEE-FICHE) — même composition que la fiche du bureau
  // (`donneesMaterielDesMachines` + `libelleMaterielComplet`), jamais une
  // seconde forme du même libellé (§9, 01/09). « Les jours suivants » n'a
  // besoin d'aucune machine : c'est un résumé, pas des cartes.
  const lignesAffichees = [
    ...journee.enRetard,
    ...journee.aujourdHui,
    ...journee.demain,
    ...journee.sansDate,
  ];
  const donneesMateriel = await donneesMaterielDesMachines(
    contexte,
    lignesAffichees.flatMap((l) => l.machines.map((m) => m.machine_id)),
  );
  const libellesMachines = new Map(
    [...donneesMateriel].map(([machineId, donnees]) => [
      machineId,
      libelleMaterielComplet(donnees),
    ]),
  );

  // LE BANDEAU « COMPTEUR EN COURS » (QE-11, D210) — seulement s'il tourne
  // sur une ligne d'EN RETARD, d'AUJOURD'HUI ou SANS DATE : `compteurEnCours`
  // ne connaît aucune borne de temps, et une intervention de demain ou d'un
  // jour suivant n'a pas sa place sur ce bandeau.
  const enCours = await compteurEnCours(contexte);
  const enCoursIci =
    enCours !== null &&
    lignesAffichees.some((l) => l.id === enCours.interventionId)
      ? enCours
      : null;

  return (
    <main className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-24 font-extrabold tracking-tight">
          {t("terrain.titre")}
        </h1>
        <p className="text-app-encre-faible text-16 font-bold">
          {libelleDuJour(aujourdHui)}
        </p>
      </header>

      {enCoursIci === null ? null : (
        <BandeauCompteurEnCours
          interventionId={enCoursIci.interventionId}
          client={enCoursIci.client}
          depuis={enCoursIci.segment.debut}
          fuseau={fuseau}
        />
      )}

      {journee.enRetard.length === 0 ? null : (
        <Section
          titre={t("terrain.en_retard")}
          lignes={journee.enRetard}
          vide={t("terrain.rien_aujourdhui")}
          fuseau={fuseau}
          libellesMachines={libellesMachines}
          enRetard
        />
      )}

      <Section
        titre={t("terrain.aujourdhui")}
        lignes={journee.aujourdHui}
        vide={t("terrain.rien_aujourdhui")}
        fuseau={fuseau}
        libellesMachines={libellesMachines}
      />

      <Section
        titre={libelleTitreDemain(aujourdHui)}
        lignes={journee.demain}
        vide={t("terrain.demain.vide")}
        fuseau={fuseau}
        libellesMachines={libellesMachines}
      />

      <SectionJoursSuivants suite={journee.suite} aujourdHui={aujourdHui} />

      {journee.sansDate.length === 0 ? null : (
        <Section
          titre={t("terrain.sans_date")}
          lignes={journee.sansDate}
          vide={t("terrain.rien_aujourdhui")}
          fuseau={fuseau}
          libellesMachines={libellesMachines}
        />
      )}
    </main>
  );
}

function Section({
  titre,
  lignes,
  vide,
  fuseau,
  libellesMachines,
  enRetard = false,
}: {
  readonly titre: string;
  readonly lignes: readonly LignePlanning[];
  readonly vide: string;
  readonly fuseau: Fuseau;
  readonly libellesMachines: ReadonlyMap<string, string>;
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
  enRetard = false,
}: {
  readonly ligne: LignePlanning;
  readonly fuseau: Fuseau;
  readonly libellesMachines: ReadonlyMap<string, string>;
  readonly enRetard?: boolean;
}) {
  const cleStatut = `statut.${ligne.statut}`;
  const panne = premiereLignePanne(ligne.description);
  return (
    <li>
      <Link
        href={`/terrain/${ligne.id}`}
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

/**
 * LE REFUS NOMMÉ D'UN RÔLE DE BUREAU (QT-24) — voir le commentaire posé sur
 * son seul appelant, ci-dessus. Même forme que `components/ui/refus-acces.tsx`
 * (un bloc, un message, un lien de retour), jamais ce composant lui-même : il
 * ramène vers `/terrain`, destination que ce rôle n'est précisément PAS censé
 * utiliser — le motif et la destination du lien diffèrent des deux côtés.
 */
function ReserveAuxTechniciens() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div
        role="status"
        className="border-app-bord bg-app-surface flex max-w-sm flex-col gap-2 rounded-lg border px-4 py-6 text-center"
      >
        <h1 className="text-16 font-bold">{t("terrain.reserve.titre")}</h1>
        <p className="text-app-encre-faible text-16 font-bold">
          {t("terrain.reserve.description")}
        </p>
        <Link href="/planning" className="text-app-marque mt-2 underline">
          {t("terrain.reserve.retour")}
        </Link>
      </div>
    </div>
  );
}

/** `Mardi 15/09/2026` — composé hors du JSX, où aucun littéral n'est admis. */
function libelleDuJour(jour: JourLocal): string {
  return `${String(jour.jour).padStart(2, "0")}/${String(jour.mois).padStart(2, "0")}/${jour.annee}`;
}
