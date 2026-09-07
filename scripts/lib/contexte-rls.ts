import { VARIABLES_CONTEXTE } from "../../lib/db/rls";

/**
 * LE CONTEXTE EST-IL ARMÉ ? — ce que la base RÉCLAME, contre ce que la
 * production POSE (ticket L1-02b).
 *
 * ## Le défaut, et il a été mesuré avant d'être gardé
 *
 * `client`, `site` et `machine` portent la forme « parc » : société **ET**
 * `app.client_id` **ET** `app.perimetre_sites`. Les scénarios de
 * `tests/isolation/` la prouvent, table par table, et ils sont verts.
 *
 * Ils sont verts parce que **le harnais pose `app.client_id`, et que le chemin
 * de production ne le posait pas**. `lib/db/rls.ts` posait quatre variables ;
 * les politiques en réclamaient six. Aucun test ne mentait : chacun éprouvait
 * correctement des politiques justes. Ce que personne ne faisait, c'était
 * confronter le contexte POSÉ au contexte ATTENDU.
 *
 * C'est l'espèce nommée au §9 le 01/09 — deux implémentations d'un même
 * contrat, chacune verte, qui divergent en silence parce qu'aucune ne prétend
 * être l'autre —, appliquée cette fois à l'ARMEMENT du cloisonnement plutôt
 * qu'à sa définition. Et le mode de défaillance est le pire : sous le contexte
 * réel, la branche « `app.client_id` absent » de la forme « parc » se lit
 * « utilisateur interne » et **ouvre tout le parc de la société**. Une
 * politique qui se referme quand on la désarme aurait été bruyante ; celle-ci
 * s'ouvre, silencieusement.
 *
 * ## Ce que ce module confronte, et pourquoi c'est solide
 *
 * La force d'un gardien ne vient pas de ce qu'il recopie, mais des sources
 * qu'il ne contrôle pas (§9, 01/09). Ici :
 *
 *   - la moitié **base** vient de `pg_policies` — l'expression ANALYSÉE, où les
 *     graphies, les enveloppes `DO $$ … $$` et les poses en deux temps se
 *     dissolvent — **et** des définitions de fonctions, parce qu'une politique
 *     peut lire une variable à travers un appel : `app.role` n'apparaît dans
 *     aucune politique, elle est lue par `app_role()`. Un gardien qui n'aurait
 *     regardé que `pg_policies` aurait été creux sur elle, et sur les deux
 *     variables que le déclencheur d'audit lit ;
 *   - la moitié **dépôt** vient de `VARIABLES_CONTEXTE`, que `poserContexte`
 *     PARCOURT. Ce n'est pas une déclaration à côté du code : c'est le tableau
 *     dont l'instruction est construite. En retirer une entrée retire
 *     réellement la pose — et c'est ce qui rend le jumeau honnête.
 *
 * ## La population est large, délibérément
 *
 * On ne cherche pas `current_setting(...)` : on cherche **tout littéral
 * `'app.<nom>'`** dans l'expression d'une politique ou le corps d'une fonction.
 * Élargir la population est la parade au `WHERE` qui recoupe l'assertion (§9,
 * 31/08) : un motif ancré sur `current_setting` laisserait passer la variable
 * lue par une forme voisine — un alias, une fonction enveloppante, une
 * concaténation. Le faux positif possible est une mention en commentaire à
 * l'intérieur d'un corps de fonction ; il **échoue du bon côté** — il réclame
 * qu'une variable soit posée, jamais qu'elle cesse de l'être.
 *
 * ## Ce que ce module NE tient pas, et qui se dit
 *
 * Une variable dont le nom est assemblé à l'exécution (`'app.' || x`) reste
 * hors de portée — forme 6 du §9. Un gardien statique arrête la correction bien
 * intentionnée, pas un contournement décidé.
 */

/** Le motif d'une variable de session : large, et sans ancrage sur l'appelant. */
const MOTIF_VARIABLE = /'(app\.[a-z_]+)'/g;

/**
 * Les deux lieux où la base peut RÉCLAMER une variable de session.
 *
 * `pg_policies` rend l'expression analysée ; `pg_get_functiondef` rend le
 * source de la fonction. `prokind = 'f'` écarte les agrégats et les fonctions
 * de fenêtrage, sur lesquels `pg_get_functiondef` lève une erreur.
 */
export const SQL_DEMANDES_CONTEXTE = `
  SELECT 'politique ' || p.tablename || ' / ' || p.policyname AS source,
         coalesce(p.qual, '') || ' ' || coalesce(p.with_check, '') AS expression
    FROM pg_policies p
   WHERE p.schemaname = 'public'
  UNION ALL
  SELECT 'fonction ' || f.proname AS source,
         pg_get_functiondef(f.oid) AS expression
    FROM pg_proc f
    JOIN pg_namespace n ON n.oid = f.pronamespace
   WHERE n.nspname = 'public'
     AND f.prokind = 'f'
   ORDER BY 1
`;

/** Une expression de la base, avec le nom de l'objet qui la porte. */
export type ExpressionObservee = {
  readonly source: string;
  readonly expression: string;
};

/** Une variable réclamée, et les objets qui la réclament. */
export type DemandeContexte = {
  readonly variable: string;
  readonly sources: readonly string[];
};

/**
 * Les variables que la base réclame, extraites des expressions observées.
 *
 * Rendues triées, et chacune avec la liste des objets qui la nomment : un
 * message d'écart qui dit « `app.client_id` n'est posée par personne » sans
 * dire QUI la réclame oblige à rouvrir une console pour agir.
 */
export function demandesContexte(
  observees: readonly ExpressionObservee[],
): DemandeContexte[] {
  const parVariable = new Map<string, Set<string>>();

  for (const observee of observees) {
    for (const trouve of observee.expression.matchAll(MOTIF_VARIABLE)) {
      const variable = trouve[1];
      parVariable.set(
        variable,
        (parVariable.get(variable) ?? new Set()).add(observee.source),
      );
    }
  }

  return [...parVariable.entries()]
    .map(([variable, sources]) => ({
      variable,
      sources: [...sources].sort(),
    }))
    .sort((a, b) => a.variable.localeCompare(b.variable));
}

/**
 * Écarts : toute variable réclamée par la base doit être posée par la
 * production.
 *
 * **Le témoin est le premier écart, et il n'est pas décoratif.** Zéro variable
 * observée ressemble trait pour trait à « tout est posé » : c'est la vacuité du
 * §9, et un décompte nul a déjà rendu quatre gardiens creux dans ce dépôt. Une
 * base réelle réclame au minimum `app.societe_id` ; ne rien trouver signifie
 * que la lecture a échoué, pas que la base est irréprochable.
 *
 * **Le sens inverse — une variable posée que personne ne réclame — n'est PAS un
 * écart ici**, et c'est délibéré. `app.adresse_ip` n'est lue par aucune
 * politique, seulement par le déclencheur d'audit ; et poser une variable de
 * trop n'ouvre rien. L'inverse est gardé ailleurs, sur le HARNAIS, où il
 * signifie tout autre chose : un harnais plus riche que la production est un
 * harnais qui ment (`tests/unit/db/contexte-harnais.test.ts`).
 */
export function ecartsContexteArme(
  demandes: readonly DemandeContexte[],
  posees: readonly string[] = VARIABLES_CONTEXTE,
): string[] {
  if (demandes.length === 0) {
    return [
      "aucune variable de session observée dans `pg_policies` ni dans les " +
        "définitions de fonctions. Une base cloisonnée en réclame au moins " +
        "une : la lecture a échoué, ou elle a été jouée hors du schéma " +
        "`public`. Un décompte nul ressemble toujours à un sans-faute.",
    ];
  }

  return demandes
    .filter((demande) => !posees.includes(demande.variable))
    .map(
      (demande) =>
        `« ${demande.variable} » est RÉCLAMÉE par la base et posée par ` +
        "AUCUN chemin de production. La politique qui la lit ne garde donc " +
        "rien de ce qu'elle prétend garder — et si sa branche « variable " +
        "absente » est permissive, elle OUVRE. Réclamée par : " +
        `${demande.sources.join(", ")}. Le chemin de production est ` +
        "`lib/db/rls.ts` et sa liste close `VARIABLES_CONTEXTE`.",
    );
}

/**
 * Le rapport de veille : ce qui vient de la BASE, et ce qui vient du DÉPÔT.
 *
 * Chaque ligne dit de quel côté du miroir elle vient (§9, 06/09). Un décompte
 * qui ne peut pas bouger sous la faute surveillée n'est jamais présenté à côté
 * de ceux qui le peuvent — d'où les NOMS plutôt que les nombres : un nom se
 * vérifie, un décompte se lit en trois secondes et ne se vérifie pas.
 */
export function rapportContexte(
  demandes: readonly DemandeContexte[],
  posees: readonly string[] = VARIABLES_CONTEXTE,
): string[] {
  return [
    "Contexte de session — armement du cloisonnement (L1-02b) :",
    `  observé en base — réclamées : ${
      demandes.map((demande) => demande.variable).join(", ") || "(aucune)"
    }`,
    `  attendu du dépôt — posées par lib/db/rls.ts : ${posees.join(", ")}`,
  ];
}
