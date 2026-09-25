import Link from "next/link";

import { t } from "@/lib/i18n/fr";
import {
  ENTREES,
  groupeDe,
  type EntreeDeBarre,
} from "@/lib/navigation/entrees";
import { CLASSES_LIEN } from "@/lib/theme/apparence";
import { cn } from "@/lib/utils";

/**
 * LE GABARIT D'ÉCRAN — domaine, titre, sous-titre, actions (AT-04, N-08).
 *
 * ## Pourquoi ce composant, maintenant
 *
 * *Chaque écran du back-office a écrit son propre `<h1>`* : `text-[22px]
 * font-extrabold tracking-tight` ici, sans `tracking` là, un `<p>` de
 * sous-titre parfois séparé par `gap-5` du flux, parfois par une marge. Rien
 * ne divergeait au point de casser un test, et c'est exactement pourquoi rien
 * ne l'a signalé : *une mise en page recopiée à la main devient fausse en
 * silence le jour où l'originale bouge* (§9, 01/09). C'est le défaut nommé par
 * le directeur d'exploitation — « certaines pages ne reprennent pas la mise en
 * page de la maquette » — et sa cause n'est pas un écran raté, c'est l'absence
 * d'un vocabulaire commun.
 *
 * **N-08 mesure la même chose une seconde fois, ailleurs** : ce composant
 * n'existait sur AUCUN écran du ticket AT-04 alors qu'il portait déjà le
 * remède ; vingt-six écrans sur vingt-neuf écrivaient encore leur propre
 * `<header>` (mesuré le 17/09/2026). Ce ticket l'étend d'un surtitre de
 * domaine et le pose sur les vingt-six.
 *
 * ## LE SURTITRE DE DOMAINE VIENT DE `entrees.ts`, JAMAIS D'UN ÉCRAN
 *
 * `docs/maquette/codiplan-maquette-complete.html` pose un `eyebrow` — le nom
 * du domaine — au-dessus de chaque titre (`head(domain, title, …)`). Un écran
 * ne le NOMME pas : il dit son propre CHEMIN, et `groupeDe` (D121, D122)
 * répond quel domaine le porte — *une seconde lecture du même critère
 * divergerait en silence le jour où la barre change de forme* (§9, 01/09).
 * `null` — un chemin sans groupe, comme `/arrivee` ou une entrée d'une barre
 * plate (portail, terrain) — n'affiche simplement aucun surtitre.
 *
 * **`entrees` doit nommer la BONNE barre, jamais celle par défaut.** Mesuré
 * le 17/09/2026, en écran plutôt qu'en test : `/portail` affichait « CLIENTS
 * & PARC » — le domaine du back-office — sur l'écran d'un CLIENT, parce que
 * `groupeDe` retombait sur `ENTREES` (la barre interne) et y trouve bien une
 * entrée `/portail` (« Portail client », un LIEN interne vers cet écran). *Un
 * client qui lirait un domaine du back-office apprendrait l'existence d'un
 * découpage qui n'est pas le sien* — la même faute que D97 nomme pour un
 * libellé de menu. `app/(portail)/portail/page.tsx` passe donc
 * `entrees={ENTREES_PORTAIL}`, une barre PLATE où `groupeDe` ne trouve jamais
 * de groupe : aucun surtitre n'y est jamais un risque de fuite.
 *
 * ## Les valeurs, lues et non approchées
 *
 * `docs/maquette/CODIPLAN_Maquette.html` : `h1{font-size:22px;font-weight:800;
 * letter-spacing:-.4px;margin-bottom:3px}` et
 * `.sub{color:var(--gris);font-size:13px;margin-bottom:20px}`. Un gardien
 * confronte ces deux règles au texte de ce fichier
 * (`tests/unit/ui/composants-maquette.test.ts`) — la même discipline que
 * `tests/unit/navigation/entrees.test.ts` applique à la barre.
 *
 * `docs/maquette/codiplan-maquette-complete.html` : `.eyebrow{color:var(
 * --blue);font-size:12px;font-weight:850;text-transform:uppercase;
 * letter-spacing:.09em;margin-bottom:4px}` — D95 continue de fixer la
 * COULEUR (`--blue` vaut `--bleu`, D122) ; c'est de là que vient `--app-
 * marque`, jamais un second jeton. `850` n'a pas de classe Tailwind : `800`
 * (`font-extrabold`) est la plus proche, le même écart que `Tableau` accepte
 * déjà entre `16px` et l'échelle par défaut (§ »Aucune couleur écrite ici«).
 *
 * ## Ce qu'il ne fait pas
 *
 * Il ne pose pas la largeur utile — `LargeurUtile` la pose déjà, à la racine du
 * segment (R2-16) — et il ne pose aucune couleur : `text-app-encre-faible` est
 * un jeton, jamais `var(--gris)` recopié.
 */
export function Page({
  chemin,
  entrees = ENTREES,
  filAriane,
  titre,
  sousTitre,
  actions,
  className,
  children,
}: Readonly<{
  /** Le chemin de CET écran — `groupeDe` en déduit le domaine, jamais l'appelant. */
  chemin?: string;
  /** La barre qui gouverne cet écran. `ENTREES` (back-office) par défaut ; le portail passe `ENTREES_PORTAIL`. */
  entrees?: readonly EntreeDeBarre[];
  /**
   * LE FIL D'ARIANE (FICHE-360-1) — `Clients › <client> › <site>`, AU-DESSUS
   * du titre. Facultatif et distinct du surtitre de domaine ci-dessous :
   * celui-ci nomme un DOMAINE (« CLIENTS & PARC »), jamais une hiérarchie
   * d'entités. Le DERNIER élément n'est jamais un lien — c'est l'écran
   * courant, et il porte déjà le `<h1>`.
   */
  filAriane?: readonly {
    readonly libelle: string;
    readonly href?: string;
  }[];
  titre: React.ReactNode;
  /**
   * LIENS-1 — un sous-titre PEUT être un lien (la fiche site mène à son
   * client). `React.ReactNode` plutôt que `string` : tous les appelants
   * existants passent déjà des chaînes, qui restent valides.
   */
  sousTitre?: React.ReactNode;
  /** Le bandeau de droite — un décompte, une action. Jamais un bouton de création (§2). */
  actions?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}>) {
  const domaineCle = chemin === undefined ? null : groupeDe(chemin, entrees);
  return (
    // `id` + `tabIndex={-1}` : cible du lien d'évitement posé par la coque
    // du back-office (`app/(back-office)/layout.tsx`) — un lien qui pointe
    // vers un `id` inatteignable au clavier déplacerait le focus visuel sans
    // déplacer le focus réel.
    <main
      id="contenu"
      tabIndex={-1}
      className={cn("flex flex-col gap-5", className)}
    >
      {filAriane === undefined || filAriane.length === 0 ? null : (
        <nav
          aria-label={t("navigation.fil_ariane")}
          className="text-app-encre-faible flex flex-wrap items-center gap-1 text-[12px]"
        >
          {filAriane.map((entree, index) => (
            <span key={index} className="flex items-center gap-1">
              {index === 0 ? null : (
                <span aria-hidden="true">{t("fil_ariane.separateur")}</span>
              )}
              {entree.href === undefined ? (
                <span aria-current="page">{entree.libelle}</span>
              ) : (
                <Link href={entree.href} className={CLASSES_LIEN}>
                  {entree.libelle}
                </Link>
              )}
            </span>
          ))}
        </nav>
      )}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          {domaineCle === null ? null : (
            <div className="text-app-marque mb-[4px] text-[12px] font-extrabold tracking-[0.09em] uppercase">
              {t(domaineCle)}
            </div>
          )}
          <h1 className="mb-[3px] text-[22px] font-extrabold tracking-[-0.4px]">
            {titre}
          </h1>
          {sousTitre === undefined ? null : (
            <p className="text-app-encre-faible mb-[20px] text-[13px]">
              {sousTitre}
            </p>
          )}
        </div>
        {actions === undefined ? null : (
          <div className="flex flex-wrap items-center gap-3">{actions}</div>
        )}
      </header>
      {children}
    </main>
  );
}
