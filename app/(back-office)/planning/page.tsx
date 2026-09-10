import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { listerPlanning } from "@/lib/interventions/depot";
import { t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";
import { obtenirSession } from "@/lib/auth/session";

import { CLASSES_STATUT } from "@/lib/theme/statuts";

import { occupationsDuPlanning } from "@/lib/interventions/occupation";

import { referenceAffichee } from "./presentation";
import { Statistiques } from "./statistiques";

/**
 * LE PLANNING (lot 2, D84) — la liste de ce qui est posé et de ce qui attend.
 *
 * **Ce n'est pas encore un calendrier**, et l'écrire évite de le laisser croire :
 * Schedule-X viendra au lot 3 avec la PWA. Ce que cet écran apporte, et qui
 * manquait entièrement, c'est qu'on puisse AGIR — créer, affecter, déplacer,
 * clôturer, annuler. Un planning qu'on ne peut pas modifier n'est pas un outil.
 *
 * Les couleurs de statut viennent de l'annexe D du cahier des charges, promue
 * au rang de règle (CLAUDE.md §1). Elles sont dans `presentation.ts` : une
 * seule maison, pour que la fiche et la liste ne divergent pas.
 */
export default async function PagePlanning() {
  const session = await obtenirSession(await headers());
  if (session === null) {
    redirect("/connexion");
  }
  if (session.contexte.societeId === null) {
    redirect("/arrivee");
  }

  // La période affichée : le mois en cours et le suivant. Elle n'est pas encore
  // réglable — un sélecteur sans calendrier serait un réglage sans usage.
  const du = new Date(Date.UTC(2026, 8, 1));
  const au = new Date(Date.UTC(2026, 10, 30));
  const lignes = await listerPlanning(session.contexte, du, au);

  // La charge par technicien, sur la MÊME période et les MÊMES lignes que la
  // liste : deux périodes différentes feraient deux lectures d'un même critère.
  const charges = await occupationsDuPlanning(session.contexte, lignes, du, au);

  const posees = lignes.filter((l) => l.date_planifiee !== null);
  const attente = lignes.filter((l) => l.date_planifiee === null);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("planning.titre")}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t("planning.sous_titre")}
          </p>
        </div>
        <Link
          href="/planning/nouvelle"
          className="bg-societe-primaire text-societe-primaire-encre rounded-md px-4 py-2 text-sm font-medium"
        >
          {t("planning.creer")}
        </Link>
      </header>

      {lignes.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("planning.vide")}</p>
      ) : null}

      <Statistiques lignes={charges} />

      {attente.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">{t("planning.file_attente")}</h2>
          <Liste lignes={attente} />
        </section>
      ) : null}

      {posees.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">{t("planning.periode")}</h2>
          <Liste lignes={posees} />
        </section>
      ) : null}
    </main>
  );
}

type Ligne = Awaited<ReturnType<typeof listerPlanning>>[number];

/**
 * Le client et le lieu d'une ligne, composés hors du JSX.
 *
 * Le code nomme la NOTION — `mot("site")` — et jamais le mot (D5, D47,
 * L0-11) ; la composition sort du JSX parce qu'un littéral n'y est pas admis,
 * et pour la même raison : ce qui se lit à l'écran vient du dictionnaire, pas
 * de la balise.
 */
function lieuDeLaLigne(ligne: Ligne): string {
  return `${ligne.client.raison_sociale} · ${mot("site")} ${ligne.site.libelle}`;
}

function Liste({ lignes }: { lignes: readonly Ligne[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {lignes.map((ligne) => (
        <li key={ligne.id}>
          <Link
            href={`/planning/${ligne.id}`}
            className="border-border hover:bg-muted flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 text-sm"
          >
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${CLASSES_STATUT[ligne.statut]}`}
            >
              {t(`statut.${ligne.statut}`)}
            </span>
            <span className="font-medium">{referenceAffichee(ligne)}</span>
            <span className="text-muted-foreground">
              {t(`type_intervention.${ligne.type}`)}
            </span>
            <span className="text-muted-foreground">
              {t(`priorite.${ligne.priorite}`)}
            </span>
            <span className="text-muted-foreground ml-auto">
              {ligne.date_planifiee === null
                ? t("planning.file_attente")
                : ligne.date_planifiee.toISOString().slice(0, 10)}
            </span>
            <span className="text-muted-foreground w-full text-xs">
              {lieuDeLaLigne(ligne)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
