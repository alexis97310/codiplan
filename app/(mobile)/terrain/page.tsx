import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

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
import { listerPlanning, type LignePlanning } from "@/lib/interventions/depot";
import { perimetreDuPlanning } from "@/lib/interventions/perimetre-technicien";
import { CLASSES_LIEN } from "@/lib/theme/apparence";
import { CLASSES_STATUT, type StatutAffiche } from "@/lib/theme/statuts";

/**
 * LA JOURNÉE DU TECHNICIEN — le premier écran de l'application de terrain
 * (R5-01, première moitié de L3-08).
 *
 * ## CE QU'IL MONTRE, ET RIEN D'AUTRE
 *
 * Ses interventions, à lui, aujourd'hui. Pas de montant — la matrice du §5.2
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
    // Le planning d'une agence a son écran. En rendre une seconde version ici
    // serait deux écrans pour une même question.
    redirect("/planning");
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
  const lignes = await listerPlanning(
    contexte,
    instantDuJour(aujourdHui),
    instantDuJour(jourSuivant(aujourdHui)),
  );

  const duJour = lignes.filter((l) => l.date_planifiee !== null);
  const sansDate = lignes.filter((l) => l.date_planifiee === null);

  return (
    <main className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-[22px] font-extrabold tracking-tight">
          {t("terrain.titre")}
        </h1>
        <p className="text-app-encre-faible text-[13px]">
          {libelleDuJour(aujourdHui)}
        </p>
      </header>

      <Section
        titre={t("terrain.aujourdhui")}
        lignes={duJour}
        vide={t("terrain.rien_aujourdhui")}
        fuseau={fuseau}
      />

      {sansDate.length === 0 ? null : (
        <Section
          titre={t("terrain.sans_date")}
          lignes={sansDate}
          vide={t("terrain.rien_aujourdhui")}
          fuseau={fuseau}
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
}: {
  readonly titre: string;
  readonly lignes: readonly LignePlanning[];
  readonly vide: string;
  readonly fuseau: Fuseau;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-app-encre-faible text-[12px] font-bold tracking-[0.6px] uppercase">
        {titre}
      </h2>
      {lignes.length === 0 ? (
        <p className="bg-app-surface border-app-bord text-app-encre-faible rounded-[10px] border px-4 py-6 text-center text-[13px]">
          {vide}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {lignes.map((ligne) => (
            <Carte key={ligne.id} ligne={ligne} fuseau={fuseau} />
          ))}
        </ul>
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
}: {
  readonly ligne: LignePlanning;
  readonly fuseau: Fuseau;
}) {
  const cleStatut = `statut.${ligne.statut}`;
  return (
    <li>
      <Link
        href={`/terrain/${ligne.id}`}
        className={`bg-app-surface border-app-bord flex flex-col gap-1.5 rounded-[10px] border px-4 py-3 ${CLASSES_LIEN}`}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-[15px] font-bold tabular-nums">
            {heureOuTiret(ligne.creneau_debut, ligne.creneau_fin, fuseau)}
          </span>
          <span
            className={`${CLASSES_STATUT[ligne.statut as StatutAffiche]} rounded-full px-2 py-0.5 text-[11px] font-semibold`}
          >
            {estCleTraduction(cleStatut) ? t(cleStatut) : ligne.statut}
          </span>
        </div>
        <p className="text-[14px] font-semibold">
          {ligne.client.raison_sociale}
        </p>
        <p className="text-app-encre-faible text-[12.5px]">
          {lieuDit(ligne.site.libelle)}
        </p>
        {/* LE TYPE, parce qu'une carte qui dit OÙ sans dire QUOI envoie
          quelqu'un en déplacement sans lui dire ce qu'il va faire. Le libellé
          vient du dictionnaire, jamais de l'énumération : `curatif` est un nom
          de statut, et un nom de statut ne se lit pas à l'écran (L0-11). */}
        <p className="text-app-encre-faible text-[12.5px]">
          {typeLu(ligne.type)}
        </p>
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

/** `Mardi 15/09/2026` — composé hors du JSX, où aucun littéral n'est admis. */
function libelleDuJour(jour: JourLocal): string {
  return `${String(jour.jour).padStart(2, "0")}/${String(jour.mois).padStart(2, "0")}/${jour.annee}`;
}
