import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Page } from "@/components/mise-en-page/page";
import { RefusAcces } from "@/components/ui/refus-acces";
import { exigerSocieteActive } from "@/lib/auth/contexte";
import { Role } from "@/lib/auth/roles";
import { obtenirSession } from "@/lib/auth/session";
import { avecContexteApplicatif } from "@/lib/db/client";
import {
  PORTES_PARAMETRAGE,
  porteOuverte,
  SECTIONS_PARAMETRAGE,
  type PorteParametrage,
} from "@/lib/navigation/portes-parametrage";
import { t } from "@/lib/i18n/fr";
import { lireIdentiteCloisonnee } from "@/lib/societes/identite";

/**
 * LA PORTE DES ÉCRANS DE PARAMÉTRAGE (R3-05) — mesuré le 13/09/2026.
 *
 * ## Ce qu'elle répare
 *
 * `/parametres/trajets` et `/parametres/forfaits` **existaient et aucun lien
 * n'y menait.** La barre menait à `/parametres/agences` et à rien d'autre ; le
 * seul chemin vers les trajets était une redirection d'API *après soumission*,
 * c'est-à-dire un chemin qu'on n'emprunte qu'en revenant d'un formulaire qu'on
 * ne peut pas ouvrir.
 *
 * > **Alexis avait demandé que les temps de trajet soient paramétrables. Ils
 * > l'étaient déjà** — R3-03 les a livrés, les valeurs sont des défauts et
 * > l'écran existe. *Le produit avait la fonction et pas la porte*, et il a
 * > fallu lire le code pour le savoir. L'ADV qui doit saisir ces données ne
 * > l'aurait jamais trouvée.
 *
 * ## POURQUOI UNE PAGE, ET NON UNE DOUZIÈME ENTRÉE DANS LA BARRE
 *
 * **La barre de D95 est une liste CLOSE de onze entrées, confrontée à la
 * maquette, et un gardien fait rougir la douzième — à raison.** Elle n'est pas
 * un menu qu'on complète : c'est le catalogue d'écrans que la maquette arrête,
 * et la forcer aurait été traiter un gardien juste comme un obstacle.
 *
 * L'entrée « Sociétés & tarifs » **est** l'entrée de paramétrage de la
 * maquette, et elle portait déjà `section: "/parametres"` — la section
 * existait, il lui manquait sa page. *Ce n'est donc pas un écran de plus : c'est
 * l'écran que la section désignait déjà.*
 *
 * ## CE QU'ELLE NE FAIT PAS
 *
 * **Elle ne lit aucune base et ne compte rien.** Une pastille « 3 forfaits » ou
 * « 6 zones réglées » se lirait comme une mesure, et il faudrait alors décider
 * ce qu'elle affiche quand la lecture échoue — c'est le motif de D88, appliqué
 * à un écran d'aiguillage. *Une porte dit où elle mène, pas ce qu'il y a
 * derrière.*
 *
 * **QT-21 (D167, 05/10/2026, TP-NAV1) range ces portes en CINQ SECTIONS** —
 * Tarifs, Planification, Organisation, Référentiels, Données
 * (`SECTIONS_PARAMETRAGE`) — plutôt qu'une grille plate : onze portes à plat
 * ne se parcouraient plus d'un regard. `/clients` et `/sites` quittent cette
 * page (ils restent au menu principal, et le hub ne les double plus) ;
 * `/parametres/societe` la quitte aussi (QT-22, Charte retirée jusqu'au lot
 * 7) — ce qu'elle portait en LECTURE, l'identité de la société active,
 * rejoint la carte « Identité » en tête de page.
 */

export const metadata = {
  title: t("parametres.index_titre"),
};

/** Les portes d'une section, dans l'ordre où `PORTES_PARAMETRAGE` les écrit. */
function portesDeLaSection(
  portes: readonly PorteParametrage[],
  section: PorteParametrage["section"],
): readonly PorteParametrage[] {
  return portes.filter((porte) => porte.section === section);
}

export default async function PageParametres() {
  const session = await obtenirSession(await headers());
  if (session === null) {
    redirect("/connexion");
  }
  if (session.contexte.societeId === null) {
    redirect("/arrivee");
  }

  // LA PORTE DES PARAMÈTRES EST FERMÉE AU TECHNICIEN (QT-2, D152, choix 6) —
  // chacune des portes qu'elle liste refuse déjà son propre accès ; la lui
  // montrer serait incohérent avec le menu, qui la lui cache déjà.
  if (
    session.contexte.role === null ||
    session.contexte.role === Role.technicien
  ) {
    return (
      <Page chemin="/parametres" titre={t("parametres.index_titre")}>
        <RefusAcces />
      </Page>
    );
  }

  // D153 (03/10/2026, TP-S3) — la page de section ne montre que les portes
  // que le rôle peut ouvrir : une porte offerte alors que sa route refuse
  // tout serait exactement la faute que PA-02 a nommée ailleurs.
  const role = session.contexte.role;
  const portesOuvertes = PORTES_PARAMETRAGE.filter((porte) =>
    porteOuverte(role, porte),
  );

  const societeId = exigerSocieteActive(session.contexte);
  const identite = await avecContexteApplicatif(session.contexte, (tx) =>
    lireIdentiteCloisonnee(tx, societeId),
  );

  return (
    <Page
      chemin="/parametres"
      titre={t("parametres.index_titre")}
      sousTitre={t("parametres.index_sous_titre")}
    >
      {identite === null ? null : <CarteIdentite identite={identite} />}

      {SECTIONS_PARAMETRAGE.map((section) => {
        const portesDeCetteSection = portesDeLaSection(
          portesOuvertes,
          section.id,
        );
        if (portesDeCetteSection.length === 0) {
          return null;
        }
        return (
          <section key={section.id} className="flex flex-col gap-3">
            <h2 className="text-app-encre-faible text-13 font-bold tracking-wide uppercase">
              {t(section.titre)}
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {portesDeCetteSection.map((porte) => (
                <li key={porte.chemin}>
                  <Link
                    href={porte.chemin}
                    className="border-app-trait hover:border-app-marque block h-full rounded-lg border p-4 transition-colors"
                  >
                    <span className="text-app-encre block text-[15px] font-medium">
                      {t(porte.titre)}
                    </span>
                    <span className="text-app-encre-faible mt-1.5 block text-[13px] font-bold">
                      {t(porte.resume)}
                    </span>
                    <span className="text-app-marque mt-3 block text-13 font-bold">
                      {t("parametres.index_ouvrir")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </Page>
  );
}

/**
 * LA CARTE « IDENTITÉ », EN LECTURE SEULE (QT-22, D167) — six colonnes de
 * `societe`, et rien de plus : voir `lib/societes/identite.ts`. Un champ
 * nullable (`libelle_code_externe`, `mentions_legales`) dit qu'il n'est pas
 * renseigné plutôt que de se taire.
 */
function CarteIdentite({
  identite,
}: {
  readonly identite: Awaited<ReturnType<typeof lireIdentiteCloisonnee>>;
}) {
  if (identite === null) {
    return null;
  }
  const champ = (valeur: string | null): string =>
    valeur === null || valeur.trim() === ""
      ? t("parametres.identite_non_renseigne")
      : valeur;

  return (
    <section className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-lg border px-4 py-3.5">
      <h2 className="text-[14px] font-bold">
        {t("parametres.identite_titre")}
      </h2>
      <dl className="grid gap-3 text-13 font-bold sm:grid-cols-2">
        <LigneIdentite
          libelle={t("parametres.identite_raison_sociale")}
          valeur={identite.raison_sociale}
        />
        <LigneIdentite
          libelle={t("parametres.identite_territoire")}
          valeur={identite.territoire}
        />
        <LigneIdentite
          libelle={t("parametres.identite_fuseau_horaire")}
          valeur={identite.fuseau_horaire}
        />
        <LigneIdentite
          libelle={t("parametres.identite_devise")}
          valeur={identite.devise_code}
        />
        <LigneIdentite
          libelle={t("parametres.identite_libelle_code_externe")}
          valeur={champ(identite.libelle_code_externe)}
        />
        <LigneIdentite
          libelle={t("parametres.identite_mentions_legales")}
          valeur={champ(identite.mentions_legales)}
        />
      </dl>
    </section>
  );
}

function LigneIdentite({
  libelle,
  valeur,
}: {
  readonly libelle: string;
  readonly valeur: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-app-encre-faible text-12 font-bold">{libelle}</dt>
      <dd className="text-app-encre text-[13px] font-bold">{valeur}</dd>
    </div>
  );
}
