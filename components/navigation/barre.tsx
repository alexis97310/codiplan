"use client";

import { useEffect, useState } from "react";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { useNavigationMobile } from "@/components/navigation/bandeau-mobile";
import { MarqueClaire } from "@/components/navigation/marque";
import { BandeauSociete } from "@/components/theme/bandeau-societe";
import { CLASSES_TON } from "@/components/ui/badge";
import { Icone, type NomIcone } from "@/components/ui/icone";
import type { Role } from "@/lib/auth/roles";
import { t, type CleTraduction } from "@/lib/i18n/fr";
import {
  entreeActive,
  entreesAffichables,
  estGroupe,
  type EntreeDeBarre,
  type EntreeNavigation,
  type GroupeNavigation,
} from "@/lib/navigation/entrees";
import type { DecompteMenu, DecomptesMenu } from "@/lib/navigation/decomptes";
import type { ThemeSociete } from "@/lib/theme/theme";
import { cn } from "@/lib/utils";

/**
 * LA BARRE DE NAVIGATION — devenue une COLONNE LATÉRALE FIXE (D121).
 *
 * *Mesuré le 11/09/2026, avant toute barre : l'application ne portait AUCUNE
 * navigation, on n'y circulait qu'en tapant une URL.* Elle est ensuite née
 * horizontale, sur la foi de `CODIPLAN_Maquette.html` (D95), puis à deux
 * niveaux commutables (D118). **D121 mesure qu'une maquette redessinée AVEC UN
 * MENU redonne la main à la maquette sur sa FORME**, et cette forme est une
 * colonne verticale fixe : trois titres de domaine — texte, jamais un
 * contrôle —, quatorze destinations TOUTES visibles en permanence. Plus de
 * `<details>`, plus de sous-menu qui s'ouvre au clic : ce fichier n'a donc
 * plus qu'UN NIVEAU de composant à rendre, `Entree`, appelé soit à plat, soit
 * sous un titre de domaine.
 *
 * ## CE QUE CE CHANGEMENT DE FORME RÉPARE, SANS L'AVOIR CHERCHÉ
 *
 * `tests/e2e/imports.spec.ts` échouait par intermittence — 9 lectures de
 * l'URL en 5 s, toujours immobile sur `/planning`. **Mesuré, pas supposé**
 * (page.on("request")) : l'ancien `EntreeDeMenu` fermait son `<details>`
 * ancêtre DANS son `onClick`, donc AVANT la navigation de `next/link` — Next
 * compose l'`onClick` reçu en premier, sa propre logique de clic ensuite
 * (`node_modules/next/dist/client/app-dir/link.js`). Fermer le menu masquait
 * le lien qu'on venait de cliquer PENDANT que sa navigation était encore en
 * vol, et le suivi de visibilité du lien (le même mécanisme qui annule un
 * pré-chargement hors écran) ANNULAIT la requête RSC qui devait faire aboutir
 * le clic — deux requêtes 200 ont été observées, toutes deux annulées avant
 * que l'URL ne change, sans la moindre erreur serveur ni page d'erreur : la
 * piste d'une frontière `error.tsx` qui avalerait la navigation est donc
 * réfutée par la même mesure. Le remède n'est pas un correctif ponctuel : il
 * n'y a plus de menu à refermer, donc plus rien à masquer sous le clic.
 *
 * ## Ce que ce composant ne SAIT toujours PAS (D97, inchangé)
 *
 * Il ne choisit pas ses propres entrées — le back-office, le portail et le
 * terrain passent chacun la leur — et il n'est jamais un contrôle d'accès :
 * une entrée inerte reste rendue, visiblement éteinte, jamais masquée.
 *
 * **Aucune couleur n'est écrite ici.** Les classes nomment des jetons —
 * `bg-app-chrome-fond`, `text-app-chrome-lien`, `bg-app-chrome-actif` — et le
 * chrome de navigation est une TROISIÈME zone de couleur, distincte de la
 * charte d'une société et des couleurs de statut (D122) : voir
 * `app/globals.css` pour leur déclaration et leur mesure.
 *
 * ## POURQUOI ELLE RESTE UN COMPOSANT CLIENT
 *
 * Une mise en page ne connaît pas le chemin courant de façon garantie ; il se
 * lit par `usePathname`. Le thème et les initiales, eux, sont calculés côté
 * serveur et passés en propriété.
 *
 * ## LA DÉCONNEXION VIT ICI, JAMAIS DANS LA LISTE D'ENTRÉES (N-02)
 *
 * Ce n'est pas une DESTINATION, c'est une COMMANDE : on ne « va » pas à une
 * déconnexion, on l'ACTIONNE. Elle vit dans le pied de la colonne, au même
 * titre que la charte de société et la pastille d'initiales, pour la même
 * raison : commune aux trois coques, elle n'a pas à être rendue par un écran
 * qui pourrait oublier de le faire.
 *
 * ## LE TERRAIN N'EST PAS UNE COLONNE — CE N'EST PAS UNE EXCEPTION À D121, ET
 * C'EST ÉCRIT POUR NE PAS LE REDÉCOUVRIR (17/09/2026, revue de #224)
 *
 * D121 arbitre la forme d'une barre QUI PORTE DES DESTINATIONS — la colonne,
 * ses trois domaines, sont une réponse à quatorze boutons qu'il fallait
 * ranger. `ENTREES_TERRAIN` est vide (R5-01) : il n'y a AUCUNE destination à
 * ranger sur le terrain, donc la question que D121 tranche ne se pose pas
 * pour cette coque. Une colonne de 272 px qui ne porterait qu'une marque et un
 * bouton de déconnexion serait une forme SANS SUJET — et sur un écran de
 * 390 px, mesuré sur `main` avant ce correctif : **390 − 272 = 118 px**
 * restants pour tout le reste (`tests/e2e/terrain-largeur.spec.ts`).
 *
 * **Le terrain reprend donc son chrome D'AVANT D121** : un bandeau horizontal
 * fin, comme toutes les coques avant cette décision. Ce n'est pas un repli
 * temporaire en attendant un futur ticket — c'est la forme qui convient à une
 * liste vide, et elle le restera tant qu'aucune destination n'existe à
 * ranger. Le jour où le terrain porte une navigation réelle, la question de
 * D121 se posera pour lui aussi, et alors seulement.
 */

/** La préférence de rail est gardée SUR L'APPAREIL (QE-4, D171) — jamais côté serveur. */
const CLE_PREFERENCE_COLONNE = "codiplan.colonne.repliee";

/**
 * LA COLONNE EN RAIL, ENTRE 900 ET 1199 PX (QE-4, 9DU-TP-NAV3-RECHERCHE-RAIL,
 * D171) — 76 px, icônes et infobulles, jamais de texte. Au-delà de 1199 px
 * elle revient déployée PAR DÉFAUT (COQUE-375 l'éprouve déjà à 1280 px, sans
 * préférence posée) ; en-dessous de 901 px, cette logique ne s'applique
 * jamais — c'est le tiroir (`useNavigationMobile`) qui gouverne seul.
 *
 * **Une préférence explicite (le bouton « Réduire »/« Déplier ») l'emporte
 * sur la bande, à N'IMPORTE QUELLE largeur de bureau** — « gardée sur
 * l'appareil » veut dire gardée, pas seulement pour la bande où elle a été
 * choisie.
 *
 * `localStorage` est protégé par `try/catch` (QE-4) : une lecture ou une
 * écriture impossible (navigation privée, quota) rend simplement la colonne
 * sans mémoire d'une session à l'autre — jamais une page qui refuse de se
 * rendre.
 */
function useColonneRepliable(): {
  readonly repliee: boolean;
  readonly basculer: () => void;
} {
  const [largeur, setLargeur] = useState(0);
  const [preference, setPreference] = useState<boolean | null>(null);

  useEffect(() => {
    function surRedimensionnement(): void {
      setLargeur(window.innerWidth);
    }
    surRedimensionnement();
    window.addEventListener("resize", surRedimensionnement);
    return () => window.removeEventListener("resize", surRedimensionnement);
  }, []);

  useEffect(() => {
    try {
      const valeur = window.localStorage.getItem(CLE_PREFERENCE_COLONNE);
      if (valeur === "1") {
        setPreference(true);
      } else if (valeur === "0") {
        setPreference(false);
      }
    } catch {
      // Ignoré — voir l'entête : la colonne se rend sans préférence retenue.
    }
  }, []);

  const estBureau = largeur >= 901;
  const dansLaBandeDuRail = largeur >= 901 && largeur <= 1199;
  const repliee = estBureau && (preference ?? dansLaBandeDuRail);

  function basculer(): void {
    const nouvelle = !repliee;
    setPreference(nouvelle);
    try {
      window.localStorage.setItem(CLE_PREFERENCE_COLONNE, nouvelle ? "1" : "0");
    } catch {
      // Ignoré — même contrat que la lecture ci-dessus.
    }
  }

  return { repliee, basculer };
}

export function BarreDeNavigation({
  theme,
  initiales,
  entrees,
  role,
  accueil,
  decomptes = null,
}: {
  readonly theme: ThemeSociete;
  /** Les initiales de la personne connectée, ou `null` si personne ne l'est. */
  readonly initiales: string | null;
  /**
   * LES ENTRÉES À RENDRE — celles du back-office, du portail ou du terrain
   * (D97). Obligatoire, sans valeur par défaut : un défaut ferait qu'une mise
   * en page qui oublie de choisir reçoit une barre en silence.
   *
   * **Une liste VIDE choisit la forme** (voir le commentaire ci-dessus) : rien
   * à ranger, donc pas de colonne à son intention.
   */
  readonly entrees: readonly EntreeDeBarre[];
  /**
   * LE RÔLE DE LA PERSONNE CONNECTÉE — D132 (23/09/2026, VISUEL-1), passé par
   * `chromeDeLaRequete`. `entreesAffichables` (`lib/navigation/entrees.ts`)
   * en tire ce qui reste : les entrées inertes tombent toujours, les entrées
   * dont ce rôle n'a pas la capacité tombent quand `role` est fourni.
   *
   * **Optionnel, et c'est délibéré** : un appelant qui ne le passe pas
   * (aujourd'hui, le portail et le terrain, dont les listes ne portent ni
   * entrée inerte ni entrée hors de portée de leur seul rôle) garde le
   * comportement d'avant D132 — seul le filtre des entrées inertes reste
   * actif, inconditionnellement.
   */
  readonly role?: Role | null;
  /**
   * Où mène la marque. Elle n'est pas décorative : c'est le point de retour,
   * et il diffère par segment.
   */
  readonly accueil: string;
  /**
   * LES DÉCOMPTES DU MENU (QE-5, 9DU-TP-NAV3-RECHERCHE-RAIL, D171) — `null`
   * par défaut : le portail et le terrain, qui ne passent pas cette
   * propriété, n'affichent aucun badge, exactement comme avant ce ticket.
   */
  readonly decomptes?: DecomptesMenu | null;
}) {
  const entreesVisibles = entreesAffichables(entrees, role);
  const actif = entreeActive(usePathname() ?? "", entreesVisibles)?.cle ?? null;
  const { ouvert, fermer } = useNavigationMobile();
  const { repliee, basculer } = useColonneRepliable();
  // « PLEIN ÉCRAN » DU PLANNING REPLIE AUSSI CETTE COLONNE (9BJA-REPRISE-9BJ,
  // point 4a — le ticket 9BJ ne repliait que la colonne « À planifier »,
  // territoire de `app/(back-office)/planning/page.tsx` seul, et avait écrit
  // dans sa passation que la barre PARTAGÉE en restait hors territoire).
  // Lu ICI, par ce SEUL composant, via `useSearchParams` — jamais passé par
  // `app/(back-office)/layout.tsx` : un layout ne reçoit pas les paramètres
  // de recherche de la page qu'il enrobe (ils rendraient tout le segment
  // dynamique), et le gardien `tests/unit/app/barre-par-segment.test.ts` exige
  // que ce fichier appelle `<BarreDeNavigation entrees={ENTREES} …/>` sans
  // rien y ajouter. Le paramètre n'existe que sur `/planning` ; ailleurs,
  // `get("pleinEcran")` rend `null`, et la colonne se comporte comme avant.
  const pleinEcranDuPlanning = useSearchParams().get("pleinEcran") === "1";

  if (pleinEcranDuPlanning) {
    return null;
  }

  if (entreesVisibles.length === 0) {
    return (
      <BarreHorizontaleVide
        theme={theme}
        initiales={initiales}
        accueil={accueil}
      />
    );
  }

  return (
    <>
      {/*
        LE VOILE (COQUE-375) — sous 901 px seulement, et seulement quand le
        tiroir est ouvert : un clic dessus le referme, comme sur n'importe
        quel tiroir. `min-[901px]:hidden` est une garde défensive contre un
        redimensionnement qui laisserait `ouvert` vrai en franchissant le
        seuil sans navigation entre-temps — l'override desktop de l'aside,
        ci-dessous, ignore de toute façon cet état.
      */}
      {ouvert ? (
        <div
          aria-hidden
          data-bloc="voile-navigation"
          onClick={fermer}
          // `bg-app-chrome-fond/60` — AUCUNE COULEUR NOUVELLE (§9) : le même
          // jeton que le fond de la colonne elle-même, jamais un `black`
          // littéral que `tests/unit/theme/sans-couleur-en-dur.test.ts`
          // refuserait (L0-09 — la charte est une donnée de la société).
          className="bg-app-chrome-fond/60 fixed inset-0 z-30 min-[901px]:hidden"
        />
      ) : null}
      {/*
        `h-dvh`, PAS `h-full` (N-08, 18/09/2026) — mesuré sur les captures de
        N-08 : la colonne s'arrêtait à 747 px dans une fenêtre de 900,
        laissant 153 px de fond de page sous elle, sur un écran à contenu
        COURT (un écran long masquait le défaut). `h-full` résout un
        pourcentage contre le parent flex, dont la hauteur n'a qu'un PLANCHER
        (`min-h-dvh`, jamais `height`) — un pourcentage contre une hauteur
        `auto` ne résout à rien, et `height:100%` désactive au passage le
        `align-items:stretch` du parent qui aurait sinon suffi. `h-dvh` fixe
        une hauteur absolue, indépendante du parent.

        `sticky top-0`, DÈS 901 PX SEULEMENT (COQUE-375, 21/09/2026) — reprend
        `.sidebar{position:sticky;top:0;height:100vh}` de
        `docs/maquette/codiplan-maquette-complete.html`, la même source que
        D121 pour la FORME de cette colonne, et le même geste que le
        `<header>` du terrain applique déjà pour lui-même. **En dessous de ce
        seuil — celui déjà éprouvé par `components/ui/maitre-detail.tsx`,
        jamais un second inventé —, la colonne SORT DE L'ÉCRAN** : mesuré au
        navigateur sur le site en ligne à 375 px, elle y occupait 272 px sur
        une fenêtre de 375, ne laissant que 63 px de contenu utile. `hidden`
        la retire du flux (rien à réserver dans la ligne flexible du
        segment) ; `ouvert` la ramène en recouvrement (`fixed`, `z-40`,
        au-dessus du voile ci-dessus) plutôt qu'en colonne, exactement l'état
        que `BandeauMobile` déclenche.
      */}
      <aside
        id="colonne-navigation"
        data-chrome
        className={cn(
          "bg-app-chrome-fond h-dvh shrink-0 flex-col overflow-y-auto px-3 py-5 min-[901px]:sticky min-[901px]:top-0 min-[901px]:left-auto min-[901px]:flex",
          repliee
            ? "w-[272px] min-[901px]:w-[76px] min-[901px]:px-2"
            : "w-[272px]",
          ouvert ? "fixed top-0 left-0 z-40 flex" : "hidden",
        )}
      >
        <Marque accueil={accueil} repliee={repliee} />
        {/*
          LE RAIL (QE-4, D171) — le bouton n'existe qu'à partir de 901 px :
          sous ce seuil, c'est le tiroir (`BandeauMobile`) qui ouvre et
          referme la colonne, jamais ce bouton.
        */}
        <button
          type="button"
          onClick={basculer}
          title={t(repliee ? "nav.deplier_le_menu" : "nav.reduire_le_menu")}
          className="text-app-chrome-lien hover:bg-app-chrome-survol hover:text-app-chrome-actif-encre hidden h-9 w-9 shrink-0 items-center justify-center self-end rounded-md min-[901px]:flex"
        >
          <Icone nom="sidebar" taille={16} />
          <span className="sr-only">
            {t(repliee ? "nav.deplier_le_menu" : "nav.reduire_le_menu")}
          </span>
        </button>
        <nav aria-label={t("nav.libelle")} className="mt-2 flex flex-col">
          {entreesVisibles.map((entree) =>
            estGroupe(entree) ? (
              <Domaine
                key={entree.cle}
                entree={entree}
                cleActive={actif}
                repliee={repliee}
                decomptes={decomptes}
              />
            ) : (
              <Entree
                key={entree.cle}
                entree={entree}
                allumee={entree.cle === actif}
                repliee={repliee}
                decompte={decompteDeLEntree(entree, decomptes)}
              />
            ),
          )}
        </nav>
        {/*
        `mt-auto` ancre le pied en bas de la colonne, quelle que soit la
        hauteur de la liste au-dessus — une seule entrée pour le portail
        (D97), quatorze pour le back-office. Le terrain, lui, ne passe plus
        jamais par ici : `entrees` y est toujours vide (R5-01).
      */}
        <div className="border-app-chrome-bordure mt-auto flex flex-col gap-3 border-t pt-4">
          <BandeauSociete theme={theme} />
          {initiales === null ? null : (
            <div className="flex items-center justify-between gap-2">
              <Deconnexion />
              <Avatar initiales={initiales} />
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

/**
 * La marque — triangle rouge, « CODI » noir, « PLAN » bleu, sur le fond marine
 * du chrome (D122).
 *
 * **En rail (QE-4, D171), seul le triangle reste visible** — le nom complet
 * n'a pas sa place dans 76 px ; `sr-only` le garde pour un lecteur d'écran.
 * Pas d'infobulle ici (contrairement à `Entree` ci-dessous) : une
 * concaténation de deux clés (« CODI » + « PLAN ») pour un `title` est la
 * forme « chaîne concaténée » que `sans-chaine-visible-en-dur.test.ts`
 * refuse — la marque mène déjà vers l'accueil, et son texte reste lisible
 * au clavier et au lecteur d'écran sans infobulle.
 */
function Marque({
  accueil,
  repliee = false,
}: {
  readonly accueil: string;
  readonly repliee?: boolean;
}) {
  return (
    <Link href={accueil} className="flex items-center gap-2.5 px-1 pb-4">
      <span
        aria-hidden
        className="border-b-app-accent h-0 w-0 shrink-0 border-r-[11px] border-b-[19px] border-l-[11px] border-r-transparent border-l-transparent"
      />
      <span className={cn("leading-tight", repliee ? "sr-only" : "")}>
        <span className="text-app-chrome-actif-encre text-[18px] font-extrabold tracking-tight">
          {t("nav.marque_debut")}
          <span className="text-app-chrome-lien">{t("nav.marque_fin")}</span>
        </span>
        <span className="text-app-chrome-encre-faible block text-12 font-bold tracking-[1.5px]">
          {t("nav.marque_metier")}
        </span>
      </span>
    </Link>
  );
}

/**
 * LE BANDEAU HORIZONTAL DU TERRAIN — le chrome D'AVANT D121, jamais retiré
 * pour cette coque puisque D121 ne la concerne pas (voir le commentaire de
 * `BarreDeNavigation`).
 *
 * **Un `<nav>` vide plutôt qu'absent** : `deconnexion-chrome.test.tsx`
 * confronte les trois coques au même critère — un `<nav>` sans aucun `<form>`
 * — et une liste vide rend un `<nav>` sans enfant, pas un `<nav>` en moins.
 *
 * **Jetons clairs, jamais ceux du chrome vertical** : cette coque ne porte
 * aucune des couleurs de D122 (elles habillaient une colonne qui n'existe pas
 * ici) — elle reprend `app-surface`, `app-marque`, exactement ce qu'elle
 * portait avant ce ticket.
 */
function BarreHorizontaleVide({
  theme,
  initiales,
  accueil,
}: {
  readonly theme: ThemeSociete;
  readonly initiales: string | null;
  readonly accueil: string;
}) {
  return (
    <header className="bg-app-surface border-app-bord sticky top-0 z-50 flex min-h-[58px] flex-wrap items-center gap-5 border-b px-5 py-2">
      <MarqueClaire accueil={accueil} />
      <nav aria-label={t("nav.libelle")} className="ml-2 min-w-0 flex-1"></nav>
      <div className="ml-auto flex shrink-0 items-center gap-3">
        <BandeauSociete theme={theme} />
        {initiales === null ? null : (
          <>
            <DeconnexionClaire />
            <AvatarClaire initiales={initiales} />
          </>
        )}
      </div>
    </header>
  );
}

function DeconnexionClaire() {
  return (
    <form action="/api/session/deconnexion" method="post">
      <button
        type="submit"
        className="text-app-encre-faible hover:bg-app-fond rounded-md px-2.5 py-1.5 text-13 font-bold whitespace-nowrap"
      >
        {t("nav.deconnexion")}
      </button>
    </form>
  );
}

function AvatarClaire({ initiales }: { readonly initiales: string }) {
  return (
    <span
      aria-hidden
      className="bg-app-marque text-app-marque-encre grid h-8 w-8 place-items-center rounded-full text-xs font-bold"
    >
      {initiales}
    </span>
  );
}

const CLASSES_TITRE_DOMAINE =
  "text-app-chrome-encre-faible mb-1 px-2 text-12 font-extrabold tracking-[0.08em] uppercase";

const CLASSES_ENTREE =
  "block w-full rounded-md px-2.5 py-2 text-left text-[13px] font-bold";

/**
 * L'ICÔNE DE CHAQUE DESTINATION (D139, TP-UX1-3, commit « icônes du menu ») —
 * `navModel()` de la maquette du 28/09 (:1918-1933), une entrée par CHEMIN,
 * jamais par `cle` : c'est le chemin qui identifie une destination dans les
 * deux barres qui appellent `Entree` (back-office, portail).
 *
 * **Douze destinations, ni plus ni moins** — celles que `navModel()` dessine.
 * `/portail` n'y figure PAS (:5631) : la maquette du 28/09 ne dessine aucune
 * icône pour cette destination. `lib/navigation/entrees.ts` n'est pas
 * modifié : cette table vit ICI, jamais recopiée là-bas.
 *
 * **`/portail` SERT DEUX ENTRÉES, UN SEUL CHEMIN** (décision d'Alexis du
 * 30/09/2026, point 15 ; D144) — `nav.portail_client` (back-office) et
 * `nav.portail_parc` (portail) partagent `chemin: "/portail"`
 * (`lib/navigation/entrees.ts:328,392`), et une table PAR CHEMIN ne peut leur
 * donner deux icônes différentes. `ICONE_PORTAIL_PAR_CLE` ci-dessous lève
 * l'ambiguïté PAR `cle`, pour ce seul chemin — `globe` (un espace ouvert au
 * client) pour l'entrée du back-office, `machine` (déjà l'icône du parc au
 * bureau, seule entrée de la barre du portail) pour l'entrée du portail.
 */
const ICONE_PAR_CHEMIN: Partial<Record<string, NomIcone>> = {
  "/tableau-de-bord": "home",
  // « Indicateurs du mois » (9DT-TP-MOD2-INDICATEURS-DONNEES, D170) — écart
  // nommé à la maquette (voir `lib/navigation/entrees.ts`), sans icône
  // dessinée par elle pour cette destination : `chart` est tirée de la même
  // planche `ICONS` qu'elle (`components/ui/icone.tsx`).
  "/indicateurs": "chart",
  "/planning": "calendar",
  "/demandes": "inbox",
  "/interventions": "clipboard",
  "/absences": "user-off",
  "/clients": "building",
  "/sites": "pin",
  "/parc": "machine",
  "/vgp": "shield",
  "/parametres": "settings",
  "/imports": "upload",
  "/terrain": "phone",
};

/** Voir le commentaire de `ICONE_PAR_CHEMIN` — l'exception par `cle`, réservée à `/portail`. */
const ICONE_PORTAIL_PAR_CLE: Partial<Record<string, NomIcone>> = {
  "nav.portail_client": "globe",
  "nav.portail_parc": "machine",
};

/**
 * LES DÉCOMPTES DU MENU, PAR CHEMIN (QE-5, D171) — deux destinations
 * seulement, chacune avec la clé i18n qui lit son chiffre à voix haute
 * (`nav.decompte_*_suffixe`, `lib/i18n/fr.ts`). Aucune troisième ligne pour
 * le VGP : voir `lib/navigation/decomptes.ts`.
 */
const SUFFIXE_DECOMPTE_PAR_CHEMIN: Partial<Record<string, CleTraduction>> = {
  "/demandes": "nav.decompte_demandes_suffixe",
  "/interventions": "nav.decompte_interventions_suffixe",
};

function decompteDeLEntree(
  entree: EntreeNavigation,
  decomptes: DecomptesMenu | null | undefined,
): DecompteMenu | undefined {
  if (decomptes === null || decomptes === undefined || entree.chemin === null) {
    return undefined;
  }
  if (entree.chemin === "/demandes") {
    return decomptes.demandes;
  }
  if (entree.chemin === "/interventions") {
    return decomptes.interventions;
  }
  return undefined;
}

/**
 * LA PASTILLE D'UN DÉCOMPTE — rouge si une P1 attend dans SA liste, gris
 * sinon (`CLASSES_TON`, `components/ui/badge.tsx` : aucune couleur neuve).
 * `total === 0` ne rend rien : un zéro à côté de chaque destination serait
 * un bruit constant, la même doctrine que `PucePriorite`
 * (`app/(back-office)/planning/page.tsx`).
 *
 * Le CHIFFRE est `aria-hidden` ; la phrase complète (« 3 demandes à
 * traiter ») vit dans un second nœud `sr-only` — jamais le même texte écrit
 * deux fois pour deux publics qui pourraient diverger (§9, 01/09).
 */
function PastilleDecompte({
  decompte,
  suffixe,
}: {
  readonly decompte: DecompteMenu;
  readonly suffixe: CleTraduction;
}) {
  if (decompte.total === 0) {
    return null;
  }
  return (
    <>
      <span
        aria-hidden="true"
        className={cn(
          "ml-auto shrink-0 rounded-full px-[7px] py-[1px] text-12 font-extrabold tabular-nums",
          decompte.urgent ? CLASSES_TON.rouge : CLASSES_TON.gris,
        )}
      >
        {decompte.total}
      </span>
      <span className="sr-only">
        {t("ponctuation.virgule")}
        {decompte.total}
        {t(suffixe)}
      </span>
    </>
  );
}

/**
 * UN DOMAINE DE LA COLONNE (D121) — un titre de TEXTE, jamais un contrôle,
 * suivi de ses entrées TOUTES visibles.
 *
 * Il n'y a plus rien à ouvrir ni à refermer : `estGroupe` ne sert plus à
 * distinguer un `<details>` d'un lien, seulement à savoir SOUS QUEL TITRE
 * rendre les entrées qui suivent.
 */
function Domaine({
  entree,
  cleActive,
  repliee = false,
  decomptes = null,
}: {
  readonly entree: GroupeNavigation;
  readonly cleActive: string | null;
  readonly repliee?: boolean;
  readonly decomptes?: DecomptesMenu | null;
}) {
  return (
    // `mt-3 first:mt-0` vit sur CETTE enveloppe, pas sur le titre : un titre
    // est TOUJOURS le premier enfant de sa propre enveloppe, donc
    // `first:mt-0` posé sur lui annulait `mt-3` pour chaque domaine, y
    // compris ceux qui suivent un autre (GR17-M3). L'enveloppe, elle, n'est
    // première que pour le tout premier domaine de la colonne.
    <div className="mt-3 first:mt-0">
      <div className={cn(CLASSES_TITRE_DOMAINE, repliee ? "sr-only" : "")}>
        {t(entree.cle)}
      </div>
      {entree.enfants.map((enfant) => (
        <Entree
          key={enfant.cle}
          entree={enfant}
          allumee={enfant.cle === cleActive}
          repliee={repliee}
          decompte={decompteDeLEntree(enfant, decomptes)}
        />
      ))}
    </div>
  );
}

function Entree({
  entree,
  allumee,
  repliee = false,
  decompte,
}: {
  readonly entree: EntreeNavigation;
  readonly allumee: boolean;
  readonly repliee?: boolean;
  readonly decompte?: DecompteMenu;
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
        className={`${CLASSES_ENTREE} text-app-chrome-encre-faible cursor-default opacity-60`}
      >
        {t(entree.cle)}
      </span>
    );
  }
  const icone =
    entree.chemin === "/portail"
      ? ICONE_PORTAIL_PAR_CLE[entree.cle]
      : ICONE_PAR_CHEMIN[entree.chemin];
  const suffixeDecompte = SUFFIXE_DECOMPTE_PAR_CHEMIN[entree.chemin];
  return (
    <Link
      href={entree.chemin}
      aria-current={allumee ? "page" : undefined}
      title={repliee ? t(entree.cle) : undefined}
      className={cn(
        CLASSES_ENTREE,
        "flex items-center gap-[12px]",
        allumee
          ? "bg-app-chrome-actif text-app-chrome-actif-encre"
          : "text-app-chrome-lien hover:bg-app-chrome-survol hover:text-app-chrome-actif-encre",
      )}
    >
      {icone === undefined ? null : <Icone nom={icone} />}
      <span className={cn(repliee ? "sr-only" : "min-w-0 flex-1 truncate")}>
        {t(entree.cle)}
      </span>
      {decompte === undefined || suffixeDecompte === undefined ? null : (
        <PastilleDecompte decompte={decompte} suffixe={suffixeDecompte} />
      )}
    </Link>
  );
}

/**
 * LA DÉCONNEXION — un POST, jamais un lien (N-02).
 *
 * Une déconnexion est une ÉCRITURE : elle périme une session. Un lien la
 * déclencherait au survol d'une préconnexion de navigateur ou à la visite
 * fortuite d'un robot. La route, `/api/session/deconnexion`, est en POST, et
 * ce formulaire le reste.
 */
function Deconnexion() {
  return (
    <form action="/api/session/deconnexion" method="post">
      <button
        type="submit"
        className="text-app-chrome-encre-faible hover:bg-app-chrome-survol hover:text-app-chrome-actif-encre rounded-md px-2 py-1.5 text-[12px] font-bold whitespace-nowrap"
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
      className="bg-app-chrome-actif-encre text-app-chrome-fond grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold"
    >
      {initiales}
    </span>
  );
}
