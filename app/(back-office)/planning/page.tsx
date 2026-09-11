import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { nomsDesPersonnes } from "@/lib/auth/annuaire";
import { obtenirSession } from "@/lib/auth/session";
import {
  cleJour,
  maintenant,
  minutesDepuisMinuit,
  versLocal,
  type JourLocal,
} from "@/lib/calendar/fuseau";
import {
  enHeure,
  joursTravailles,
  lireParametrage,
} from "@/lib/calendar/parametrage";
import {
  joursDeLaSemaine,
  jourSemaineIso,
  lundiDeLaSemaine,
  semaineIso,
} from "@/lib/calendar/semaine";
import { avecContexteApplicatif } from "@/lib/db/client";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";
import { listerPlanning } from "@/lib/interventions/depot";
import {
  construireGrille,
  type AgenceDeGrille,
} from "@/lib/interventions/grille";
import {
  construireJournee,
  type AgenceDeJournee,
} from "@/lib/interventions/journee";
import { occupationsDuPlanning } from "@/lib/interventions/occupation";
import {
  CLASSES_BLOC,
  CLASSES_STATUT,
  LEGENDE_PLANNING,
} from "@/lib/theme/statuts";

import { BlocPosable, CasePosable, Posable } from "@/components/planning/pose";

import { referenceAffichee } from "./presentation";
import { Statistiques } from "./statistiques";

/**
 * LE PLANNING — deux vues sur la même donnée (lot 2, D84 ; D95 ; 11/09/2026).
 *
 * ## La vue SEMAINE : une ligne par PERSONNE
 *
 * *Elle avait une ligne par couple (technicien, agence), et une personne qui
 * sert Ducos et Koné en occupait deux.* La maille est désormais la personne ;
 * la règle d'ouverture et la raison pour laquelle elle ne contredit pas I7 sont
 * écrites dans `lib/interventions/grille.ts`. Chaque bloc NOMME son agence,
 * parce que c'est elle qui décide, et que la ligne ne le dit plus.
 *
 * ## La vue JOUR : les heures en lignes, les personnes en colonnes
 *
 * **Son objet est de montrer les TROUS**, et c'est le seul critère qui la juge.
 * L'axe porte l'union des heures des agences présentes, au pas le plus fin
 * qu'elles règlent — jamais un pas écrit ici (I7) —, et chaque colonne grise
 * les heures hors du calendrier de sa propre agence. Le compte des créneaux
 * libres est affiché : *« on voit bien les trous » est une impression, pas une
 * observation.*
 *
 * ## Ce qui est commun aux deux
 *
 * **Une seule lecture cloisonnée**, et les deux vues s'en servent. Les noms des
 * personnes viennent de `nomsDesPersonnes`, qui n'élargit rien : la politique
 * `utilisateur_lecture` porte cette branche depuis L1-02c — mesuré le
 * 11/09/2026, 4 identités pour un interne, 0 pour un compte portail.
 *
 * **Ce n'est toujours pas un calendrier agissant** : Schedule-X et le
 * glisser-déposer viennent au lot 3.
 */
export default async function PagePlanning({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await obtenirSession(await headers());
  if (session === null) {
    redirect("/connexion");
  }
  if (session.contexte.societeId === null) {
    redirect("/arrivee");
  }
  const contexte = session.contexte;
  const parametres = await searchParams;
  const vue = parametres.vue === "jour" ? "jour" : "semaine";

  const cadre = await avecContexteApplicatif(contexte, async (tx) => {
    const societe = await tx.societe.findFirst({
      where: { id: contexte.societeId as string },
      select: { fuseau_horaire: true },
    });
    const agences = await tx.agence.findMany({
      select: { id: true, libelle: true, calendrier_id: true },
      orderBy: { libelle: "asc" },
    });
    const detaillees = await Promise.all(
      agences.map(async (agence) => {
        const parametrage =
          agence.calendrier_id === null
            ? null
            : await lireParametrage(tx, agence.calendrier_id);
        return { agence, parametrage };
      }),
    );
    return { fuseau: societe?.fuseau_horaire ?? "UTC", detaillees };
  });

  const pourGrille: AgenceDeGrille[] = cadre.detaillees.map(
    ({ agence, parametrage }) => ({
      id: agence.id,
      libelle: agence.libelle,
      joursOuverts: parametrage === null ? [] : joursTravailles(parametrage),
      calendrierConnu: parametrage !== null,
    }),
  );
  const pourJournee: AgenceDeJournee[] = cadre.detaillees.map(
    ({ agence, parametrage }) => ({
      id: agence.id,
      libelle: agence.libelle,
      plages: parametrage?.plages ?? [],
      pasCreneauMinutes: parametrage?.pasCreneauMinutes ?? 0,
      calendrierConnu: parametrage !== null,
    }),
  );

  const jours = joursDeLaSemaine(
    jourDemande(parametres.semaine, cadre.fuseau, true),
  ).slice(0, 6);
  const jourAffiche = jourDemande(parametres.jour, cadre.fuseau, false);
  const fenetre =
    vue === "jour"
      ? { du: instantDuJour(jourAffiche), au: instantDuJour(jourAffiche, 1) }
      : {
          du: instantDuJour(jours[0]),
          au: instantDuJour(jours[jours.length - 1], 1),
        };

  const lignes = await listerPlanning(contexte, fenetre.du, fenetre.au);
  const noms = await avecContexteApplicatif(contexte, (tx) =>
    nomsDesPersonnes(
      tx,
      lignes
        .map((l) => l.technicien_id)
        .filter((id): id is string => id !== null),
    ),
  );
  const nomDe = (id: string) => noms.get(id) ?? null;

  const attente = lignes.filter((l) => l.date_planifiee === null);
  const charges = await occupationsDuPlanning(
    contexte,
    lignes,
    fenetre.du,
    fenetre.au,
  );

  const minutesDe = (instant: Date) =>
    minutesDepuisMinuit(versLocal(instant, cadre.fuseau));

  return (
    <main className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight">
            {t("planning.titre")}
          </h1>
          <p className="text-app-encre-faible text-[13px]">
            {vue === "jour" ? libelleJour(jourAffiche) : libelleSemaine(jours)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Onglets vue={vue} jour={jourAffiche} semaine={jours[0]} />
          <Deplacement vue={vue} jour={jourAffiche} semaine={jours[0]} />
          <Link
            href="/planning/nouvelle"
            className="bg-app-accent text-app-accent-encre rounded-md px-4 py-2 text-[13px] font-bold"
          >
            {t("planning.creer")}
          </Link>
        </div>
      </header>

      <Posable>
        <div className="grid items-start gap-4 lg:grid-cols-[1fr_290px]">
          {vue === "jour" ? (
            <VueJour
              journee={construireJournee(
                lignes.filter(
                  (l) =>
                    l.date_planifiee !== null &&
                    cleJour(jourDeLaDate(l.date_planifiee)) ===
                      cleJour(jourAffiche),
                ),
                jourAffiche,
                pourJournee,
                minutesDe,
              )}
              nomDe={nomDe}
              jourAffiche={jourAffiche}
            />
          ) : (
            <VueSemaine
              jours={jours}
              grille={construireGrille(lignes, jours, pourGrille, nomDe)}
              nomDe={nomDe}
            />
          )}

          <aside className="flex flex-col gap-4">
            <section className="bg-app-surface border-app-bord rounded-[10px] border">
              <h2 className="border-app-bord flex items-center justify-between border-b px-4 py-3.5 text-[14px] font-bold">
                {t("planning.file_attente")}
                <span className="text-app-marque text-[11px] font-semibold">
                  {attente.length}
                </span>
              </h2>
              <div className="flex flex-col gap-2 p-4">
                {attente.length === 0 ? (
                  <p className="text-app-encre-faible text-[12px]">
                    {t("planning.file_vide")}
                  </p>
                ) : null}
                {attente.map((ligne) => (
                  // GLISSER DEPUIS LA FILE VAUT AFFECTATION — c'est l'usage
                  // principal : le dépôt donne à la fois un jour et une personne.
                  <BlocPosable
                    key={ligne.id}
                    interventionId={ligne.id}
                    dureeMin={dureeDe(ligne)}
                  >
                    <Link
                      href={`/planning/${ligne.id}`}
                      className="border-app-bord block rounded-lg border px-3 py-2.5"
                    >
                      <span className="flex items-center justify-between gap-2 text-[12.5px] font-bold">
                        {referenceAffichee(ligne)}
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${CLASSES_STATUT[ligne.statut]}`}
                        >
                          {t(`priorite.${ligne.priorite}`)}
                        </span>
                      </span>
                      <span className="text-app-encre-faible block text-[12px]">
                        {lieuDeLaLigne(ligne)}
                      </span>
                    </Link>
                  </BlocPosable>
                ))}
              </div>
            </section>

            <Statistiques lignes={charges} nomDe={nomDe} />
          </aside>
        </div>
      </Posable>
    </main>
  );
}

type Ligne = Awaited<ReturnType<typeof listerPlanning>>[number];

/* ───────────────────────────── LA VUE SEMAINE ──────────────────────────── */

function VueSemaine({
  jours,
  grille,
  nomDe,
}: {
  readonly jours: readonly JourLocal[];
  readonly grille: ReturnType<typeof construireGrille<Ligne>>;
  readonly nomDe: (id: string) => string | null;
}) {
  return (
    <section className="bg-app-surface border-app-bord overflow-hidden rounded-[10px] border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] table-fixed border-separate border-spacing-0 text-[13px]">
          <colgroup>
            <col style={{ width: "190px" }} />
            {jours.map((jour) => (
              <col key={cleJour(jour)} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="bg-app-surface-creuse border-app-bord text-app-encre-faible border-b px-3.5 py-2.5 text-left text-[10.5px] font-bold tracking-wider uppercase">
                {t("planning.colonne_technicien")}
              </th>
              {jours.map((jour) => (
                <th
                  key={cleJour(jour)}
                  className="bg-app-surface-creuse border-app-bord text-app-encre-faible border-b px-3.5 py-2.5 text-left text-[10.5px] font-bold tracking-wider uppercase"
                >
                  {enTeteDeJour(jour)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grille.length === 0 ? (
              <tr>
                <td
                  colSpan={jours.length + 1}
                  className="text-app-encre-faible px-3.5 py-6"
                >
                  {t("planning.semaine_vide")}
                </td>
              </tr>
            ) : null}
            {grille.map((ligne) => (
              <tr key={ligne.technicienId ?? "-"}>
                <td className="bg-app-surface-creuse border-app-bord border-r border-b px-3.5 py-2.5 align-top text-[12.5px] font-bold">
                  {quiTravaille(ligne.technicienId, nomDe)}
                  <span className="text-app-encre-faible block text-[10.5px] font-normal">
                    {ouTravaille(ligne.agences.map((a) => a.libelle))}
                  </span>
                </td>
                {ligne.cases.map((cellule) => (
                  <CasePosable
                    key={cleJour(cellule.jour)}
                    cible={{
                      jour: cleJour(cellule.jour),
                      technicienId: ligne.technicienId,
                      minutes: null,
                    }}
                    className={`border-app-bord border-r border-b p-1.5 align-top ${
                      cellule.ouverte === false ? "trame-fermee" : ""
                    }`}
                    style={{ height: "78px" }}
                  >
                    {cellule.lignes.map((intervention) => (
                      <BlocPosable
                        key={intervention.id}
                        interventionId={intervention.id}
                        dureeMin={dureeDe(intervention)}
                      >
                        <Link
                          href={`/planning/${intervention.id}`}
                          className={`mb-1 block rounded-[5px] border-l-[3px] px-1.5 py-1 text-[11px] leading-snug ${CLASSES_BLOC[intervention.statut]}`}
                        >
                          <span className="block font-bold">
                            {referenceAffichee(intervention)}
                          </span>
                          {lieuDeLaLigne(intervention)}
                        </Link>
                      </BlocPosable>
                    ))}
                  </CasePosable>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Legende />
    </section>
  );
}

/* ────────────────────────────── LA VUE JOUR ────────────────────────────── */

function VueJour({
  journee,
  nomDe,
  jourAffiche,
}: {
  readonly journee: ReturnType<typeof construireJournee<Ligne>>;
  readonly nomDe: (id: string) => string | null;
  readonly jourAffiche: JourLocal;
}) {
  if (journee.axe.length === 0 || journee.colonnes.length === 0) {
    return (
      <section className="bg-app-surface border-app-bord text-app-encre-faible rounded-[10px] border px-4 py-6 text-[13px]">
        {t("planning.jour_vide")}
      </section>
    );
  }
  return (
    <section className="bg-app-surface border-app-bord overflow-hidden rounded-[10px] border">
      <p className="border-app-bord text-app-encre-faible border-b px-4 py-3 text-[12.5px]">
        {resumeDesTrous(journee.creneauxLibres, journee.pasMinutes)}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-separate border-spacing-0 text-[12px]">
          <colgroup>
            <col style={{ width: "78px" }} />
            {journee.colonnes.map((colonne) => (
              <col key={colonne.technicienId ?? "-"} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="bg-app-surface-creuse border-app-bord text-app-encre-faible border-b px-2 py-2.5 text-left text-[10.5px] font-bold tracking-wider uppercase">
                {t("planning.colonne_heure")}
              </th>
              {journee.colonnes.map((colonne) => (
                <th
                  key={colonne.technicienId ?? "-"}
                  className="bg-app-surface-creuse border-app-bord border-b px-2.5 py-2.5 text-left text-[12px] font-bold"
                >
                  {quiTravaille(colonne.technicienId, nomDe)}
                  <span className="text-app-encre-faible block text-[10.5px] font-normal">
                    {ouTravaille(colonne.agences.map((a) => a.libelle))}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {journee.axe.map((debut, rang) => (
              <tr key={debut}>
                <th className="bg-app-surface-creuse border-app-bord text-app-encre-faible border-r border-b px-2 py-1 text-left align-top text-[11px] font-semibold">
                  {enHeure(debut)}
                </th>
                {journee.colonnes.map((colonne) => {
                  const cellule = colonne.cellules[rang];
                  const occupation = cellule.occupation;
                  const lien = (
                    <Link
                      href={`/planning/${occupation?.id ?? ""}`}
                      className={`block h-full border-l-[3px] px-1.5 py-0.5 text-[11px] leading-tight ${occupation === null ? "" : CLASSES_BLOC[occupation.statut]}`}
                    >
                      {cellule.debutDeBloc && occupation !== null ? (
                        <>
                          <span className="block font-bold">
                            {referenceAffichee(occupation)}
                          </span>
                          {occupation.client.raison_sociale}
                        </>
                      ) : null}
                    </Link>
                  );
                  return (
                    <CasePosable
                      key={colonne.technicienId ?? "-"}
                      cible={{
                        jour: cleJour(jourAffiche),
                        technicienId: colonne.technicienId,
                        minutes: debut,
                      }}
                      className={`border-app-bord border-r border-b p-0 align-top ${classeDeCellule(cellule.etat)}`}
                      style={{ height: "26px" }}
                    >
                      {occupation === null ? null : cellule.debutDeBloc ? (
                        <BlocPosable
                          interventionId={occupation.id}
                          dureeMin={dureeDe(occupation)}
                          className="h-full"
                        >
                          {lien}
                        </BlocPosable>
                      ) : (
                        // La SUITE d'un bloc n'est pas prenable : prendre une
                        // intervention par son milieu déplacerait son début
                        // sans que rien ne le dise.
                        lien
                      )}
                    </CasePosable>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="text-app-encre-faible flex flex-wrap items-center gap-4 px-4 py-3 text-[11.5px]">
        <li className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="bg-app-bleu-fond border-app-bleu-bord inline-block h-3 w-3 rounded-[3px] border"
          />
          {t("planning.jour_occupe")}
        </li>
        <li className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="bg-app-surface border-app-bord inline-block h-3 w-3 rounded-[3px] border"
          />
          {t("planning.jour_libre")}
        </li>
        <li className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="bg-app-gris-fond border-app-bord inline-block h-3 w-3 rounded-[3px] border"
          />
          {t("planning.jour_hors_ouverture")}
        </li>
      </ul>
    </section>
  );
}

/**
 * L'aplat d'une cellule. **Le créneau LIBRE est la surface la plus claire** —
 * c'est lui qu'on cherche, et un trou doit sauter aux yeux sans qu'on le
 * cherche. « Hors ouverture » est creux mais uni : *une trame veut dire une
 * seule chose*, et la hachure appartient au jour non ouvert de la vue semaine.
 *
 * **La cellule OCCUPÉE ne porte pas d'aplat ici**, et ce n'est pas un oubli :
 * elle est entièrement recouverte par le bloc, qui porte la couleur du STATUT.
 * *Mesuré à la première capture : seule la première ligne d'une intervention
 * était peinte, et les suivantes — blanches — se lisaient comme des créneaux
 * libres. Une intervention de deux heures paraissait en durer trente minutes,
 * sur l'écran même dont l'objet est de montrer ce qui est pris.*
 */
function classeDeCellule(etat: "occupe" | "libre" | "hors_ouverture"): string {
  if (etat === "hors_ouverture") return "bg-app-gris-fond";
  return "bg-app-surface";
}

function Legende() {
  return (
    <ul className="text-app-encre-faible flex flex-wrap items-center gap-4 px-4 py-3 text-[11.5px]">
      {LEGENDE_PLANNING.map((entree) => (
        <li key={entree.cle} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className={`inline-block h-3 w-3 rounded-[3px] border ${entree.classes}`}
          />
          {estCleTraduction(entree.cle) ? t(entree.cle) : entree.cle}
        </li>
      ))}
    </ul>
  );
}

/* ─────────────────────────────── LA BASCULE ────────────────────────────── */

function Onglets({
  vue,
  jour,
  semaine,
}: {
  readonly vue: "semaine" | "jour";
  readonly jour: JourLocal;
  readonly semaine: JourLocal;
}) {
  const classes = "rounded-md px-3 py-2 text-[12.5px] font-bold";
  return (
    <div className="border-app-bord flex gap-0.5 rounded-md border p-0.5">
      <Link
        href={`/planning?vue=semaine&semaine=${cleJour(semaine)}`}
        aria-current={vue === "semaine" ? "page" : undefined}
        className={
          vue === "semaine"
            ? `${classes} bg-app-marque text-app-marque-encre`
            : `${classes} text-app-encre-faible`
        }
      >
        {t("planning.vue_semaine")}
      </Link>
      <Link
        href={`/planning?vue=jour&jour=${cleJour(jour)}`}
        aria-current={vue === "jour" ? "page" : undefined}
        className={
          vue === "jour"
            ? `${classes} bg-app-marque text-app-marque-encre`
            : `${classes} text-app-encre-faible`
        }
      >
        {t("planning.vue_jour")}
      </Link>
    </div>
  );
}

function Deplacement({
  vue,
  jour,
  semaine,
}: {
  readonly vue: "semaine" | "jour";
  readonly jour: JourLocal;
  readonly semaine: JourLocal;
}) {
  const pas = vue === "jour" ? 1 : 7;
  const depart = vue === "jour" ? jour : semaine;
  const lien = (decalage: number) => {
    const cible = decale(depart, decalage);
    return vue === "jour"
      ? `/planning?vue=jour&jour=${cleJour(cible)}`
      : `/planning?vue=semaine&semaine=${cleJour(cible)}`;
  };
  const classes =
    "border-app-bord text-app-encre-faible rounded-md border px-2.5 py-2 text-[12.5px] font-semibold";
  return (
    <div className="flex items-center gap-2">
      <Link href={lien(-pas)} className={classes}>
        {t(vue === "jour" ? "planning.jour_avant" : "planning.semaine_avant")}
      </Link>
      <Link href={lien(pas)} className={classes}>
        {t(vue === "jour" ? "planning.jour_apres" : "planning.semaine_apres")}
      </Link>
    </div>
  );
}

/* ──────────────────────────── LES COMPOSITIONS ─────────────────────────── */

/**
 * Le jour demandé, ou celui d'aujourd'hui.
 *
 * Une valeur illisible ne fait pas échouer l'écran — elle retombe sur le jour
 * courant. *Un paramètre d'URL vient de l'extérieur* (L1-02f) : le traiter
 * comme une erreur donnerait à n'importe qui le moyen de casser la page en
 * forgeant un lien.
 */
function jourDemande(
  demande: string | string[] | undefined,
  fuseau: string,
  versLundi: boolean,
): JourLocal {
  const defaut = maintenant(fuseau).local;
  const lu =
    typeof demande === "string"
      ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(demande)
      : null;
  const jour =
    lu === null
      ? defaut
      : {
          annee: Number(lu[1]),
          mois: Number(lu[2]),
          jour: Number(lu[3]),
        };
  const valide =
    jour.mois >= 1 && jour.mois <= 12 && jour.jour >= 1 && jour.jour <= 31
      ? jour
      : defaut;
  return versLundi ? lundiDeLaSemaine(valide) : valide;
}

function decale(jour: JourLocal, jours: number): JourLocal {
  const date = new Date(0);
  date.setUTCFullYear(jour.annee, jour.mois - 1, jour.jour + jours);
  return {
    annee: date.getUTCFullYear(),
    mois: date.getUTCMonth() + 1,
    jour: date.getUTCDate(),
  };
}

/**
 * L'instant UTC d'un jour local, à minuit.
 *
 * `date_planifiee` est une DATE, portée en `@db.Date` : la comparer à un
 * instant calculé dans un fuseau la décalerait d'un cran sous UTC+11.
 */
function instantDuJour(jour: JourLocal, decalageJours = 0): Date {
  return new Date(
    Date.UTC(jour.annee, jour.mois - 1, jour.jour + decalageJours),
  );
}

function jourDeLaDate(date: Date): JourLocal {
  return {
    annee: date.getUTCFullYear(),
    mois: date.getUTCMonth() + 1,
    jour: date.getUTCDate(),
  };
}

/**
 * Les compositions sortent du JSX : un littéral n'y est pas admis (L0-11), et
 * ce qui se lit à l'écran vient du dictionnaire, jamais de la balise.
 */
function libelleSemaine(jours: readonly JourLocal[]): string {
  const { semaine } = semaineIso(jours[0]);
  const premier = jours[0];
  const dernier = jours[jours.length - 1];
  return `${t("planning.semaine")} ${semaine} — ${t("planning.du")} ${premier.jour} ${t("planning.au")} ${dernier.jour}/${String(dernier.mois).padStart(2, "0")}/${dernier.annee}`;
}

function libelleJour(jour: JourLocal): string {
  const cle = `jour.${jourSemaineIso(jour)}`;
  const nom = estCleTraduction(cle) ? t(cle) : "";
  return `${nom} ${jour.jour}/${String(jour.mois).padStart(2, "0")}/${jour.annee}`.trim();
}

/**
 * « Lun 17 » — l'en-tête d'une colonne.
 *
 * Le jour de la semaine vient de `jourSemaineIso`, qui passe par une date UTC
 * et jamais par `getDay()` : cet accesseur lirait le fuseau de l'appareil.
 */
function enTeteDeJour(jour: JourLocal): string {
  const cle = `jour.court.${jourSemaineIso(jour)}`;
  return `${estCleTraduction(cle) ? t(cle) : ""} ${jour.jour}`.trim();
}

/**
 * LE COMPTE DES TROUS, écrit à côté de la grille.
 *
 * *« Un créneau libre doit se distinguer au premier coup d'œil, sinon l'écran
 * ne sert à rien. »* Le chiffre est là pour que l'utilité de l'écran se mesure
 * au lieu de s'apprécier — et pour qu'une régression qui remplirait les trous
 * se voie tout de suite.
 */
function resumeDesTrous(libres: number, pasMinutes: number): string {
  return `${libres} ${t("planning.creneaux_libres")} · ${t("planning.pas")} ${pasMinutes} min`;
}

function lieuDeLaLigne(ligne: Ligne): string {
  return `${ligne.client.raison_sociale} · ${mot("site")} ${ligne.site.libelle}`;
}

/**
 * QUI TRAVAILLE — le nom, désormais, et non plus un identifiant abrégé.
 *
 * Il est lu sous le contexte cloisonné par `nomsDesPersonnes`, sans qu'aucune
 * politique ait été élargie : la branche « rattachement » de
 * `utilisateur_lecture` l'autorise depuis L1-02c. Une identité que la politique
 * refuse retombe sur son identifiant abrégé — *l'écran affiche alors ce qu'il
 * sait, jamais un nom qu'il n'a pas le droit de connaître.*
 */
function quiTravaille(
  technicienId: string | null,
  nomDe: (id: string) => string | null,
): string {
  if (technicienId === null) {
    return t("statistiques.non_affectees");
  }
  return (
    nomDe(technicienId) ??
    `${t("statistiques.technicien")} ${technicienId.slice(0, 8)}`
  );
}

/**
 * OÙ — et la ligne en porte désormais PLUSIEURS, puisque la maille est la
 * personne. Aucune n'est choisie : elles sont toutes nommées, séparées par une
 * virgule. *Choisir la principale ferait basculer le libellé d'une semaine à
 * l'autre, exactement ce que `occupation.ts` refuse pour le dénominateur.*
 */
function ouTravaille(libelles: readonly string[]): string {
  if (libelles.length === 0) return "";
  return `${mot("agence")} ${libelles.join(", ")}`;
}

/**
 * LA DURÉE D'UNE INTERVENTION, pour la conserver au déplacement.
 *
 * Le créneau posé d'abord — c'est la durée RÉELLEMENT réservée —, l'estimation
 * ensuite, et jamais un chiffre écrit ici : *une valeur par défaut qui répond à
 * une question qu'on n'a pas posée est une décision prise par personne* (§9,
 * 24/08). Une intervention sans l'un ni l'autre ne se déplace pas à l'heure :
 * elle se déplace au jour, et la vue semaine est faite pour cela.
 */
function dureeDe(ligne: Ligne): number {
  if (ligne.creneau_debut !== null && ligne.creneau_fin !== null) {
    return Math.round(
      (ligne.creneau_fin.getTime() - ligne.creneau_debut.getTime()) / 60_000,
    );
  }
  return ligne.duree_estimee_min ?? 0;
}
