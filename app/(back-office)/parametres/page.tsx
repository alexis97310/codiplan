import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Page } from "@/components/mise-en-page/page";
import { Badge } from "@/components/ui/badge";
import { Carte } from "@/components/ui/carte";
import { Icone } from "@/components/ui/icone";
import { RefusAcces } from "@/components/ui/refus-acces";
import { exigerSocieteActive } from "@/lib/auth/contexte";
import { peutPleinement } from "@/lib/auth/habilitations";
import { Role } from "@/lib/auth/roles";
import { obtenirSession } from "@/lib/auth/session";
import { decalageUtc } from "@/lib/calendar/fuseau";
import { avecContexteApplicatif } from "@/lib/db/client";
import { t } from "@/lib/i18n/fr";
import {
  decomptesParametrage,
  type Decompte,
} from "@/lib/navigation/decomptes-parametrage";
import {
  PORTES_PARAMETRAGE,
  porteOuverte,
  SECTIONS_PARAMETRAGE,
  type PorteParametrage,
} from "@/lib/navigation/portes-parametrage";
import {
  lireIdentiteCloisonnee,
  sigleDeLaRaisonSociale,
} from "@/lib/societes/identite";
import { cn } from "@/lib/utils";

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
 * ## CE QUE CETTE PAGE FAIT, À LA LETTRE DE LA MAQUETTE (9EWD-PARAMETRES-HUB-
 * MAQUETTE, décision n° 97 d'Alexis, 13/10/2026)
 *
 * Elle NE calcule rien elle-même : chaque décompte sous une porte vient de
 * `lib/navigation/decomptes-parametrage.ts`, qui lit séparément de cette page
 * et avale ses propres erreurs — une pastille qui échoue à se lire disparaît,
 * jamais la page.
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

  // AUCUN FUSEAU INVENTÉ (§8) : sans identité lisible, aucun décompte ne se
  // calcule — le cas ne se produit pas en pratique (la société active est
  // garantie par `exigerSocieteActive`), mais rien ici ne lui substitue une
  // valeur par défaut.
  const decomptes =
    identite === null
      ? new Map<string, Decompte>()
      : await decomptesParametrage(
          session.contexte,
          portesOuvertes,
          identite.fuseau_horaire,
        );

  return (
    <Page
      chemin="/parametres"
      surtitre={t("parametres.index_surtitre")}
      titre={t("parametres.index_titre")}
      sousTitre={t("parametres.index_sous_titre")}
    >
      {identite === null ? null : (
        <CarteIdentite
          identite={identite}
          peutChangerLogo={peutPleinement(role, "parametrer_societe")}
        />
      )}

      {SECTIONS_PARAMETRAGE.map((section) => {
        const portesDeCetteSection = portesDeLaSection(
          portesOuvertes,
          section.id,
        );
        if (portesDeCetteSection.length === 0) {
          return null;
        }
        return (
          <section
            key={section.id}
            className="flex flex-col gap-3 sm:flex-row sm:gap-6"
          >
            <div className="sm:w-[260px] sm:shrink-0">
              <h2 className="text-app-encre text-15 font-bold">
                {t(section.titre)}
              </h2>
              <p className="text-app-encre-faible mt-1 text-13 font-bold">
                {t(section.sousTitre)}
              </p>
            </div>
            <ul className="grid flex-1 items-stretch gap-3 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
              {portesDeCetteSection.map((porte) => (
                <li key={porte.chemin} className="h-full">
                  <CartePorte
                    porte={porte}
                    decompte={decomptes.get(porte.chemin)}
                  />
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
 * Une porte du hub — la tuile ENTIÈRE est l'encadré blanc de la maquette
 * (M:4364-4367, audit du 21/10/2026, 9G9A), portée par `Carte` (9G9D,
 * 25/10/2026) plutôt que recopiée à la main.
 *
 * **La tuile entière est cliquable sans imbriquer deux liens** (9G9D) : le
 * SEUL `<Link>` de la tuile s'étire par son pseudo-élément
 * `after:absolute after:inset-0`, ancré sur la `<section>` de `Carte`
 * (`relative`) — tout l'encadré devient sa zone de clic, sans second `<a>`.
 * La pastille reste SON propre lien, posé par-dessus (`relative z-10`) :
 * sans ce relevé de pile, l'`after` étiré du lien de la tuile, lui-même
 * positionné, peindrait au-dessus d'elle et avalerait son clic.
 */
function CartePorte({
  porte,
  decompte,
}: {
  readonly porte: PorteParametrage;
  readonly decompte: Decompte | undefined;
}) {
  return (
    <Carte className="hover:border-app-marque relative flex h-full flex-col gap-2 p-3 transition-colors">
      <Link
        href={porte.chemin}
        className="flex flex-1 items-center gap-3 after:absolute after:inset-0"
      >
        <span className="bg-app-bleu-fond text-app-bleu-encre flex size-9 shrink-0 items-center justify-center rounded-md">
          <Icone nom={porte.icone} taille={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-app-encre block text-[15px] font-bold">
            {porte.titreCompose ? porte.titreCompose() : t(porte.titre)}
          </span>
          <span className="text-app-encre-faible mt-0.5 block text-13 font-bold">
            {porte.resumeCompose ? porte.resumeCompose() : t(porte.resume)}
          </span>
        </span>
        <Icone
          nom="chev-r"
          taille={16}
          className="text-app-encre-faible shrink-0"
        />
      </Link>
      {decompte === undefined ? null : (
        <span className="relative z-10 self-start">
          <PastilleDecompte decompte={decompte} />
        </span>
      )}
    </Carte>
  );
}

/**
 * LA PASTILLE-DÉCOMPTE — orange ET lien quand elle alerte, grise et inerte
 * sinon (M:4366). Le retrait de 48 px aligne le texte sous le TITRE de la
 * carte, pas sous sa pastille d'icône (36 px + 12 px d'écart).
 *
 * **La forme est celle de `Badge`** (`rounded-[20px]`, `px-[8px] py-[2px]`,
 * audit du 21/10/2026, 9G9A) — `rounded-md` dessinait une pastille carrée à
 * côté des pilules du reste du produit. Pas `Badge` lui-même : lui ne porte
 * pas de `href`, et cette pastille doit rester cliquable quand `decompte`
 * alerte.
 */
function PastilleDecompte({ decompte }: { readonly decompte: Decompte }) {
  const classes =
    decompte.ton === "alerte"
      ? "bg-app-orange-fond text-app-orange-encre"
      : "bg-app-gris-fond text-app-gris-encre";
  const contenu = (
    <>
      {decompte.ton === "alerte" ? <Icone nom="alert" taille={16} /> : null}
      <span>{decompte.texte}</span>
    </>
  );
  if (decompte.href === undefined) {
    return (
      <span
        className={cn(
          "ml-[48px] inline-flex items-center gap-1.5 self-start rounded-[20px] px-[8px] py-[2px] text-12 font-bold",
          classes,
        )}
      >
        {contenu}
      </span>
    );
  }
  return (
    <Link
      href={decompte.href}
      className={cn(
        "ml-[48px] inline-flex items-center gap-1.5 self-start rounded-[20px] px-[8px] py-[2px] text-12 font-bold",
        classes,
      )}
    >
      {contenu}
    </Link>
  );
}

/**
 * LA CARTE « IDENTITÉ », EN LECTURE SEULE (QT-22, D167 ; à la lettre de la
 * maquette depuis 9EWD-PARAMETRES-HUB-MAQUETTE, M:4356-4361) — six colonnes
 * de `societe`, et rien de plus : voir `lib/societes/identite.ts`. Un champ
 * nullable (`libelle_code_externe`, `mentions_legales`) dit qu'il n'est pas
 * renseigné plutôt que de se taire.
 */
function CarteIdentite({
  identite,
  peutChangerLogo,
}: {
  readonly identite: Awaited<ReturnType<typeof lireIdentiteCloisonnee>>;
  readonly peutChangerLogo: boolean;
}) {
  if (identite === null) {
    return null;
  }
  const champ = (valeur: string | null): string =>
    valeur === null || valeur.trim() === ""
      ? t("parametres.identite_non_renseigne")
      : valeur;
  const devise =
    identite.devise.libelle +
    t("ponctuation.parenthese_ouvrante") +
    identite.devise.code +
    t("ponctuation.parenthese_fermante") +
    t("ponctuation.virgule") +
    (identite.devise.decimales === 0
      ? t("parametres.identite_devise_sans_decimale")
      : t("parametres.identite_devise_avec_decimales"));
  const fuseau =
    identite.fuseau_horaire +
    t("ponctuation.parenthese_ouvrante") +
    decalageUtc(identite.fuseau_horaire) +
    t("ponctuation.parenthese_fermante");

  return (
    <Carte>
      <div className="flex flex-col gap-3 px-4 py-3.5">
        <h2 className="flex items-center justify-between gap-3 text-[14px] font-bold">
          <span className="flex items-center gap-2">
            <Icone nom="building" taille={18} />
            {t("parametres.identite_titre")}
          </span>
          <Badge ton="gris">{t("parametres.identite_badge_lecture")}</Badge>
        </h2>
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="bg-app-bleu-fond text-app-bleu-encre flex size-12 shrink-0 items-center justify-center rounded-full text-[15px] font-extrabold"
          >
            {sigleDeLaRaisonSociale(identite.raison_sociale)}
          </span>
          <div className="flex flex-col">
            <span className="text-app-encre text-[15px] font-bold">
              {identite.raison_sociale}
            </span>
            <span className="text-app-encre-faible text-13 font-bold">
              {t("parametres.identite_reglee_a_la_mise_en_service")}
            </span>
          </div>
        </div>
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
            libelle={t("parametres.identite_devise")}
            valeur={devise}
          />
          <LigneIdentite
            libelle={t("parametres.identite_fuseau_horaire")}
            valeur={fuseau}
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
        <p className="text-app-encre-faible flex items-start gap-1.5 text-12 font-bold">
          <Icone nom="info" taille={16} className="mt-0.5 shrink-0" />
          <span>{t("parametres.identite_note")}</span>
        </p>
        {peutChangerLogo ? (
          <Link
            href="/parametres/societe"
            className="text-app-bleu-encre self-start text-13 font-bold underline"
          >
            {t("parametres.identite_changer_logo")}
          </Link>
        ) : null}
      </div>
    </Carte>
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
