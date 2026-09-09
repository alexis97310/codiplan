import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { EnTete, Page, Vide } from "@/components/charte/socle";
import { GrillePlanning, Legende } from "@/components/planning/grille";
import { etatArrivee } from "@/lib/auth/arrivee";
import { obtenirSession } from "@/lib/auth/session";
import { cleJour, jourSuivant, lireCleJour, maintenant } from "@/lib/calendar";
import { t } from "@/lib/i18n/fr";
import { fuseauDeLaSocieteActive, planningDuJour } from "@/lib/planning/depot";
import { type Grille, grilleDuJour } from "@/lib/planning/grille";

/**
 * L'ÉCRAN DU PLANNING (ticket L2-11) — D72, D73, D74.
 *
 * **Les données viennent de la base, aucune n'est figée ici.** C'est ce qui
 * rend l'écran capable de prouver quelque chose : le cloisonnement, parce que
 * `intervention` est de forme « parc » (D82) ; le refus d'affectation, parce
 * qu'il est calculé sur les vraies habilitations du technicien à la date de
 * l'intervention (RG-PLA-04).
 *
 * **Le jour affiché est une DATE LOCALE**, celle qu'on vit à l'agence, et il
 * voyage dans l'URL sous la forme `?jour=AAAA-MM-JJ`. Sous UTC+11, un planning
 * calculé sur une fenêtre UTC se décale d'un cran — c'est le défaut que L0-08
 * a fermé, et le rouvrir ici serait le rouvrir à l'endroit le plus visible.
 */
export default async function PagePlanning({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const entetes = await headers();
  const etat = await etatArrivee(entetes);
  if (etat.issue === "anonyme") {
    redirect("/connexion");
  }
  if (etat.issue === "enrolement_requis") {
    redirect("/enrolement");
  }
  if (etat.issue === "sans_societe") {
    redirect("/arrivee");
  }

  const session = await obtenirSession(entetes);
  if (session === null) {
    redirect("/connexion");
  }

  const contexte = session.contexte;

  // LE FUSEAU vient de la société, jamais du serveur (L0-08). C'est le seul
  // module autorisé à lire la date courante, et il la lit AVEC un fuseau.
  const fuseau = (await fuseauDeLaSocieteActive(contexte)) ?? "UTC";
  const aujourdhui = maintenant(fuseau).local;

  const demande = (await searchParams).jour;
  const jour =
    typeof demande === "string"
      ? (lireCleJour(demande) ?? aujourdhui)
      : aujourdhui;

  const planning = await planningDuJour(contexte, jour);

  // Une grille PAR COLONNE : les heures sont celles du technicien, pas celles
  // du planning (D72 — exception possible par technicien).
  const grilles = new Map<string, Grille>(
    planning.colonnes.flatMap((colonne) =>
      colonne.calendrier === null
        ? []
        : [[colonne.id, grilleDuJour(colonne.calendrier, jour)] as const],
    ),
  );

  const veille = jourSuivant(jour, -1);
  const lendemain = jourSuivant(jour, 1);

  return (
    <Page large>
      <EnTete
        titre={t("planning.titre")}
        accroche={t("planning.accroche")}
        actions={
          <nav className="flex items-center gap-3 text-sm">
            <a
              className="text-bleu underline"
              href={`?jour=${cleJour(veille)}`}
            >
              {t("planning.jour_precedent")}
            </a>
            <a className="text-bleu underline" href="?">
              {t("planning.aujourdhui")}
            </a>
            <a
              className="text-bleu underline"
              href={`?jour=${cleJour(lendemain)}`}
            >
              {t("planning.jour_suivant")}
            </a>
          </nav>
        }
      />

      <p className="text-gris text-sm">{cleJour(jour)}</p>

      {planning.colonnes.length === 0 ? (
        <Vide
          titre={t("planning.vide.titre")}
          invitation={t("planning.vide.invitation")}
        />
      ) : (
        <>
          <GrillePlanning
            colonnes={planning.colonnes}
            blocs={planning.blocs}
            grilles={grilles}
          />
          {planning.blocs.length === 0 ? (
            <Vide
              titre={t("planning.aucun_bloc.titre")}
              invitation={t("planning.aucun_bloc.invitation")}
            />
          ) : null}
          <Legende />
        </>
      )}

      <p>
        <a className="text-bleu underline" href="/arrivee">
          {t("navigation.retour")}
        </a>
      </p>
    </Page>
  );
}
