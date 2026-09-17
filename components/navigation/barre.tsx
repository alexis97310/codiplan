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
   * LES ENTRÉES À RENDRE — celles du back-office, du portail ou du terrain
   * (D97). Obligatoire, sans valeur par défaut : un défaut ferait qu'une mise
   * en page qui oublie de choisir reçoit une barre en silence.
   */
  readonly entrees: readonly EntreeDeBarre[];
  /**
   * Où mène la marque. Elle n'est pas décorative : c'est le point de retour,
   * et il diffère par segment.
   */
  readonly accueil: string;
}) {
  const actif = entreeActive(usePathname() ?? "", entrees)?.cle ?? null;

  return (
    <aside className="bg-app-chrome-fond flex h-full w-[272px] shrink-0 flex-col overflow-y-auto px-3 py-5">
      <Marque accueil={accueil} />
      <nav aria-label={t("nav.libelle")} className="mt-2 flex flex-col">
        {entrees.map((entree) =>
          estGroupe(entree) ? (
            <Domaine key={entree.cle} entree={entree} cleActive={actif} />
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
        `mt-auto` ancre le pied en bas de la colonne, quelle que soit la
        hauteur de la liste au-dessus — vide pour le terrain (R5-01), une
        seule entrée pour le portail (D97), quatorze pour le back-office.
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
  );
}

/**
 * La marque — triangle rouge, « CODI » noir, « PLAN » bleu, sur le fond marine
 * du chrome (D122).
 */
function Marque({ accueil }: { readonly accueil: string }) {
  return (
    <Link href={accueil} className="flex items-center gap-2.5 px-1 pb-4">
      <span
        aria-hidden
        className="border-b-app-accent h-0 w-0 border-r-[11px] border-b-[19px] border-l-[11px] border-r-transparent border-l-transparent"
      />
      <span className="leading-tight">
        <span className="text-app-chrome-actif-encre text-[18px] font-extrabold tracking-tight">
          {t("nav.marque_debut")}
          <span className="text-app-chrome-lien">{t("nav.marque_fin")}</span>
        </span>
        <span className="text-app-chrome-encre-faible block text-[9px] font-bold tracking-[1.5px]">
          {t("nav.marque_metier")}
        </span>
      </span>
    </Link>
  );
}

const CLASSES_TITRE_DOMAINE =
  "text-app-chrome-encre-faible mt-3 mb-1 px-2 text-[11px] font-extrabold tracking-[0.08em] uppercase first:mt-0";

const CLASSES_ENTREE =
  "block w-full rounded-md px-2.5 py-2 text-left text-[13px] font-semibold";

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
}: {
  readonly entree: GroupeNavigation;
  readonly cleActive: string | null;
}) {
  return (
    <div>
      <div className={CLASSES_TITRE_DOMAINE}>{t(entree.cle)}</div>
      {entree.enfants.map((enfant) => (
        <Entree
          key={enfant.cle}
          entree={enfant}
          allumee={enfant.cle === cleActive}
        />
      ))}
    </div>
  );
}

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
        className={`${CLASSES_ENTREE} text-app-chrome-encre-faible cursor-default opacity-60`}
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
          ? `${CLASSES_ENTREE} bg-app-chrome-actif text-app-chrome-actif-encre`
          : `${CLASSES_ENTREE} text-app-chrome-lien hover:bg-app-chrome-survol hover:text-app-chrome-actif-encre`
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
 * fortuite d'un robot. La route, `/api/session/deconnexion`, est en POST, et
 * ce formulaire le reste.
 */
function Deconnexion() {
  return (
    <form action="/api/session/deconnexion" method="post">
      <button
        type="submit"
        className="text-app-chrome-encre-faible hover:bg-app-chrome-survol hover:text-app-chrome-actif-encre rounded-md px-2 py-1.5 text-[12px] font-semibold whitespace-nowrap"
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
