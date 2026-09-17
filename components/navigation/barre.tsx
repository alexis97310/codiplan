"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { BandeauSociete } from "@/components/theme/bandeau-societe";
import { t } from "@/lib/i18n/fr";
import {
  entreeActive,
  estGroupe,
  type EntreeDeBarre,
  type EntreeNavigation,
  type GroupeNavigation,
} from "@/lib/navigation/entrees";
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
 *
 * ## LA DÉCONNEXION VIT ICI, JAMAIS DANS LA LISTE D'ENTRÉES (N-02, arbitrage du
 * 16/09/2026)
 *
 * *« La route existe, `POST /api/session/deconnexion`. Le seul bouton qui
 * l'appelait était sur `/arrivee`, un écran d'atterrissage sur lequel on ne
 * revient jamais. En pratique, une session ouverte ne se fermait pas. »* — le
 * constat qui a ouvert ce ticket, fait en utilisant le produit.
 *
 * **Ce n'est pas une DESTINATION, c'est une COMMANDE.** La barre est une liste
 * CLOSE de dix destinations (six de premier niveau depuis D118) confrontée à
 * la maquette (D95) : y ajouter une onzième la ferait rougir, à raison, et ce
 * serait de toute façon la mauvaise porte — on ne « va » pas à une
 * déconnexion, on l'ACTIONNE. Elle vit donc dans
 * le CHROME, au même titre que le bandeau de société et la pastille
 * d'initiales, et POUR LA MÊME RAISON : commune aux trois coques, elle n'a pas
 * à être rendue par un écran qui pourrait oublier de le faire.
 *
 * **Et c'est le TERRAIN qui en avait le plus besoin.** `ENTREES_TERRAIN` est
 * vide par décision (R5-01) — « ce qui est vide est la liste, pas le chrome » —
 * et cette même phrase vaut ici : un téléphone d'atelier passe de main en
 * main, et un technicien qui ne peut pas fermer sa session laisse la journée
 * d'un autre ouverte sur son écran.
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
  readonly entrees: readonly EntreeDeBarre[];
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
        {entrees.map((entree) =>
          estGroupe(entree) ? (
            <Groupe key={entree.cle} entree={entree} cleActive={actif} />
          ) : (
            <Entree
              key={entree.cle}
              entree={entree}
              allumee={entree.cle === actif}
            />
          ),
        )}
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
        {/*
          À LA PLACE DE LA PASTILLE RETIRÉE (N-02) : la commande qu'on
          actionne tous les jours prend l'emplacement qu'occupait un
          diagnostic qu'on ne consulte qu'une fois. Rendue seulement s'il y a
          une session à fermer — le même critère qu'`Avatar`, juste en
          dessous : une pastille d'initiales absente et un bouton de
          déconnexion absent disent la même chose, pour la même raison.
        */}
        {initiales === null ? null : <Deconnexion />}
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

/**
 * UN GROUPE DE PREMIER NIVEAU (D118) — un `<details>` natif, jamais un état
 * React.
 *
 * **Pourquoi natif plutôt qu'un `useState` par groupe.** Le clavier, le focus
 * et le rôle accessible d'un `<summary>` sont ceux d'un bouton sans qu'il faille
 * les recomposer à la main — c'est le même calcul que la déconnexion en
 * `<form>` plutôt qu'en gestionnaire de clic : le navigateur fait déjà ce que
 * la commande demande. `name` partagé entre les groupes ferme l'un quand
 * l'autre s'ouvre, nativement, dans les navigateurs qui le lisent — et ne fait
 * rien de plus dans les autres.
 *
 * **Le TITRE n'est jamais un lien** (voir `GroupeNavigation`) : c'est un
 * `<summary>`, qui ouvre le sous-menu et rien d'autre. Il porte quand même le
 * fond « allumé » quand un de ses enfants est la route active, pour la même
 * raison que le préfixe de segment d'`entreeActive` — *c'est là qu'on a le
 * plus besoin de savoir où l'on est*, y compris avant d'avoir ouvert le
 * sous-menu.
 */
function Groupe({
  entree,
  cleActive,
}: {
  readonly entree: GroupeNavigation;
  readonly cleActive: string | null;
}) {
  const active = entree.enfants.some((enfant) => enfant.cle === cleActive);

  return (
    <details name="nav-groupe" className="relative">
      <summary
        className={
          active
            ? `${CLASSES_ENTREE} flex list-none items-center gap-1 bg-app-marque text-app-marque-encre [&::-webkit-details-marker]:hidden`
            : `${CLASSES_ENTREE} text-app-encre-faible hover:bg-app-fond flex list-none items-center gap-1 [&::-webkit-details-marker]:hidden`
        }
      >
        {t(entree.cle)}
        <Chevron actif={active} />
      </summary>
      <div className="bg-app-surface border-app-bord absolute left-0 top-full z-10 mt-1 min-w-[220px] rounded-md border p-1 shadow-lg">
        {entree.enfants.map((enfant) => (
          <EntreeDeMenu
            key={enfant.cle}
            entree={enfant}
            allumee={enfant.cle === cleActive}
          />
        ))}
      </div>
    </details>
  );
}

/** Le chevron d'un groupe — une forme, jamais un caractère (CLAUDE.md §5). */
function Chevron({ actif }: { readonly actif: boolean }) {
  return (
    <span
      aria-hidden
      className={
        actif
          ? "border-t-app-marque-encre h-0 w-0 border-x-[4px] border-t-[5px] border-x-transparent"
          : "border-t-app-encre-faible h-0 w-0 border-x-[4px] border-t-[5px] border-x-transparent"
      }
    />
  );
}

const CLASSES_ENTREE_MENU =
  "block rounded-md px-3 py-2 text-[12.5px] font-semibold whitespace-nowrap";

/** Une entrée à l'intérieur du sous-menu d'un groupe — même règles qu'`Entree`. */
function EntreeDeMenu({
  entree,
  allumee,
}: {
  readonly entree: EntreeNavigation;
  readonly allumee: boolean;
}) {
  if (entree.chemin === null) {
    return (
      <span
        aria-disabled
        title={t("nav.a_venir")}
        className={`${CLASSES_ENTREE_MENU} text-app-encre-faible cursor-default opacity-45`}
      >
        {t(entree.cle)}
      </span>
    );
  }
  return (
    <Link
      href={entree.chemin}
      aria-current={allumee ? "page" : undefined}
      // Referme le sous-menu au choix : un menu qui reste ouvert après la
      // navigation fait douter qu'on ait vraiment choisi.
      onClick={(evenement) =>
        evenement.currentTarget.closest("details")?.removeAttribute("open")
      }
      className={
        allumee
          ? `${CLASSES_ENTREE_MENU} bg-app-marque text-app-marque-encre`
          : `${CLASSES_ENTREE_MENU} text-app-encre hover:bg-app-fond`
      }
    >
      {t(entree.cle)}
    </Link>
  );
}

/**
 * LA DÉCONNEXION — un POST, jamais un lien (N-02).
 *
 * Une déconnexion est une ÉCRITURE : elle périme une session. Un lien la
 * déclencherait au survol d'une préconnexion de navigateur ou à la visite
 * fortuite d'un robot — un défaut d'un genre pénible à diagnostiquer, qui se
 * lit comme une panne de session plutôt que comme ce qu'il est. La route,
 * `/api/session/deconnexion`, est en POST, et ce formulaire le reste.
 */
function Deconnexion() {
  return (
    <form action="/api/session/deconnexion" method="post">
      <button
        type="submit"
        className="text-app-encre-faible hover:bg-app-fond rounded-md px-2.5 py-1.5 text-[12.5px] font-semibold whitespace-nowrap"
      >
        {t("nav.deconnexion")}
      </button>
    </form>
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
