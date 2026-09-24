import { CLASSES_TON, type TonBadge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * LA CARTE D'ENTITÉ — `.entity-card` de `codiplan-maquette-complete.html`
 * (D123, N-08) : les référentiels se montrent en cartes, pas en tableaux.
 *
 * ## POURQUOI CE FICHIER, ET POURQUOI PAS `Carte`
 *
 * `components/ui/carte.tsx` est `.card` — un conteneur générique à un seul
 * titre `<h2>` et un lien `.more`. `.entity-card` est une pièce SÉPARÉE de la
 * maquette, mesurée à part : un titre `<h3>` avec un badge d'état à côté, des
 * lignes de texte muettes, puis une bande de compteurs séparée par un filet.
 * *Un `<h2>` et un `<h3>` ne portent pas le même sens de page* — confondre les
 * deux pièces sous un seul composant aurait forcé l'une des deux formes à
 * céder.
 *
 * ## LES VALEURS, LUES SUR `docs/maquette/codiplan-maquette-complete.html`
 *
 * `.entity-card{padding:17px}` ; `.entity-card h3{margin:0 0 4px;
 * font-size:15px}` ; `.entity-card p{margin:3px 0;color:var(--muted);
 * font-size:12px}` ; `.entity-meta{display:flex;gap:13px;margin-top:14px;
 * padding-top:13px;border-top:1px solid var(--line-2)}` ; `.entity-meta
 * b{display:block}` ; `.entity-meta span{font-size:11px;color:var(--muted)}`.
 * Un gardien confronte ces règles au texte de ce fichier
 * (`tests/unit/ui/carte-entite.test.ts`).
 *
 * **La bordure de la carte et son rayon sont ceux de `codiplan-maquette-
 * complete.html`, depuis D124 — et ce n'est plus un écart avec `Carte`.**
 * `D122`/`D123` posaient « deux fichiers, deux questions » : cette seconde
 * maquette faisait foi sur la FORME, jamais sur la valeur exacte d'un jeton de
 * couleur, si bien que la bordure et le rayon d'`.entity-card` (`border:1px
 * solid var(--line)` = `#dce2ea`, `border-radius:var(--radius)` = `14px`)
 * restaient ceux, DIFFÉRENTS, de `CODIPLAN_Maquette.html` (`#E1E4E8`, `10px`).
 * **D124 fait tomber cette séparation pour les jetons de couleur, le rayon et
 * la typographie** : `--app-bord` et `--radius` valent désormais `#dce2ea` et
 * `14px` dans `app/globals.css`, la valeur même que cette maquette mesure.
 * Cette carte reprend donc `border-app-bord` et `rounded-lg` parce que ce sont
 * maintenant EXACTEMENT ces jetons, pas une coïncidence de nom sur deux
 * valeurs différentes — et toujours les mêmes que `Carte`
 * (`components/ui/carte.tsx`), jamais une seconde bordure.
 *
 * ## CE QU'ELLE NE FAIT PAS
 *
 * **Elle ne rend pas la carte entière cliquable.** La maquette ne le fait pas
 * non plus — `clients()` et `sites()` posent l'`<article class="entity-card">`
 * SANS `data-route`, contrairement à `machineRow` qui en porte un. Le lien
 * vers la fiche vit sur le TITRE, comme il vivait déjà sur la cellule forte
 * d'une ligne de `Tableau` : *le geste change, le comportement reste.*
 *
 * **Elle ne compte rien elle-même.** `compteurs` est fourni tout composé par
 * l'appelant — cette carte ne lit aucune base, elle assemble ce qu'on lui
 * donne, comme `Kpi` le fait déjà pour un chiffre du tableau de bord.
 */
export function CarteEntite({
  titre,
  badge,
  lignes,
  compteurs,
  className,
}: Readonly<{
  /** Le titre — un `<h3>`, jamais un `<h2>` de `Carte`. Porte déjà son lien. */
  titre: React.ReactNode;
  /** Le badge d'état, à côté du titre. Absent quand l'entité n'en connaît pas (les sites). */
  badge?: React.ReactNode;
  /** Les lignes muettes de la carte — `.entity-card p`, dans l'ordre donné. */
  lignes: readonly React.ReactNode[];
  /**
   * La bande de compteurs — `.entity-meta`. Vide : aucune bande n'est rendue.
   *
   * `ton` est FACULTATIF (PASTILLES-1) : présent, le compteur se rend en
   * pastille colorée (fond et encre de `Badge`, `components/ui/badge.tsx`) ;
   * absent, il garde le rendu `.entity-meta b`/`span` d'avant, à l'identique.
   * Le ton se DÉCIDE à l'appelant (`compteurSites`, `compteurEquipements`,
   * `trajetAffiche`, …), jamais choisi ici — la même règle que `Badge`
   * applique déjà à un ton de statut.
   *
   * `id` est FACULTATIF (CONTRAT-SITE-1-REPRISE-3) : posé, il se rend en
   * `data-compteur` sur le conteneur — une prise stable pour un scénario de
   * bout en bout qui vise UN compteur précis, plutôt que de compter tous les
   * `<b>` de la carte, faux dès qu'une pastille facultative (habilitations,
   * contrat) s'ajoute ou s'omet selon la fiche.
   */
  compteurs: readonly {
    readonly valeur: React.ReactNode;
    readonly libelle: string;
    readonly ton?: TonBadge;
    readonly id?: string;
  }[];
  className?: string;
}>) {
  return (
    <article
      className={cn(
        "bg-app-surface border-app-bord rounded-lg border p-[17px]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="m-0 mb-[4px] text-[15px] font-bold">{titre}</h3>
        {badge}
      </div>
      {lignes.map((ligne, index) => (
        // L'INDEX COMME CLÉ : `lignes` est un tableau de lecture, jamais
        // réordonné ni filtré après coup — la même garantie que
        // `LignePleine` accepte déjà pour son propre contenu statique.
        <p key={index} className="text-app-encre-faible my-[3px] text-[12px]">
          {ligne}
        </p>
      ))}
      {compteurs.length === 0 ? null : (
        <div className="border-app-bord mt-[14px] flex flex-wrap justify-center gap-[13px] border-t pt-[13px]">
          {compteurs.map((compteur, index) =>
            compteur.ton === undefined ? (
              <div key={index} data-compteur={compteur.id}>
                <b className="block font-bold">{compteur.valeur}</b>
                <span className="text-app-encre-faible text-[11px]">
                  {compteur.libelle}
                </span>
              </div>
            ) : (
              <div
                key={index}
                data-compteur={compteur.id}
                className={cn(
                  "inline-flex items-center gap-[6px] rounded-full px-[12px] py-[4px]",
                  CLASSES_TON[compteur.ton],
                )}
              >
                <b className="text-[16px] font-bold">{compteur.valeur}</b>
                <span className="text-[12px]">{compteur.libelle}</span>
              </div>
            ),
          )}
        </div>
      )}
    </article>
  );
}

/**
 * LA GRILLE DE CARTES — `.client-cards`/`.site-cards` de
 * `codiplan-maquette-complete.html`, une seule forme pour les deux écrans
 * (D123) : rien dans la maquette ne les distingue, ce fichier ne les
 * distingue pas non plus.
 *
 * **Les paliers `1180px` et `900px` sont MESURÉS, jamais ceux de Tailwind par
 * défaut.** `@media(max-width:1180px){.site-cards,.client-cards{grid-
 * template-columns:repeat(2,1fr)}}` et `@media(max-width:900px){…
 * {grid-template-columns:1fr}}` — deux paliers propres à cette grille, sans
 * rapport avec `md`/`lg` de Tailwind, qui tombent à 768 et 1024. Les reprendre
 * aurait été une approximation là où le document donne un nombre exact.
 */
export function GrilleCartesEntites({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="grid grid-cols-3 gap-[14px] max-[1180px]:grid-cols-2 max-[900px]:grid-cols-1">
      {children}
    </div>
  );
}
