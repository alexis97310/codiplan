import Link from "next/link";

import { t } from "@/lib/i18n/fr";
import { cn } from "@/lib/utils";

/**
 * LES PUCES DE VUE DES LISTES RÉFÉRENTIEL — `.fchip`/`.pill-count` de
 * `docs/propositions/ergonomie-2026-09-28/maquette-toutes-pages.html`
 * (`puceFiltre()`, :3598-3601), pour `/clients` et `/sites`
 * (9EB-TP-UX3-2-LISTES-1 ; QE-10 (a) du 03/10/2026, qui revient sur D122 pour
 * CES DEUX listes). `9EB-TP-UX3-2-LISTES-2` (parc, imports) réutilise ce
 * fichier plutôt que d'en récrire un pareil.
 *
 * **`PuceVue`, et pas `PuceFiltre`** : ce nom existe déjà,
 * `app/(back-office)/interventions/presentation.ts:874`, pour un type tout
 * différent (une puce RETIRABLE, posée après une recherche). Deux notions
 * différentes sous le même nom se seraient confondues au premier import
 * côte à côte.
 *
 * ## Zéro ET actif ne sont pas la même porte
 *
 * *« à 0, un état neutre (pas une porte) »* (commentaire de `puceFiltre()`,
 * maquette) — une vue qui ne montrerait rien ne doit pas se cliquer pour
 * autant, sauf si c'est la vue COURANTE : rester dessus reste légitime même
 * vide (ex. « Trajet inconnu » après avoir corrigé le dernier).
 */
export function PuceVue({
  libelle,
  compteur,
  href,
  actif,
}: Readonly<{
  libelle: string;
  compteur: number;
  href: string;
  actif: boolean;
}>) {
  const pastille = (
    <span
      data-n={compteur}
      className="bg-app-bord-faible text-app-gris-encre inline-grid h-5 min-w-[22px] place-items-center rounded-full px-[7px] text-12 font-bold"
    >
      {compteur}
    </span>
  );
  if (compteur === 0 && !actif) {
    return (
      <span
        aria-disabled="true"
        className="border-app-bord text-app-gris-encre inline-flex h-9 items-center gap-1.5 rounded-full border border-dashed px-3 text-13 font-bold opacity-55 whitespace-nowrap"
      >
        {libelle}
        {pastille}
      </span>
    );
  }
  return (
    <Link
      href={href}
      aria-current={actif ? "true" : undefined}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-13 font-bold whitespace-nowrap",
        actif
          ? "border-app-bleu-bord bg-app-bleu-fond text-app-bleu-encre"
          : "border-app-bord text-app-gris-encre border-dashed hover:border-app-marque hover:text-app-marque",
      )}
    >
      {libelle}
      {pastille}
    </Link>
  );
}

/**
 * LA PUCE D'UN CRITÈRE POSÉ PAR UN MENU — « <Libellé> : <valeur> » puis une
 * croix qui le retire seul, MÊME FORME que les puces retirables du registre
 * des interventions (`puce_retirer`/`puce_signe_retrait`,
 * `app/(back-office)/interventions/page.tsx:891-905`), des clés NEUTRES ici
 * (`puces.retirer`/`puces.signe_retrait`) plutôt qu'un emprunt au vocabulaire
 * d'un autre module.
 *
 * **Elle ne dessine AUCUN menu.** Le menu lui-même — « Trier par », « Zone »,
 * « Agence » — est un `<select>` natif DANS le formulaire `GET` existant,
 * soumis par le bouton « Rechercher » (choix du pilote, 07/10/2026) : aucun
 * composant client n'était nécessaire pour choisir, seulement pour RAPPELER
 * ce qui est choisi et permettre de l'effacer sans rouvrir le formulaire.
 * `valeur` absente (`null`) : rien ne s'affiche, le `<select>` porte seul
 * l'état.
 */
export function PuceMenu({
  libelle,
  valeur,
  href,
}: Readonly<{
  libelle: string;
  valeur: string | null;
  href: string;
}>) {
  if (valeur === null) {
    return null;
  }
  return (
    <span className="border-app-bord bg-app-surface-creuse inline-flex items-center gap-1.5 rounded-full border py-1 pr-2 pl-3 text-[12px] font-bold">
      {libelle}
      {t("ponctuation.deux_points")}
      {valeur}
      <Link
        href={href}
        aria-label={t("puces.retirer")}
        className="text-app-encre-faible hover:text-app-encre"
      >
        {t("puces.signe_retrait")}
      </Link>
    </span>
  );
}

/**
 * LE RÉSUMÉ AU-DESSUS DE LA GRILLE — « N clients » / « N sites · par client,
 * puis par site » (§5.4 de la spécification du 28/09/2026), là où la liste le
 * montrait jusqu'ici SOUS la pagination. `texte` est déjà composé par
 * l'appelant via `decompte` (`app/(back-office)/presentation.ts`) — cette
 * pièce n'assemble qu'un nombre déjà mis en mots et un complément facultatif,
 * jamais une phrase à elle seule.
 */
export function ResumeListe({
  texte,
  complement,
}: Readonly<{
  texte: string;
  /** Ex. « · par client, puis par site », ou « pour « x », sans tenir compte des accents ». Absent, rien n'est ajouté. */
  complement?: React.ReactNode;
}>) {
  return (
    <p className="text-13 font-bold">
      <b className="text-app-encre">{texte}</b>
      <span className="text-app-encre-faible">{complement}</span>
    </p>
  );
}
