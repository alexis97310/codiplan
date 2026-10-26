import type { Metadata } from "next";

import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { BandeauCompteurEnCours } from "@/components/terrain/bandeau-compteur";
import { BandeauReseau } from "@/components/terrain/bandeau-reseau";
import { BoutonEnvoyer } from "@/components/terrain/bouton-envoyer";
import { ListeJournee } from "@/components/terrain/liste-journee";
import { libelleJourLongEnTeteDePhrase } from "@/components/terrain/presentation";
import { RafraichissementAutomatique } from "@/components/terrain/rafraichissement-auto";
import { obtenirSession } from "@/lib/auth/session";
import { avecContexteApplicatif } from "@/lib/db/client";
import { fuseauDuTechnicien } from "@/lib/calendar/technicien";
import {
  instantDuJour,
  jourDe,
  jourSuivant,
  maintenant,
} from "@/lib/calendar/fuseau";
import { t } from "@/lib/i18n/fr";
import {
  interventionsEnRetard,
  listerPlanning,
} from "@/lib/interventions/depot";
import {
  compteurEnCours,
  mesureDeLIntervention,
} from "@/lib/interventions/depot-compteur";
import { repartirJourneeTechnicien } from "@/lib/interventions/journee-technicien";
import { perimetreDuPlanning } from "@/lib/interventions/perimetre-technicien";
import { donneesMaterielDesMachines } from "@/lib/machines/depot";
import { libelleMaterielComplet } from "@/lib/machines/presentation";
import { projeterLigneJournee } from "@/lib/terrain/projection-journee";

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
  const instant = maintenant(fuseau);
  const aujourdHui = jourDe(instant.local);
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

  // LA PROJECTION VERS LE CLIENT (9F4H5B-JOURNEE-SANS-MONTANT, point 1) —
  // après la répartition par jour, jamais avant : `repartirJourneeTechnicien`
  // range sur `date_planifiee`, un champ que la projection n'emporte pas (la
  // carte ne montre qu'un libellé déjà composé, `enRetardPrevueLibelle`).
  const journeeAffichee = {
    enRetard: journee.enRetard.map((l) =>
      projeterLigneJournee(l, libellesMachines),
    ),
    aujourdHui: journee.aujourdHui.map((l) =>
      projeterLigneJournee(l, libellesMachines),
    ),
    demain: journee.demain.map((l) =>
      projeterLigneJournee(l, libellesMachines),
    ),
    suite: journee.suite,
    sansDate: journee.sansDate.map((l) =>
      projeterLigneJournee(l, libellesMachines),
    ),
  };

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
  // LA MÊME DURÉE QUE LA FICHE OÙ IL TOURNE (point 7, 9G5-TERRAIN-ERGONOMIE)
  // — sans ces minutes déjà fermées, ce bandeau ne comptait que le segment
  // ouvert depuis `enCoursIci.segment.debut`, une durée plus courte que
  // celle que la fiche de CETTE MÊME intervention affiche elle-même.
  const mesureEnCoursIci =
    enCoursIci === null
      ? null
      : await mesureDeLIntervention(contexte, enCoursIci.interventionId);

  return (
    <main className="flex flex-col gap-4">
      <header className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-24 font-extrabold tracking-tight">
            {t("terrain.titre")}
          </h1>
          <p className="text-app-encre-faible text-16 font-bold">
            {libelleJourLongEnTeteDePhrase(aujourdHui)}
          </p>
        </div>
        <Link
          href="/scanner"
          className="border-app-bord bg-app-surface inline-flex min-h-11 items-center justify-center rounded-md border px-3 py-2 text-16 font-bold"
        >
          {t("terrain.action.scanner")}
        </Link>
      </header>

      <BandeauReseau genereLe={instant.instant.toISOString()} fuseau={fuseau} />
      <RafraichissementAutomatique />
      <BoutonEnvoyer
        utilisateurId={contexte.utilisateurId}
        societeId={contexte.societeId}
      />

      {enCoursIci === null ? null : (
        <BandeauCompteurEnCours
          interventionId={enCoursIci.interventionId}
          client={enCoursIci.client}
          depuis={enCoursIci.segment.debut}
          fuseau={fuseau}
          minutesFermees={mesureEnCoursIci?.minutes ?? 0}
          instantServeur={instant.instant}
        />
      )}

      <ListeJournee
        journee={journeeAffichee}
        jourActuel={aujourdHui}
        fuseau={fuseau}
      />
    </main>
  );
}

/**
 * LE REFUS NOMMÉ D'UN RÔLE DE BUREAU (QT-24) — voir le commentaire posé sur
 * son seul appelant, ci-dessus. Même forme que `components/ui/refus-acces.tsx`
 * (un bloc, un message, un lien de retour), jamais ce composant lui-même : il
 * ramène vers `/terrain`, destination que ce rôle n'est précisément PAS censé
 * utiliser — le motif et la destination du lien diffèrent des deux côtés.
 */
function ReserveAuxTechniciens() {
  // PAS `min-h-dvh` (audit du 21/10/2026, 9G9B) — cette carte se rend DANS
  // la coque du terrain, déjà rognée par son bandeau collant et sa barre
  // basse fixe (`app/(mobile)/layout.tsx`) ; viser la hauteur PLEINE de la
  // fenêtre par-dessus cette coque la faisait déborder sous la barre basse.
  return (
    <div className="flex items-center justify-center py-20">
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
