"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { BandeauSociete } from "@/components/theme/bandeau-societe";
import { t } from "@/lib/i18n/fr";
import { entreeActive, type EntreeNavigation } from "@/lib/navigation/entrees";
import type { ThemeSociete } from "@/lib/theme/theme";

/**
 * LA BARRE DE NAVIGATION — la `.topbar` de la maquette (D95).
 *
 * *Mesuré le 11/09/2026, avant : l'application ne portait AUCUNE navigation. On
 * n'y circulait qu'en tapant une URL dans la barre d'adresse.* C'est le point 2
 * de l'écart relevé par l'exploitation, et c'est celui qui rend les autres
 * visibles : sans elle, personne n'atteint un second écran pour constater qu'il
 * ne ressemble pas non plus à la maquette.
 *
 * **Elle est du CHROME**, au même titre que le bandeau de société qu'elle
 * absorbe : elle vit dans la mise en page du SEGMENT (R2-16), elle est commune
 * à toutes ses routes, et aucun écran n'a à la rendre. Un écran qui la rendrait
 * lui-même serait un écran qui peut oublier de la rendre.
 *
 * **Ce composant ne SAIT PAS quelles entrées il rend, et c'est délibéré
 * (D97).** Le back-office a les siennes, le portail les siennes ; une barre qui
 * choisirait elle-même devrait lire le chemin pour décider, c'est-à-dire tenir
 * une SECONDE liste de segments à côté de celle des répertoires — et une liste
 * tenue à la main oublie le prochain segment. Le segment sait ; il passe.
 *
 * **Aucune couleur n'est écrite ici.** Les classes nomment des jetons
 * d'apparence — `bg-app-surface`, `text-app-encre-faible`, `bg-app-marque` —,
 * et l'apparence est choisie sur le document. C'est ce qui fera qu'ajouter un
 * second thème ne demandera pas de rouvrir ce fichier.
 *
 * **POURQUOI ELLE EST UN COMPOSANT CLIENT, et c'est la seule raison.** Une mise
 * en page racine ne connaît pas le chemin courant : Next 15 ne le lui passe
 * pas, et l'en-tête que l'on croit pouvoir lire n'est pas un contrat — *c'est
 * un détail d'implémentation qui a déjà changé de nom deux fois*. Le chemin se
 * lit donc là où il est garanti, par `usePathname`. Tout le reste — le thème,
 * les initiales — est calculé sur le serveur et passé en propriété : rien de
 * cloisonné ne traverse la frontière.
 *
 * **Le calcul de l'entrée allumée vit dans `lib/navigation`, avec la liste** —
 * deux lectures d'un même critère divergent en silence (§9, 01/09), et il n'y
 * en a qu'une.
 */
export function BarreDeNavigation({
  theme,
  initiales,
  entrees,
  accueil,
}: {
  readonly theme: ThemeSociete;
  /** Les initiales de la personne connectée, ou `null` si personne ne l'est. */
  readonly initiales: string | null;
  /**
   * LES ENTRÉES À RENDRE — celles du back-office ou celles du portail (D97).
   *
   * **Obligatoire, sans valeur par défaut.** Un défaut ferait qu'une mise en
   * page qui oublie de choisir reçoit la barre du back-office *en silence*, et
   * c'est exactement la faute que R2-17 répare : le portail affichait onze
   * entrées de back-office parce que personne n'avait eu à décider. *Sans
   * défaut, l'oubli ne compile pas.*
   */
  readonly entrees: readonly EntreeNavigation[];
  /**
   * Où mène la marque. Elle n'est pas décorative : c'est le point de retour, et
   * il diffère par segment — `/planning` ne s'ouvre pas à un compte de portail,
   * qui n'a aucune habilitation de société (D10) et serait redirigé.
   */
  readonly accueil: string;
}) {
  const actif = entreeActive(usePathname() ?? "", entrees)?.cle ?? null;

  return (
    <header className="bg-app-surface border-app-bord sticky top-0 z-50 flex min-h-[58px] flex-wrap items-center gap-5 border-b px-5 py-2">
      <Marque accueil={accueil} />
      <nav
        aria-label={t("nav.libelle")}
        className="ml-2 flex min-w-0 flex-wrap gap-0.5"
      >
        {entrees.map((entree) => (
          <Entree
            key={entree.cle}
            entree={entree}
            allumee={entree.cle === actif}
          />
        ))}
      </nav>
      {/*
        `shrink-0` ET `min-w-0` SUR LE MÊME GROUPE, et ce n'est pas une
        redondance. `min-w-0` est posé sur la NAVIGATION qui précède : par
        défaut, un enfant de flex ne rétrécit pas sous la largeur de son
        contenu — c'est `min-width: auto` —, si bien que onze entrées de menu
        POUSSENT ce groupe hors de la barre. `shrink-0` dit que ce groupe, lui,
        ne cède jamais : *une pastille de société coupée en deux se lit comme
        une panne d'affichage, pas comme un manque de place.*
      */}
      <div className="ml-auto flex shrink-0 items-center gap-3">
        <BandeauSociete theme={theme} />
        {initiales === null ? null : <Avatar initiales={initiales} />}
      </div>
    </header>
  );
}

/**
 * La marque — triangle rouge, « CODI » noir, « PLAN » bleu.
 *
 * Les deux moitiés du nom sont au dictionnaire plutôt qu'écrites ici : ce sont
 * des chaînes qu'un humain lit (CLAUDE.md §5), et les couper dans le composant
 * aurait été écrire du texte dans une balise. Le triangle est une forme, pas un
 * texte : il est caché aux lecteurs d'écran, qui lisent le nom juste à côté.
 */
function Marque({ accueil }: { readonly accueil: string }) {
  return (
    <Link href={accueil} className="flex flex-shrink-0 items-center gap-2.5">
      <span
        aria-hidden
        className="border-b-app-accent h-0 w-0 border-r-[11px] border-b-[19px] border-l-[11px] border-r-transparent border-l-transparent"
      />
      <span className="leading-tight">
        <span className="text-[18px] font-extrabold tracking-tight">
          {t("nav.marque_debut")}
          <span className="text-app-marque">{t("nav.marque_fin")}</span>
        </span>
        <span className="text-app-encre-faible block text-[9px] font-bold tracking-[1.5px]">
          {t("nav.marque_metier")}
        </span>
      </span>
    </Link>
  );
}

const CLASSES_ENTREE =
  "rounded-md px-2.5 py-1.5 text-[12.5px] font-semibold whitespace-nowrap";

function Entree({
  entree,
  allumee,
}: {
  readonly entree: EntreeNavigation;
  readonly allumee: boolean;
}) {
  if (entree.chemin === null) {
    // INERTE, et elle le dit de deux façons : elle n'est pas cliquable, et son
    // titre nomme ce qui manque. Un lien vers un écran absent se lirait comme
    // une panne ; une entrée absente laisserait croire que le produit s'arrête
    // là.
    return (
      <span
        aria-disabled
        title={t("nav.a_venir")}
        className={`${CLASSES_ENTREE} text-app-encre-faible cursor-default opacity-45`}
      >
        {t(entree.cle)}
      </span>
    );
  }
  return (
    <Link
      href={entree.chemin}
      aria-current={allumee ? "page" : undefined}
      className={
        allumee
          ? `${CLASSES_ENTREE} bg-app-marque text-app-marque-encre`
          : `${CLASSES_ENTREE} text-app-encre-faible hover:bg-app-fond`
      }
    >
      {t(entree.cle)}
    </Link>
  );
}

function Avatar({ initiales }: { readonly initiales: string }) {
  return (
    <span
      aria-hidden
      className="bg-app-marque text-app-marque-encre grid h-8 w-8 place-items-center rounded-full text-xs font-bold"
    >
      {initiales}
    </span>
  );
}
