import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { obtenirSession } from "@/lib/auth/session";
import { cleJour, maintenant, type JourLocal } from "@/lib/calendar/fuseau";
import { lireParametrage, joursTravailles } from "@/lib/calendar/parametrage";
import {
  joursDeLaSemaine,
  jourSemaineIso,
  lundiDeLaSemaine,
  semaineIso,
} from "@/lib/calendar/semaine";
import { avecContexteApplicatif } from "@/lib/db/client";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";
import {
  construireGrille,
  type AgenceDeGrille,
} from "@/lib/interventions/grille";
import { listerPlanning } from "@/lib/interventions/depot";
import { occupationsDuPlanning } from "@/lib/interventions/occupation";
import {
  CLASSES_BLOC,
  CLASSES_STATUT,
  LEGENDE_PLANNING,
} from "@/lib/theme/statuts";

import { referenceAffichee } from "./presentation";
import { Statistiques } from "./statistiques";

/**
 * LE PLANNING — techniciens en lignes, jours en colonnes (lot 2, D84 ; D95).
 *
 * ## Ce que D95 change, et pourquoi c'est cet écran qui sert de référence
 *
 * *Mesuré le 11/09/2026, avant : l'écran empilait trois blocs de charge, puis
 * deux listes verticales, sur une colonne de 1024 px centrée dans une fenêtre
 * de 1700. La maquette montre une GRILLE — techniciens en lignes, jours en
 * colonnes, interventions en blocs de couleur dans les cases, cases grisées
 * pour les jours où l'agence n'ouvre pas, légende à six entrées, colonne
 * latérale de 290 px.* La maquette fait foi sur la disposition (D95), et c'est
 * elle qui est rendue.
 *
 * **Ce n'est toujours pas un calendrier agissant** : Schedule-X et le
 * glisser-déposer viennent au lot 3. Ce que la grille apporte, c'est de VOIR —
 * qui travaille quand, quel jour est fermé, et ce qui attend d'être posé. Les
 * cinq actions de D84 restent atteignables par la fiche.
 *
 * ## La semaine affichée
 *
 * Une semaine, du lundi au samedi, comme la maquette. Le dimanche n'est pas
 * rendu : aucune agence n'y ouvre, et une colonne entièrement grisée coûterait
 * un septième de la largeur pour ne rien dire.
 *
 * **La semaine par défaut est celle d'aujourd'hui, lue dans le fuseau de la
 * société** (L0-08 — c'est le seul module qui lit l'heure, et il la lit avec un
 * fuseau). `?semaine=AAAA-MM-JJ` en désigne une autre ; deux liens suffisent à
 * circuler, et c'est délibérément tout : un sélecteur de date appartient au
 * calendrier du lot 3.
 *
 * ## La colonne latérale, et ce qui lui manque
 *
 * La maquette y met deux cartes : « À planifier » et « Contrôles à la pose ».
 * La première existe — c'est la file d'attente, les interventions sans date. La
 * seconde est **L3-02** : les contrôles à la pose ne sont pas écrits, et une
 * carte vide qui promet des avertissements serait pire qu'une carte absente.
 * Sa place est tenue par la charge par technicien, que l'exploitation a
 * demandée le 10/09 et qui ne se perd donc pas en chemin.
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
  const demandee = (await searchParams).semaine;

  // Le fuseau et les agences viennent de la MÊME lecture cloisonnée : ce sont
  // deux choses dont la grille a besoin ensemble, et les lire séparément
  // ouvrirait deux transactions pour un seul écran.
  const cadre = await avecContexteApplicatif(contexte, async (tx) => {
    const societe = await tx.societe.findFirst({
      where: { id: contexte.societeId as string },
      select: { fuseau_horaire: true },
    });
    const agences = await tx.agence.findMany({
      select: { id: true, libelle: true, calendrier_id: true },
      orderBy: { libelle: "asc" },
    });
    const avecCalendrier: AgenceDeGrille[] = await Promise.all(
      agences.map(async (agence) => {
        const parametrage =
          agence.calendrier_id === null
            ? null
            : await lireParametrage(tx, agence.calendrier_id);
        return {
          id: agence.id,
          libelle: agence.libelle,
          joursOuverts:
            parametrage === null ? [] : joursTravailles(parametrage),
          calendrierConnu: parametrage !== null,
        };
      }),
    );
    return {
      fuseau: societe?.fuseau_horaire ?? "UTC",
      agences: avecCalendrier,
    };
  });

  const jours = joursDeLaSemaine(semaineAffichee(demandee, cadre.fuseau)).slice(
    0,
    6,
  );
  const du = instantDuJour(jours[0]);
  const au = instantDuJour(jours[jours.length - 1], 1);
  const lignes = await listerPlanning(contexte, du, au);

  const grille = construireGrille(lignes, jours, cadre.agences);
  const attente = lignes.filter((l) => l.date_planifiee === null);
  const charges = await occupationsDuPlanning(contexte, lignes, du, au);

  return (
    <main className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight">
            {t("planning.titre")}
          </h1>
          <p className="text-app-encre-faible text-[13px]">
            {libelleSemaine(jours)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LienSemaine jour={jours[0]} pas={-7} cle="planning.semaine_avant" />
          <LienSemaine jour={jours[0]} pas={7} cle="planning.semaine_apres" />
          <Link
            href="/planning/nouvelle"
            className="bg-app-accent text-app-accent-encre rounded-md px-4 py-2 text-[13px] font-bold"
          >
            {t("planning.creer")}
          </Link>
        </div>
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_290px]">
        <section className="bg-app-surface border-app-bord overflow-hidden rounded-[10px] border">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] table-fixed border-separate border-spacing-0 text-[13px]">
              {/* LES COLONNES SONT DE LARGEUR ÉGALE, et c'est `table-fixed`
                  qui le tient. Sans lui, une colonne se dimensionne sur son
                  contenu : mesuré à la première capture, mardi et jeudi
                  prenaient les deux tiers de la grille parce qu'ils portaient
                  une intervention, et lundi se réduisait à son en-tête. Une
                  semaine dont les jours n'ont pas la même largeur ne se lit
                  pas comme une semaine. */}
              <colgroup>
                <col style={{ width: "190px" }} />
                {/* Les colonnes de jour ne portent AUCUNE largeur, et c'est
                    ce qui les rend égales : sous `table-fixed`, la place qui
                    reste se partage à parts égales entre les colonnes sans
                    largeur. Écrire un pourcentage aurait demandé un arrondi,
                    et le gardien des décimales le refuse à bon droit — un
                    `toFixed` dans un écran est presque toujours un montant
                    formaté à la main (I3). */}
                {jours.map((jour) => (
                  <col key={cleJour(jour)} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  <th className="bg-app-surface-creuse border-app-bord text-app-encre-faible w-[190px] border-b px-3.5 py-2.5 text-left text-[10.5px] font-bold tracking-wider uppercase">
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
                  <tr key={`${ligne.technicienId ?? "-"}|${ligne.agenceId}`}>
                    <td className="bg-app-surface-creuse border-app-bord border-r border-b px-3.5 py-2.5 align-top text-[12.5px] font-bold">
                      {quiTravaille(ligne.technicienId)}
                      <span className="text-app-encre-faible block text-[10.5px] font-normal">
                        {ouTravaille(ligne.agenceLibelle)}
                      </span>
                    </td>
                    {ligne.cases.map((cellule) => (
                      <td
                        key={cleJour(cellule.jour)}
                        className={`border-app-bord border-r border-b p-1.5 align-top ${
                          cellule.ouverte === false ? "trame-fermee" : ""
                        }`}
                        style={{ height: "78px" }}
                      >
                        {cellule.lignes.map((intervention) => (
                          <Link
                            key={intervention.id}
                            href={`/planning/${intervention.id}`}
                            className={`mb-1 block rounded-[5px] border-l-[3px] px-1.5 py-1 text-[11px] leading-snug ${CLASSES_BLOC[intervention.statut]}`}
                          >
                            <span className="block font-bold">
                              {referenceAffichee(intervention)}
                            </span>
                            {lieuDeLaLigne(intervention)}
                          </Link>
                        ))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
        </section>

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
                <Link
                  key={ligne.id}
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
              ))}
            </div>
          </section>

          <Statistiques lignes={charges} />
        </aside>
      </div>
    </main>
  );
}

type Ligne = Awaited<ReturnType<typeof listerPlanning>>[number];

/**
 * La semaine à afficher : celle qu'on demande, ou celle d'aujourd'hui.
 *
 * Une valeur illisible ne fait pas échouer l'écran — elle retombe sur la
 * semaine courante. *Un paramètre d'URL vient de l'extérieur* (L1-02f) : le
 * traiter comme une erreur donnerait à n'importe qui le moyen de casser la
 * page en forgeant un lien.
 */
function semaineAffichee(
  demandee: string | string[] | undefined,
  fuseau: string,
): JourLocal {
  if (typeof demandee === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(demandee);
    if (m !== null) {
      const jour = {
        annee: Number(m[1]),
        mois: Number(m[2]),
        jour: Number(m[3]),
      };
      if (
        jour.mois >= 1 &&
        jour.mois <= 12 &&
        jour.jour >= 1 &&
        jour.jour <= 31
      ) {
        return lundiDeLaSemaine(jour);
      }
    }
  }
  return lundiDeLaSemaine(maintenant(fuseau).local);
}

/**
 * L'instant UTC d'un jour local, à minuit — la borne que `listerPlanning`
 * attend.
 *
 * `date_planifiee` est une DATE, portée en `@db.Date` : la comparer à un
 * instant calculé dans un fuseau la décalerait d'un cran sous UTC+11. Les
 * bornes sont donc en UTC, comme la colonne.
 */
function instantDuJour(jour: JourLocal, decalageJours = 0): Date {
  return new Date(
    Date.UTC(jour.annee, jour.mois - 1, jour.jour + decalageJours),
  );
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

/**
 * « Lun 17 » — l'en-tête d'une colonne.
 *
 * Le jour de la semaine vient de `jourSemaineIso`, qui passe par une date UTC
 * et jamais par `getDay()` : cet accesseur lirait le fuseau de l'appareil, et
 * l'en-tête changerait selon le téléphone qui le regarde.
 */
function enTeteDeJour(jour: JourLocal): string {
  const cle = `jour.court.${jourSemaineIso(jour)}`;
  return `${estCleTraduction(cle) ? t(cle) : ""} ${jour.jour}`.trim();
}

function lieuDeLaLigne(ligne: Ligne): string {
  return `${ligne.client.raison_sociale} · ${mot("site")} ${ligne.site.libelle}`;
}

/**
 * QUI TRAVAILLE — et c'est ici que la donnée manquante se voit.
 *
 * La maquette écrit « D. Guérin ». Le dépôt n'a ni la table `technicien` du
 * chapitre 11, ni aucun moyen de lire en masse le nom d'un utilisateur — la
 * politique de `utilisateur` est de forme « désignation » (L1-02c). L'écran
 * abrège donc l'identifiant, exactement comme la charge par technicien le fait
 * depuis le 10/09. *Inventer un libellé serait inventer une donnée* (§8).
 */
function quiTravaille(technicienId: string | null): string {
  if (technicienId === null) {
    return t("statistiques.non_affectees");
  }
  return `${t("statistiques.technicien")} ${technicienId.slice(0, 8)}`;
}

function ouTravaille(agenceLibelle: string): string {
  return `${mot("agence")} ${agenceLibelle}`;
}

function LienSemaine({
  jour,
  pas,
  cle,
}: {
  readonly jour: JourLocal;
  readonly pas: number;
  readonly cle: "planning.semaine_avant" | "planning.semaine_apres";
}) {
  const date = new Date(0);
  date.setUTCFullYear(jour.annee, jour.mois - 1, jour.jour + pas);
  const cible = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
  return (
    <Link
      href={`/planning?semaine=${cible}`}
      className="border-app-bord text-app-encre-faible rounded-md border px-2.5 py-2 text-[12.5px] font-semibold"
    >
      {t(cle)}
    </Link>
  );
}
