/**
 * Les FORMES de politique RLS, et le gardien qui les mesure en base
 * (ticket R0-a, écart É9 de la revue R0 ; invariant I1 ; arbitrages D4, D10,
 * D22, D42 ; ticket L0-10 pour le journal).
 *
 * **Ce qu'il répare, et ce n'est pas une politique.** Le ticket L0-04 écrit
 * « **Forme imposée** : `societe_id = current_setting('app.societe_id')::uuid
 * OR societe_id IS NULL` », au singulier. Il y en a CINQ en vigueur, mesurées
 * dans `pg_policies` et non déduites d'une lecture. Une session du lot 1 qui
 * recopie « la forme imposée » sur `client`, `site` ou `modele_materiel` écrit
 * une politique fausse **dans le sens permissif** — et elle l'écrit en
 * obéissant. C'est le seul défaut du dépôt qu'on produit en suivant la
 * documentation.
 *
 * ## Les cinq formes, chacune avec son cas et un exemple en base
 *
 * | Forme | Clause | S'applique à | Exemple |
 * |---|---|---|---|
 * | **identité** | `id = app.societe_id` | `societe` SEULE — la table que `societe_id` désigne (D42) | `societe` |
 * | **société** | `societe_id = app.societe_id` | toute table métier ordinaire (I1, 1ʳᵉ catégorie) | `agence`, `calendrier`, `utilisateur_societe` |
 * | **référentiel** | lecture `USING (true)`, écriture `app_est_role_editeur()` | liste close des référentiels de plateforme (I1, 2ᵉ catégorie, D4) | `devise`, `parite`, `jour_ferie` |
 * | **parc** | société **ET** `app.client_id` **ET** `app.perimetre_sites` | `client`, `site`, `machine` — le portail (D10) et le chemin QR (D22) | fixtures du harnais aujourd'hui, tables réelles aux lots 1 et 2 |
 * | **journal** | `SELECT` : société **ET** habilitation ; `INSERT` seul ; ni `UPDATE` ni `DELETE` | `journal_audit` (I8, L0-10) | `journal_audit` |
 *
 * ## Celle qui NE s'applique PAS à une table métier ordinaire, et pourquoi
 *
 * **La forme « référentiel ».** Ses deux moitiés sont fausses sur une table
 * métier, et pour deux raisons distinctes :
 *
 *   1. sa lecture est `USING (true)` — *toutes* les sociétés lisent *toutes*
 *      les lignes. Sur `devise` c'est la décision D4 (« le franc Pacifique est
 *      le même partout ») ; sur `client` c'est la fin du cloisonnement ;
 *   2. son écriture est `app_est_role_editeur()` — elle donne au salarié de
 *      l'éditeur le droit d'écrire, et le retire à la société propriétaire.
 *      Sur un référentiel c'est l'objet même de la règle ; sur une table
 *      métier c'est l'inverse exact de ce que §22.5 promet au client.
 *
 * **Et la branche `OR societe_id IS NULL` de la forme imposée est un vestige,
 * pas une licence.** Sur une colonne `societe_id NOT NULL` — c'est-à-dire sur
 * toute table de la première catégorie de I1 — elle est **inerte** : aucune
 * ligne ne peut la satisfaire. Les six tables du lot 0 la portent encore parce
 * que L0-04 l'a écrite ; le gardien ne l'interdit donc pas, il **mesure son
 * inertie** — la colonne doit être `NOT NULL`. Le jour où elle ne l'est pas,
 * la branche devient une porte, et le gardien la nomme. Une table nouvelle
 * s'écrit sans elle.
 *
 * ## Pourquoi MESURÉE EN BASE, et non lue dans les migrations
 *
 * `pg_policies` rend l'expression **analysée**, pas le texte écrit. Les six
 * formes équivalentes du §9 s'y dissolvent d'elles-mêmes :
 *   — la **graphie** (forme 1) : guillemets, casse, schéma qualifiant sont
 *     normalisés par l'analyseur, il n'y a plus qu'une écriture à reconnaître ;
 *   — l'**enveloppe d'exécution** (forme 2) : une politique posée depuis un
 *     `DO $$ … $$` ou un `EXECUTE format(…)` est dans le catalogue comme une
 *     autre — c'est le résultat qui est lu, pas l'instruction ;
 *   — les **deux temps** (forme 3) : `CREATE` puis `DROP`, `ALTER POLICY`,
 *     `CREATE OR REPLACE` — le catalogue ne porte que l'état final ;
 *   — l'**assemblage délibéré** (forme 6), seul angle mort d'un gardien
 *     statique, disparaît lui aussi : un nom construit à l'exécution produit
 *     une politique réelle, donc visible ici.
 *
 * Ce que cette mesure ne voit pas, et qui se dit plutôt que se tait : elle ne
 * juge que les tables **présentes dans la base observée**. `client`, `site` et
 * `machine` n'existent pas encore en production — elles y seront jugées le jour
 * où la migration les crée, comme `perimetre-audit` juge le déclencheur
 * d'audit. Sur la base jetable du harnais, elles existent en fixtures et sont
 * jugées **dès aujourd'hui**.
 */

/**
 * ## LA SIXIÈME FORME, DÉCIDÉE ET NON CONSTRUITE — « filiation »
 *
 * *Arbitrage du 07/09/2026, ticket L1-02. Le principe est tranché ; la forme
 * n'existe pas encore, et c'est délibéré.*
 *
 * **Le problème qu'elle résout.** Une table FILLE d'une table du parc — les
 * horaires d'un site, ses temps de trajet par prestation, ses contacts —
 * porterait `societe_id NOT NULL` et relèverait donc de la première catégorie
 * de I1. Aucune des cinq formes ne lui va : la forme « société » laisserait un
 * compte portail restreint au site S1 lire les lignes filles du site S2 du même
 * client, et recopier la forme « parc » sur elle est impossible — la fille ne
 * porte pas `client_id`, et l'y ajouter dupliquerait un rattachement que la clé
 * étrangère tient déjà.
 *
 * **Le principe, tranché : une fille est visible si son parent l'est.** La
 * clause s'adosse à la clé étrangère qui la rattache, jamais à une recopie des
 * colonnes du parent :
 *
 *     EXISTS (SELECT 1 FROM <parent> p WHERE p.<pk> = <fille>.<fk>)
 *
 * — le parent portant déjà sa propre politique, la visibilité se propage sans
 * qu'aucun filtre soit réécrit. **Fermée par le SCHÉMA, comme le reste** :
 * c'est la clé étrangère qui dit qui est le parent, pas une liste que quelqu'un
 * tiendrait à jour.
 *
 * **CE QU'ELLE COÛTE, mesuré et non annoncé.** *(base locale, 5 000 sites sur
 * 10 sociétés, 100 000 lignes filles, index sur la clé étrangère.)*
 *
 * | Lecture | Sans filiation | Avec |
 * |---|---|---|
 * | balayage d'une société (10 000 lignes) | 7,1 ms | 10,5 ms |
 * | les lignes d'UN parent — l'accès réel | 0,04 ms | 0,26 ms |
 *
 * Deux choses que la mesure corrige, et c'est pour cela qu'on mesure plutôt
 * qu'on estime. **Ce n'est PAS « une sous-requête à chaque ligne lue »** :
 * PostgreSQL transforme l'`EXISTS` en *hash semi-join* et ne visite le parent
 * qu'une fois — le surcoût est celui d'une jointure, pas d'une boucle. Et le
 * facteur relatif de l'accès pointé (×6) impressionne bien plus que son coût
 * absolu (0,2 ms), qui disparaît sous les 190 ms de latence vers Sydney.
 *
 * **LE CRITÈRE QUI L'APPELLERA : la première table fille réelle.** Pas une
 * date. `ecartsTablesFilles` ci-dessous le tient — il part du schéma, repère
 * toute table portant une clé étrangère vers une table du parc, et rougit en
 * renvoyant ici. Tant qu'il n'y en a aucune, il n'y a rien à construire.
 */

/**
 * Les cinq formes. Le message d'échec les cite : un développeur qui découvre ce
 * gardien doit comprendre ce qu'on lui demande sans ouvrir le CLAUDE.md.
 */
export const RAPPEL_FORMES = [
  "identité   — `id = app.societe_id` : la CLAUSE que `societe` porte (D42). " +
    "Depuis D67 elle est une moitié de la forme « adhésion », jamais une forme " +
    "à elle seule : `societe` porte les deux.",
  "société    — `societe_id = app.societe_id` : toute table métier ordinaire.",
  "référentiel — lecture `true`, écriture `app_est_role_editeur()` : liste " +
    "close de I1 (D4). NE S'APPLIQUE JAMAIS à une table métier.",
  "parc       — société ET `app.client_id` ET `app.perimetre_sites` : " +
    "`client`, `site`, `machine` (D10, D22).",
  "journal    — SELECT habilité, INSERT seul, ni UPDATE ni DELETE : " +
    "`journal_audit` (I8).",
  "habilitation — société ET (pas un compte portail OU sa propre ligne) : " +
    "`utilisateur_client`, `utilisateur_client_site` (L1-02b). Le " +
    "discriminant est `app.client_id`, posée pour un compte portail et pour " +
    "lui seul ; la restriction s'ancre sur `app.utilisateur_id`, ou sur " +
    "l'habilitation parente pour la table de périmètre.",
  "adhésion   — identité pour TOUT LE MONDE, plus SES PROPRES SOCIÉTÉS en " +
    "SELECT seul : `societe` (D67). Sans elle, un sélecteur ne peut afficher " +
    "que des UUID ; avec elle sur une écriture, un compte renommerait une " +
    "société.",
  "filiation  — `EXISTS (SELECT 1 FROM <parent> WHERE <parent>.id = " +
    "<fille>.<fk>)` : une fille est visible si son parent l'est. " +
    "`site_habilitation_requise` (L1-04). AUCUNE clause de société n'y est " +
    "ajoutée — elle serait une seconde source du même fait ; c'est la clé " +
    "étrangère composite qui empêche la fille de dériver de son parent.",
  "héritage   — la CIBLE polymorphe est visible, ET la classe RÉTRÉCIT : " +
    "`document` (D93). Un document suit sa machine OU son modèle, exactement " +
    "un des deux étant renseigné, et `interne` disparaît pour un compte " +
    "portail. La classe ne fait que retirer ; elle n'ouvre rien à personne.",
  "ascendance — société pour TOUT LE MONDE, plus, pour un compte portail " +
    "SEUL, l'existence d'un ENFANT visible : `modele_materiel`, " +
    "`famille_materiel` (D93). C'est l'INVERSE de la filiation — celle-ci " +
    "propage vers le bas une visibilité acquise, celle-là REFUSE vers le " +
    "haut une visibilité que la clause de société donnait. Sans elle, la " +
    "présence d'une notice révèle la composition du parc des autres sites.",
].join("\n  ");

/** Les formes que ce gardien sait exiger. */
export type Forme =
  | "société"
  | "parc"
  | "journal"
  | "habilitation"
  | "filiation"
  | "appartenance"
  | "adhésion"
  | "rattachement"
  | "héritage"
  | "ascendance";

/**
 * `societe` est cloisonnée par son IDENTITÉ (D42). Liste close, recopiée depuis
 * la constitution — comme `CLOISONNEE_PAR_IDENTITE` de `categories-i1`, et pour
 * la même raison : un gardien qui tirerait sa liste de la source qu'il juge ne
 * vérifierait rien.
 */
export const CLOISONNEE_PAR_IDENTITE = ["societe"] as const;

/**
 * Les tables du PARC, celles que le portail client traverse (D10) et par
 * lesquelles un QR code se résout (D22).
 *
 * `perimetre` dit si la table porte, en plus du filtre client, le filtre de
 * périmètre de sites. `client` ne le porte pas — elle EST le client, il n'y a
 * pas de site au-dessus d'elle.
 *
 * **Liste close, et gardée comme les autres** (`ecartsListeParc`). Elle est la
 * plus exposée de toutes : la retirer d'une table ne casse rien, ne fait
 * échouer aucun scénario, et **réduit silencieusement** ce que le harnais
 * couvre. C'est l'écart É14 de la revue R0, rendu mécanique.
 *
 * Le jour où `intervention` rejoindra le parc — D10 donne au portail la vue de
 * ses interventions —, ce sera un **arbitrage**, pris au lot 2, jamais une
 * ligne ajoutée en séance.
 */
export const TABLES_PARC = [
  { table: "client", perimetre: false, colonnePerimetre: null },
  { table: "site", perimetre: true, colonnePerimetre: "id" },
  { table: "machine", perimetre: true, colonnePerimetre: "site_id" },
  // `contact` rejoint le parc au ticket L1-03. Sa colonne de périmètre est
  // NULLABLE, et c'est la première du dépôt : un contact sans site est un
  // contact du CLIENT. Voir `ecartsPerimetreNullable`.
  { table: "contact", perimetre: true, colonnePerimetre: "site_id" },
  // `intervention` REJOINT LE PARC au ticket du lot 2, PAR L'ARBITRAGE QUE CE
  // COMMENTAIRE RÉCLAMAIT — D84, 09/09/2026. La note ci-dessus disait : « le
  // jour où `intervention` rejoindra le parc, ce sera un arbitrage, pris au
  // lot 2, jamais une ligne ajoutée en séance. » C'est cet arbitrage, et il est
  // écrit avec sa condition de réouverture.
  //
  // Sa colonne de périmètre est `site_id` : une intervention a lieu sur un
  // site, comme une machine y est installée. Elle n'est PAS une table
  // « fille » au sens de la forme « filiation » — elle ne DÉDUIT pas son
  // rattachement d'un parent, elle le PORTE, `client_id` et `site_id` étant des
  // colonnes de premier rang du chapitre 11.2, exactement comme sur `machine`.
  { table: "intervention", perimetre: true, colonnePerimetre: "site_id" },
] as const;

/** Les cinq entrées que D10, D22, L1-03 et D84 autorisent aujourd'hui. Recopiées. */
const PARC_ARBITRE = ["client", "site", "machine", "contact", "intervention"];

/**
 * LA COLONNE DE PÉRIMÈTRE PEUT ÊTRE NULLABLE, ET ALORS LA CLAUSE DOIT LE DIRE
 * (ticket L1-03).
 *
 * `site` et `machine` ne posaient pas la question : leur colonne de périmètre
 * est `NOT NULL`. `contact` est la première dont elle ne l'est pas — un contact
 * sans site est un contact du CLIENT, pas un contact orphelin.
 *
 * **Sans la branche `IS NULL`, la faute ne casse RIEN de visible** : la liste
 * se raccourcit pour un compte portail restreint à certains sites, et personne
 * ne sait ce qui manque. *On perdrait le comptable en restreignant un atelier.*
 * C'est le piège que l'exploitation a nommé le 07/09/2026, avant qu'il ne se
 * produise — et c'est exactement le genre de chose qu'une relecture laisse
 * passer parce qu'elle ne produit aucun rouge.
 *
 * La NULLABILITÉ vient d'`information_schema`, une source que ce module ne
 * contrôle pas : rendre la colonne `NOT NULL` sortirait la table de l'exigence,
 * ce qui serait le `WHERE` qui recoupe l'assertion (§9, 31/08) — mais ce
 * changement-là serait un changement de MODÈLE, visible et refusé ailleurs.
 */
export const SQL_COLONNES_PERIMETRE = `
  SELECT "c"."table_name" AS "table",
         "c"."column_name" AS "colonne",
         ("c"."is_nullable" = 'YES') AS "nullable"
    FROM "information_schema"."columns" "c"
   WHERE "c"."table_schema" = 'public'
   ORDER BY 1, 2
`;

export type ColonnePerimetre = {
  readonly table: string;
  readonly colonne: string;
  readonly nullable: boolean;
};

/**
 * Écarts : une table du parc dont la colonne de périmètre est NULLABLE doit
 * porter la branche `<colonne> IS NULL` dans sa clause.
 */
export function ecartsPerimetreNullable(
  colonnes: readonly ColonnePerimetre[],
  politiques: readonly PolitiqueObservee[],
): string[] {
  if (colonnes.length === 0) {
    return [
      "aucune colonne observée : l'exigence de la branche `IS NULL` sur une " +
        "colonne de périmètre nullable n'a rien gardé. Un décompte nul " +
        "ressemble toujours à un sans-faute.",
    ];
  }

  const ecarts: string[] = [];

  for (const entree of TABLES_PARC) {
    if (entree.perimetre !== true || entree.colonnePerimetre === null) {
      continue;
    }
    const colonne = colonnes.find(
      (c) => c.table === entree.table && c.colonne === entree.colonnePerimetre,
    );
    if (colonne === undefined || !colonne.nullable) {
      continue;
    }

    for (const politique of politiques.filter(
      (p) => p.table === entree.table,
    )) {
      for (const clause of clausesGardiennes(politique)) {
        const motif = new RegExp(
          `\\b${entree.colonnePerimetre}\\s+is\\s+null\\b`,
          "i",
        );
        if (!motif.test(normaliser(clause))) {
          ecarts.push(
            entete(entree.table, "parc") +
              `sa colonne de périmètre « ${entree.colonnePerimetre} » est ` +
              `NULLABLE, et la politique « ${politique.nom} » ne porte pas la ` +
              `branche \`${entree.colonnePerimetre} IS NULL\`. Une ligne SANS ` +
              "valeur sur l'axe du périmètre DISPARAÎT alors pour tout compte " +
              "portail restreint — et la faute ne casse rien de visible : la " +
              "liste se raccourcit, et personne ne sait ce qui manque. On " +
              "perdrait le comptable en restreignant un atelier.",
          );
        }
      }
    }
  }

  return ecarts;
}

/** Le journal d'audit : lecture habilitée, ajout seul (I8, L0-10). */
export const TABLES_JOURNAL = ["journal_audit"] as const;

/**
 * Les tables d'HABILITATION — la SIXIÈME forme construite (L1-02b, arbitrage du
 * 07/09/2026).
 *
 * **Ce ne sont pas des données du parc : ce sont les tables qui DONNENT accès
 * au parc.** C'est ce qui exclut la forme « parc » pour elles, et l'exclut pour
 * une raison de fond plutôt que de commodité : la forme « parc » lit
 * `app.perimetre_sites`, et `app.perimetre_sites` est calculée EN LISANT ces
 * tables. Une politique qui lit la variable que sa propre lecture alimente ne
 * se referme jamais.
 *
 * La forme compose DEUX AXES :
 *
 *     société  ET  ( pas un compte portail  OU  sa propre ligne )
 *
 * Le discriminant est `app.client_id`, posée pour un compte portail et pour lui
 * seul. Sans lui, la clause « sa propre ligne » retirerait à un
 * `admin_societe` la vue des habilitations de SA société, qu'il doit avoir.
 *
 * **Ce que la clause laisse voir, et qui n'est pas un défaut** *(ratifié le
 * 07/09/2026)*. La restriction s'ancre sur `app.utilisateur_id`, pas sur
 * `app.client_id` : un compte habilité sur DEUX clients de la même société voit
 * ses deux lignes, même quand `app.client_id` n'en désigne qu'un. Ces lignes
 * sont des faits sur le COMPTE, pas sur les données du client — un compte a le
 * droit de connaître ses propres habilitations, c'est ce qui lui permettra de
 * changer de client. Ce qu'il ne doit pas voir, ce sont les habilitations
 * d'AUTRUI, et c'est ce que la clause tient. Resserrer sur `app.client_id`
 * serait une régression déguisée en durcissement.
 *
 * **Elle vient d'une mesure, pas d'une intuition.** Sous la forme « société »
 * que `utilisateur_client` portait, un compte portail du client A1 lisait les
 * lignes d'habilitation des comptes du client A2 de la même société, en tirait
 * par jointure leurs `nom` et `email`, et énumérait par là les autres clients
 * de la société. Mesuré le 07/09/2026 sous le rôle applicatif — les trois
 * réponses sont oui.
 *
 * **Liste close, gardée dans les deux sens** (`ecartsListeHabilitation`). Le
 * RETRAIT est ici le geste dangereux, comme pour le parc : retirer une entrée
 * fait retomber la table sur la forme « société », qui passe — et la fuite
 * mesurée revient sans qu'aucun scénario ne rougisse.
 */
/**
 * La forme « DÉSIGNATION » — la septième, et **la borne s'écrit avant le nom**
 * (L1-02c, décision d'exploitation du 07/09/2026).
 *
 * *Nommer cette forme sans la borner serait pire que de ne pas la nommer :
 * elle ressemble à une porte de service.* Voici donc d'abord ce qu'elle n'est
 * pas.
 *
 * **Elle ne vaut QUE pour les opérations qui PRÉCÈDENT le contexte de
 * locataire** — c'est-à-dire l'authentification, et rien d'autre. Le motif
 * d'addition recevable est unique et étroit : *l'opération se produit avant
 * qu'une société soit connue, et par construction ne peut pas l'être.* « C'est
 * plus simple ainsi », « le contexte n'est pas encore posé à cet endroit » et
 * « on le posera plus tard » ne sont pas des motifs : ce sont des descriptions
 * du code, pas des propriétés de l'opération.
 *
 * Ce qu'elle autorise, et c'est tout : lire **la ligne que l'appelant nommait
 * déjà**. Elle ne rend donc jamais plus que ce que l'appelant savait avant
 * d'interroger — c'est ce qui la distingue d'une exemption. Mesuré le
 * 07/09/2026 : une AUTRE ligne nommément demandée rend zéro, un balayage
 * `LIKE '%'` rend la seule ligne nommée, une variable vide rend zéro.
 *
 * **Liste close, gardée dans les deux sens.** L'addition est ici le geste
 * dangereux — c'est elle qui transformerait une borne en passage.
 *
 * ## ELLE PASSE DE UNE À CINQ ENTRÉES AU TICKET L1-02d, PAR ARBITRAGE
 *
 * *Décision d'exploitation du 08/09/2026.* Les quatre tables techniques
 * d'authentification rejoignent `utilisateur`, et elles satisfont le motif
 * étroit sans qu'on ait à l'élargir d'un pouce : **elles sont lues avant qu'une
 * société soit connue, et par construction elle ne peut pas l'être** — c'est
 * l'authentification elle-même.
 *
 * L'exemption dont elles bénéficiaient était un VESTIGE, et l'exploitation l'a
 * dit dans ces termes : elles avaient été laissées sans plancher pour la même
 * raison que `utilisateur` avant L1-02c — nous ne savions pas exprimer une
 * garantie avant le contexte. *Une borne posée faute de mieux ne se reconduit
 * pas dès que le mieux existe.*
 *
 * Chaque clé de désignation est DÉDUITE du chemin d'accès réel, tracé et non
 * supposé : le JETON pour `session`, l'identifiant d'utilisateur pour `compte`
 * et `second_facteur`, l'identifiant opaque pour `verification`.
 *
 * `journal_acces` n'y entre PAS, et c'est le résultat de la déduction, pas un
 * oubli : c'est une TRACE, pas un matériau d'authentification. Elle reçoit la
 * forme du journal — ajout seul —, amputée de la clause de société que D34 lui
 * interdit de porter.
 */
export const TABLES_DESIGNATION = [
  "utilisateur",
  "session",
  "compte",
  "verification",
  "second_facteur",
] as const;

/** Les entrées que les arbitrages autorisent. Recopiées : c'est la doctrine. */
const DESIGNATIONS_ARBITREES = [
  "utilisateur",
  "session",
  "compte",
  "verification",
  "second_facteur",
];

/** Écarts de la liste « désignation » — additions comme retraits. */
export function ecartsListeDesignation(
  liste: readonly string[] = TABLES_DESIGNATION,
): string[] {
  const ecarts = liste
    .filter((table) => !DESIGNATIONS_ARBITREES.includes(table))
    .map(
      (table) =>
        `« ${table} » a été rangée sous la forme « désignation ». Le seul ` +
        "motif recevable est que l'opération se produise AVANT qu'une société " +
        "soit connue, et ne puisse pas l'être — l'authentification, et rien " +
        "d'autre. Toute addition passe par un arbitrage : c'est elle qui " +
        "transformerait une borne en porte de service.",
    );

  for (const arbitree of DESIGNATIONS_ARBITREES) {
    if (!liste.includes(arbitree)) {
      ecarts.push(
        `« ${arbitree} » ne figure plus sous la forme « désignation » : la ` +
          "branche d'authentification n'aurait plus de forme, et la table " +
          "retomberait soit sur une clause de société — sous laquelle " +
          "personne ne peut plus se connecter (mesuré) —, soit sur aucune " +
          "politique du tout, ce qui était l'état que L1-02d a fermé.",
      );
    }
  }

  return ecarts;
}

/**
 * **UNE POLITIQUE QUI N'ÉNONCE QU'UN `USING` LÉGIFÈRE EN SILENCE SUR LES
 * ÉCRITURES** (L1-02c, décision d'exploitation du 07/09/2026).
 *
 * PostgreSQL fait alors valoir la même expression en `WITH CHECK`. Ce n'est pas
 * un détail de syntaxe : c'est une décision prise par personne, exactement
 * comme l'`ON UPDATE CASCADE` par défaut de Prisma (§9, 24/08).
 *
 * **Et elle se trompe dans un sens qu'on ne voit pas venir.** Mesuré sur
 * `utilisateur` : sous une expression de lecture reprise en écriture, la
 * création de compte est REFUSÉE — au moment où l'identité est insérée, son
 * habilitation n'existe pas encore. Une expression d'écriture dérivée de la
 * lecture échoue pour cette seule raison, et le message ne dit rien de tout
 * cela.
 *
 * La règle vaut **au-delà de cette table** : toute politique couvrant une
 * écriture énonce son `WITH CHECK`, **même quand il répète le `USING`** — pour
 * que ce soit une DÉCISION et non une conséquence.
 */
export function ecartsWithCheckExplicite(
  politiques: readonly PolitiqueObservee[],
): string[] {
  if (politiques.length === 0) {
    return [
      "aucune politique observée : la règle du `WITH CHECK` explicite n'a rien " +
        "gardé. Un décompte nul ressemble toujours à un sans-faute.",
    ];
  }

  return politiques
    .filter((politique) => {
      const commande = politique.commande.toUpperCase();
      return (
        (commande === "ALL" ||
          commande === "INSERT" ||
          commande === "UPDATE") &&
        (politique.ecriture ?? null) === null
      );
    })
    .map(
      (politique) =>
        `« ${politique.table} » — la politique « ${politique.nom} » couvre ` +
        `${politique.commande} sans énoncer de \`WITH CHECK\`. PostgreSQL y ` +
        "fait alors valoir le `USING`, et c'est une décision prise par " +
        "personne. L'écrire, même s'il répète le `USING` : une expression " +
        "d'écriture n'a pas les mêmes contraintes qu'une expression de " +
        "lecture — au moment d'une insertion, ce que la lecture exige " +
        "n'existe pas encore.",
    );
}

export const TABLES_HABILITATION = [
  { table: "utilisateur_client", ancre: "utilisateur" },
  { table: "utilisateur_client_site", ancre: "parent" },
] as const;

/** Les deux entrées que l'arbitrage du 07/09/2026 autorise. Recopiées. */
const HABILITATION_ARBITREE = ["utilisateur_client", "utilisateur_client_site"];

/**
 * Écarts de la liste d'habilitation elle-même — additions comme retraits.
 *
 * Même forme que `ecartsListeParc`, et pour la même raison : c'est le retrait
 * qui ouvre la brèche.
 */
export function ecartsListeHabilitation(
  liste: readonly string[] = TABLES_HABILITATION.map((entree) => entree.table),
): string[] {
  const ecarts = liste
    .filter((table) => !HABILITATION_ARBITREE.includes(table))
    .map(
      (table) =>
        `« ${table} » a été rangée parmi les tables d'habilitation : elle ` +
        "échapperait au filtre client de la forme « parc » sans porter la " +
        "restriction « sa propre ligne ». Toute addition passe par un " +
        "arbitrage, elle ne se décide pas dans un ticket.",
    );

  for (const attendue of HABILITATION_ARBITREE) {
    if (!liste.includes(attendue)) {
      ecarts.push(
        `« ${attendue} » ne figure plus parmi les tables d'habilitation : ` +
          "elle retomberait sur la forme « société », qui PASSE — et la fuite " +
          "mesurée le 07/09/2026 reviendrait sans qu'aucun scénario ne " +
          "rougisse. C'est le retrait qui ouvre la brèche, pas l'addition.",
      );
    }
  }

  return ecarts;
}

/**
 * LA HUITIÈME FORME — « appartenance » (D61, ticket L1-02f).
 *
 * **Le mur qu'elle abat, mesuré avant d'être contourné.** Un compte qui vient
 * de se connecter n'a aucune société active : la connexion n'établit que
 * l'identité (D35), et `basculerSociete` exige qu'on lui NOMME la société
 * visée. Or `utilisateur_societe` portait la forme « société », si bien que la
 * question « sur quelles sociétés suis-je habilité ? » rendait **zéro ligne**
 * tant qu'une société n'était pas déjà active. Aucun chemin ne permettait donc
 * à un utilisateur réel d'atteindre sa propre société.
 *
 * **Ce que la forme ajoute** : une politique de `SELECT` ancrée sur l'identité
 * connectée — `utilisateur_id = app.utilisateur_id` —, qui rend à un compte SES
 * lignes d'habilitation, toutes sociétés confondues, et jamais celles d'autrui.
 * C'est la première fois qu'une ligne de la première catégorie de I1 devient
 * lisible hors de sa société ; cela s'écrit plutôt que de se glisser dans une
 * politique existante.
 *
 * **Et ce qu'elle refuse, qui est le cœur du gardien** : la même branche sur
 * une commande d'ÉCRITURE laisserait un compte s'attribuer le rôle de son choix
 * sur la société de son choix. La branche « sa propre ligne » n'est donc
 * tolérée qu'en `SELECT`, et le gardien le vérifie commande par commande.
 */
export const TABLES_APPARTENANCE = ["utilisateur_societe"] as const;

/**
 * LA NEUVIÈME FORME — « ADHÉSION » (D67, ticket L2-11).
 *
 * `societe` est de forme « identité » (`id = app.societe_id`, D42). Mesuré le
 * 08/09/2026, avec témoin : sans société active, la lecture rend **zéro ligne —
 * pas même en nommant l'identifiant qu'on possède déjà** (0 à l'aveugle, 0 en
 * nommant les deux, 2 lignes réellement en base). D61 rend la LISTE des
 * sociétés d'un compte ; il manquait de quoi en NOMMER une, et **un sélecteur
 * ne pouvait proposer que des UUID.**
 *
 * **Ce que la forme ajoute** : une politique de `SELECT` ancrée sur
 * `app.utilisateur_id` par la table d'habilitation, qui rend à un compte les
 * lignes des sociétés où il est habilité. Le coût se nomme, comme D61 a nommé
 * le sien : *une personne apprend le NOM des sociétés dont elle connaît déjà la
 * liste.* Ni leurs données, ni leurs habilitations, ni l'existence d'aucune
 * autre société.
 *
 * **Et ce qu'elle refuse, qui est le cœur du gardien** : la même branche sur une
 * commande d'ÉCRITURE laisserait un compte **renommer** une société, ou s'en
 * attacher une. Elle n'est donc tolérée qu'en `SELECT`, et le gardien le
 * vérifie commande par commande — l'épreuve joue la faute telle qu'elle se
 * commettrait, en « simplifiant » vers `FOR ALL`.
 */
export const TABLES_ADHESION = ["societe"] as const;

/**
 * LA DIXIÈME FORME — « RATTACHEMENT » (D92, ticket L2-12).
 *
 * **Le mur qu'elle abat, MESURÉ avant d'être contourné.** Un compte portail n'a
 * **aucune** ligne dans `utilisateur_societe` — D10 le veut ainsi, « les deux
 * tables sont exclusives » — et `utilisateur_client` portait la forme
 * « habilitation », dont la première clause est `societe_id = app.societe_id`.
 * Rien ne pouvait donc lui donner une société, et sans société il ne lisait pas
 * son propre rattachement. *Mesuré le 11/09/2026 sous `codiplan_app`, avec
 * témoin — zéro société sans contexte : **identité seule → 0 ligne**,
 * identité + société → 3, et `utilisateur_societe` du compte portail → **0**.*
 *
 * **Aucun compte portail n'atteignait donc aucun écran.** C'est le mur de D61,
 * rencontré une seconde fois, de l'autre côté : D61 rendait à un compte INTERNE
 * la liste de ses sociétés ; celle-ci rend à un compte PORTAIL la liste de ses
 * rattachements.
 *
 * **Ce que la forme ajoute** : une politique de `SELECT` ancrée sur
 * `utilisateur_id = app.utilisateur_id`, qui rend à un compte SES lignes de
 * rattachement, toutes sociétés confondues, et jamais celles d'autrui.
 *
 * **Le coût, nommé comme D61 et D67 ont nommé le leur** : *une personne apprend
 * la liste des clients auxquels elle est déjà rattachée.* Elle ne rend ni leur
 * NOM — `client` reste de forme « parc » —, ni aucune de leurs données, ni
 * l'existence d'aucun autre client, ni les rattachements de quiconque d'autre.
 *
 * **Et ce qui la borne est la COMMANDE, pas la clause**, exactement comme pour
 * la huitième et la neuvième : la même branche sur une écriture laisserait un
 * compte **se rattacher au client de son choix**, c'est-à-dire s'ouvrir le parc
 * d'un tiers. Elle est donc en `SELECT` et en `SELECT` seul, l'écriture restant
 * entièrement gouvernée par la clause d'habilitation.
 *
 * Liste close gardée dans les DEUX sens : le **retrait** est le sens silencieux
 * — il fait retomber la table sur la forme « habilitation », qui passe tous les
 * gardiens, et le mur revient.
 */
export const TABLES_RATTACHEMENT = ["utilisateur_client"] as const;

/** L'unique entrée que l'arbitrage D92 autorise. Recopiée, et gardée. */
const RATTACHEMENT_ARBITRE = ["utilisateur_client"];

/**
 * Écarts de la liste de rattachement elle-même — additions comme retraits.
 *
 * Le RETRAIT est le sens silencieux, comme pour `TABLES_APPARTENANCE` et
 * `TABLES_ADHESION` : la table retombe sur la forme « habilitation », qui PASSE
 * — et aucun compte portail n'atteint plus aucun écran, sans qu'un seul
 * scénario ne rougisse. L'ADDITION, elle, étendrait à une autre table une
 * lecture hors de sa société.
 */
export function ecartsListeRattachement(
  liste: readonly string[] = TABLES_RATTACHEMENT,
): string[] {
  const ecarts = liste
    .filter((table) => !RATTACHEMENT_ARBITRE.includes(table))
    .map(
      (table) =>
        `« ${table} » a été rangée parmi les tables de rattachement : une de ` +
        "ses lignes deviendrait lisible HORS de sa société, sur la seule " +
        "identité de l'appelant. Toute addition passe par un arbitrage, elle " +
        "ne se décide pas dans un ticket.",
    );

  for (const attendue of RATTACHEMENT_ARBITRE) {
    if (!liste.includes(attendue)) {
      ecarts.push(
        `« ${attendue} » ne figure plus parmi les tables de rattachement : ` +
          "elle retomberait sur la forme « habilitation » seule, et aucun " +
          "compte portail n'atteindrait plus aucun écran — le mur que D92 " +
          "abat, revenu sans qu'aucun scénario ne rougisse.",
      );
    }
  }

  return ecarts;
}

/** L'unique entrée que l'arbitrage D67 autorise. Recopiée, et gardée. */
const ADHESION_ARBITREE = ["societe"];

/**
 * Écarts de la liste d'adhésion elle-même — additions comme retraits.
 *
 * Le RETRAIT est le sens silencieux, comme pour `TABLES_APPARTENANCE` : il
 * ferait retomber `societe` sur la forme « identité » seule, qui passe tous les
 * gardiens — et le mur du sélecteur reviendrait sans qu'aucun scénario ne
 * rougisse. L'ADDITION, elle, étendrait à une autre table une lecture hors de
 * sa société.
 */
export function ecartsListeAdhesion(
  liste: readonly string[] = TABLES_ADHESION,
): string[] {
  const ecarts = liste
    .filter((table) => !ADHESION_ARBITREE.includes(table))
    .map(
      (table) =>
        `« ${table} » a été rangée parmi les tables d'adhésion : une de ses ` +
        "lignes deviendrait lisible HORS de sa société, sur la seule identité " +
        "de l'appelant. Toute addition passe par un arbitrage, elle ne se " +
        "décide pas dans un ticket.",
    );

  for (const attendue of ADHESION_ARBITREE) {
    if (!liste.includes(attendue)) {
      ecarts.push(
        `« ${attendue} » ne figure plus parmi les tables d'adhésion : elle ` +
          "retomberait sur la forme « identité » seule, et aucun sélecteur ne " +
          "pourrait plus afficher autre chose qu'un UUID — le mur que D67 abat.",
      );
    }
  }

  return ecarts;
}

/** L'unique entrée que l'arbitrage D61 autorise. Recopiée, et gardée. */
const APPARTENANCE_ARBITREE = ["utilisateur_societe"];

/**
 * Écarts de la liste d'appartenance elle-même — additions comme retraits.
 *
 * Même forme que `ecartsListeParc` et `ecartsListeHabilitation`, et pour la
 * même raison dans les deux sens : l'addition étend une exception au
 * cloisonnement société, le retrait ferait retomber la table sur la forme
 * « société » — qui PASSE, et le premier écran redeviendrait inatteignable
 * sans qu'aucun scénario ne rougisse.
 */
export function ecartsListeAppartenance(
  liste: readonly string[] = TABLES_APPARTENANCE,
): string[] {
  const ecarts = liste
    .filter((table) => !APPARTENANCE_ARBITREE.includes(table))
    .map(
      (table) =>
        `« ${table} » a été rangée parmi les tables d'appartenance : une de ` +
        "ses lignes deviendrait lisible HORS de sa société. Toute addition " +
        "passe par un arbitrage, elle ne se décide pas dans un ticket.",
    );

  for (const attendue of APPARTENANCE_ARBITREE) {
    if (!liste.includes(attendue)) {
      ecarts.push(
        `« ${attendue} » ne figure plus parmi les tables d'appartenance : ` +
          "elle retomberait sur la forme « société », et aucun compte ne " +
          "pourrait plus découvrir sa propre société — le mur que D61 abat.",
      );
    }
  }

  return ecarts;
}

/**
 * Référentiels de plateforme (I1, 2ᵉ catégorie). Ils ne relèvent PAS de la
 * première catégorie : le gardien les nomme seulement pour refuser la
 * contradiction — un référentiel qui porterait `societe_id NOT NULL` serait
 * dans deux catégories à la fois, ce que D41 interdit.
 *
 * **ELLE A PERDU TROIS ENTRÉES le 08/09/2026** — `famille_materiel`,
 * `modele_materiel` et `checklist_modele` —, et c'est un RETRAIT à une liste
 * close, donc un arbitrage. D4 se contredisait : il rangeait ces tables parmi
 * les référentiels « modifiables par les seuls rôles éditeur » et écrivait dans
 * la même page qu'« une société qui veut l'adapter en crée une copie ». Une
 * société qui ne peut pas écrire ne peut pas créer de copie. L'exploitation a
 * retiré le mécanisme plutôt que d'arbitrer entre ses moitiés : elles sont
 * désormais des tables métier cloisonnées (L1-05).
 *
 * `checklist_modele` n'existe pas encore ; elle sort par la justification que D4
 * lui donnait — « attachée au modèle, suit son régime » —, et naîtra donc
 * cloisonnée.
 */
export const REFERENTIELS_PLATEFORME = [
  "devise",
  "parite",
  "jour_ferie",
] as const;

/**
 * Écarts de la liste du parc elle-même — additions comme retraits.
 *
 * Le retrait est le cas dangereux, et c'est celui que la revue R0 a nommé : le
 * jour où L1-01 crée la vraie table `client`, retirer sa ligne d'ici ferait
 * retomber la table sur la forme « société », qui passe — et le filtre portail
 * de D10 disparaîtrait sans qu'aucun scénario ne rougisse.
 */
export function ecartsListeParc(
  liste: readonly string[] = TABLES_PARC.map((entree) => entree.table),
): string[] {
  const ecarts = liste
    .filter((table) => !PARC_ARBITRE.includes(table))
    .map(
      (table) =>
        `« ${table} » a été ajoutée aux TABLES_PARC : toute addition passe ` +
        "par un arbitrage, elle ne se décide pas dans un ticket.",
    );

  for (const attendue of PARC_ARBITRE) {
    if (!liste.includes(attendue)) {
      ecarts.push(
        `« ${attendue} » a été RETIRÉE des TABLES_PARC. C'est le retrait qui ` +
          "est dangereux, pas l'addition : la table retombe sur la forme " +
          "« société », qui passe, et le filtre portail de D10 comme le " +
          "chemin QR de D22 disparaissent sans qu'aucun scénario ne rougisse. " +
          "Toute modification passe par un arbitrage.",
      );
    }
  }

  return ecarts;
}

/** La colonne `societe_id` d'une table, telle que le catalogue la porte. */
export type ColonneSociete = {
  table: string;
  /** La colonne existe-t-elle ? */
  presente: boolean;
  /** Est-elle `NOT NULL` ? C'est ce qui rend la branche plateforme inerte. */
  obligatoire: boolean;
};

/** Une politique, telle que `pg_policies` la rend — expression ANALYSÉE. */
export type PolitiqueObservee = {
  table: string;
  nom: string;
  /** `PERMISSIVE` ou `RESTRICTIVE`. Les permissives se combinent par OU. */
  permissive: string;
  /** `ALL`, `SELECT`, `INSERT`, `UPDATE` ou `DELETE`. */
  commande: string;
  /** `qual` — ce que la politique laisse LIRE. */
  lecture: string | null;
  /** `with_check` — ce qu'elle laisse ÉCRIRE. */
  ecriture: string | null;
};

/**
 * Les tables du schéma `public` et l'état de leur colonne `societe_id`.
 *
 * Mêmes exclusions que `SQL_ETAT_RLS` : les partitions relèvent du contrôle
 * dédié, et `_prisma_migrations` est hors périmètre de I1.
 */
export const SQL_COLONNE_SOCIETE = `
  SELECT "c"."relname"::text                        AS "table",
         ("a"."attname" IS NOT NULL)                AS "presente",
         COALESCE("a"."attnotnull", false)          AS "obligatoire"
    FROM "pg_catalog"."pg_class" "c"
    JOIN "pg_catalog"."pg_namespace" "n" ON "n"."oid" = "c"."relnamespace"
    LEFT JOIN "pg_catalog"."pg_attribute" "a"
           ON "a"."attrelid" = "c"."oid"
          AND "a"."attname" = 'societe_id'
          AND NOT "a"."attisdropped"
   WHERE "n"."nspname" = 'public'
     AND "c"."relkind" IN ('r', 'p')
     AND NOT "c"."relispartition"
     AND "c"."relname" <> '_prisma_migrations'
   ORDER BY "c"."relname"
`;

/** Les politiques du schéma `public`, expression analysée comprise. */
export const SQL_POLITIQUES = `
  SELECT "p"."tablename"::text  AS "table",
         "p"."policyname"::text AS "nom",
         "p"."permissive"::text AS "permissive",
         "p"."cmd"::text        AS "commande",
         "p"."qual"             AS "lecture",
         "p"."with_check"       AS "ecriture"
    FROM "pg_catalog"."pg_policies" "p"
   WHERE "p"."schemaname" = 'public'
   ORDER BY "p"."tablename", "p"."policyname"
`;

/** Espaces et retours à la ligne réduits — le catalogue en met de son cru. */
function normaliser(clause: string): string {
  return clause.replace(/\s+/g, " ").trim();
}

/**
 * La clause est-elle ancrée sur `<colonne> = app.societe_id` ?
 *
 * Les deux écritures du dépôt sont acceptées : celle de D4 (`= current_setting`)
 * et celle du rétablissement de L0-05 (`= NULLIF(current_setting(…), '')::uuid`).
 * Le catalogue ayant analysé l'expression, il n'y a pas d'autre graphie à
 * craindre.
 */
function ancre(clause: string, colonne: string): boolean {
  const motif = new RegExp(
    `\\b${colonne}\\s*=\\s*\\(*\\s*(?:nullif\\s*\\(\\s*)?current_setting\\s*\\(\\s*'app\\.societe_id'`,
    "i",
  );
  return motif.test(normaliser(clause));
}

/** La branche plateforme `OR societe_id IS NULL` — inerte si la colonne l'est. */
function branchePlateforme(clause: string): boolean {
  return /\bsociete_id\s+is\s+null\b/i.test(normaliser(clause));
}

/** La clause admet-elle TOUTE ligne ? C'est la moitié lecture du référentiel. */
function ouvertureTotale(clause: string): boolean {
  const propre = normaliser(clause)
    .replace(/^\(+|\)+$/g, "")
    .trim();
  return propre.toLowerCase() === "true" || /\bor\s+true\b/i.test(clause);
}

/** L'écriture réservée aux rôles éditeur — l'autre moitié du référentiel. */
function roleEditeur(clause: string): boolean {
  return /\bapp_est_role_editeur\s*\(/i.test(clause);
}

/** Le filtre du compte portail (D10). */
function filtreClient(clause: string): boolean {
  return /'app\.client_id'/.test(clause);
}

/** Le filtre de périmètre de sites (D10). */
function filtrePerimetre(clause: string): boolean {
  return /'app\.perimetre_sites'/.test(clause);
}

/** L'ancrage « sa propre ligne » : le compte courant (L1-02b). */
function ancreUtilisateur(clause: string): boolean {
  return /'app\.utilisateur_id'/.test(clause);
}

/** L'ancrage par l'habilitation PARENTE, pour la table de périmètre (L1-02b). */
function ancreParent(clause: string): boolean {
  return (
    /\bexists\s*\(/i.test(normaliser(clause)) &&
    /utilisateur_client/.test(clause)
  );
}

/** L'habilitation de lecture du journal d'audit (§5.2). */
function habilitationJournal(clause: string): boolean {
  return /\bapp_peut_consulter_journal_audit\s*\(/i.test(clause);
}

/**
 * Les clauses d'une politique qui GARDENT réellement des lignes.
 *
 * `qual` ne s'applique pas à un `INSERT` et `with_check` ne s'applique pas à un
 * `SELECT` : juger la mauvaise moitié rendrait le gardien creux dans un sens ou
 * bruyant dans l'autre. Pour `ALL` et `UPDATE`, `with_check` absent signifie
 * « la même que `qual` » — c'est la règle de PostgreSQL, et elle est reprise
 * ici plutôt que supposée.
 */
function clausesGardiennes(politique: PolitiqueObservee): string[] {
  const commande = politique.commande.toUpperCase();
  const lecture = politique.lecture;
  const ecriture = politique.ecriture ?? politique.lecture;

  if (commande === "INSERT") {
    return politique.ecriture === null ? [] : [politique.ecriture];
  }
  if (commande === "SELECT" || commande === "DELETE") {
    return lecture === null ? [] : [lecture];
  }
  // ALL et UPDATE gardent des deux côtés.
  return [lecture, ecriture].filter(
    (clause): clause is string => clause !== null,
  );
}

/** Les commandes couvertes par un jeu de politiques. */
function couvreToutesCommandes(
  politiques: readonly PolitiqueObservee[],
): boolean {
  const commandes = new Set(politiques.map((p) => p.commande.toUpperCase()));
  if (commandes.has("ALL")) {
    return true;
  }
  return ["SELECT", "INSERT", "UPDATE", "DELETE"].every((c) =>
    commandes.has(c),
  );
}

/**
 * Les tables que I1 range dans sa PREMIÈRE catégorie, telles que la base les
 * montre : `societe` par exception (D42), plus toute table portant une colonne
 * `societe_id` sans être un référentiel de plateforme.
 *
 * **La colonne est retenue qu'elle soit `NOT NULL` ou non, et c'est le point.**
 * La première rédaction ne retenait que les colonnes obligatoires — si bien
 * qu'une table qui perdait son `NOT NULL` SORTAIT du périmètre du gardien au
 * lieu d'y être condamnée. Le contrôle passait au vert sur le geste même qui
 * ouvre la branche `OR societe_id IS NULL` : la vacuité du §9, dans le gardien
 * écrit pour la combattre, et démasquée par son propre jumeau. La nullité est
 * désormais un ÉCART, jamais une sortie.
 */
export function tablesPremiereCategorie(
  colonnes: readonly ColonneSociete[],
): ColonneSociete[] {
  return colonnes.filter(
    (colonne) =>
      (CLOISONNEE_PAR_IDENTITE as readonly string[]).includes(colonne.table) ||
      (colonne.presente &&
        !(REFERENTIELS_PLATEFORME as readonly string[]).includes(
          colonne.table,
        )),
  );
}

/** La forme attendue d'une table de la première catégorie de I1. */
export function formeAttendue(table: string): Forme {
  // « ADHÉSION » A REMPLACÉ « IDENTITÉ » COMME FORME DE `societe` (D67), et
  // elle ne l'affaiblit pas : elle EXIGE l'ancrage `id = app.societe_id` par un
  // témoin de non-vacuité, et y ajoute la borne de la branche « mes sociétés ».
  // Une forme « identité » distincte n'aurait plus aucune table, et un gardien
  // qui ne garde rien passe au vert sans avoir rien regardé (§9, 30/08).
  //
  // Le jour où une table entrerait dans `CLOISONNEE_PAR_IDENTITE` sans entrer
  // dans `TABLES_ADHESION` — ce que les deux listes closes refusent —, elle
  // retomberait sur la forme « société », qui exigerait un ancrage
  // `societe_id` qu'elle n'a pas : le refus serait BRUYANT, jamais silencieux.
  if ((TABLES_ADHESION as readonly string[]).includes(table)) {
    return "adhésion";
  }
  if (TABLES_PARC.some((entree) => entree.table === table)) {
    return "parc";
  }
  if ((TABLES_JOURNAL as readonly string[]).includes(table)) {
    return "journal";
  }
  // « RATTACHEMENT » A REMPLACÉ « HABILITATION » COMME FORME DE
  // `utilisateur_client` (D92), et elle ne l'affaiblit pas : elle EXIGE tout ce
  // que « habilitation » exigeait — ancrage société, discriminant
  // `app.client_id`, pas de lecture circulaire du périmètre — et y ajoute la
  // borne de la branche « mes rattachements ». Le test se fait AVANT celui de
  // `TABLES_HABILITATION`, dont `utilisateur_client` reste membre : c'est ce
  // qui garantit que les exigences de la huitième forme ne sont pas perdues.
  if ((TABLES_RATTACHEMENT as readonly string[]).includes(table)) {
    return "rattachement";
  }
  if (TABLES_HABILITATION.some((entree) => entree.table === table)) {
    return "habilitation";
  }
  if (TABLES_FILIATION.some((entree) => entree.table === table)) {
    return "filiation";
  }
  if (TABLES_HERITAGE.some((entree) => entree.table === table)) {
    return "héritage";
  }
  // « ASCENDANCE » A REMPLACÉ « SOCIÉTÉ » sur `modele_materiel` et
  // `famille_materiel` (D93), et elle ne l'affaiblit pas : elle EXIGE l'ancrage
  // `societe_id = app.societe_id` par un contrôle qui lui est propre, et y
  // ajoute le refus de remonter vers un parent dont aucun enfant n'est visible.
  if (TABLES_ASCENDANCE.some((entree) => entree.table === table)) {
    return "ascendance";
  }
  if ((TABLES_APPARTENANCE as readonly string[]).includes(table)) {
    return "appartenance";
  }
  return "société";
}

/** Préfixe commun des messages : la table, sa forme, et le rappel. */
function entete(table: string, forme: Forme): string {
  return `« ${table} » relève de la première catégorie de I1 et doit porter la forme « ${forme} » — `;
}

/** Écarts des formes « société » et « parc » — la seconde ajoute à la première. */
function ecartsSociete(
  table: string,
  forme: Forme,
  politiques: readonly PolitiqueObservee[],
  colonne: ColonneSociete,
): string[] {
  const ecarts: string[] = [];
  const parc = TABLES_PARC.find((entree) => entree.table === table);

  for (const politique of politiques) {
    for (const clause of clausesGardiennes(politique)) {
      if (ouvertureTotale(clause)) {
        ecarts.push(
          entete(table, forme) +
            `la politique « ${politique.nom} » ouvre TOUTES les lignes ` +
            "(`true`). C'est la moitié lecture de la forme « référentiel », " +
            "légitime sur `devise` (D4) et jamais sur une table métier : elle " +
            "y supprime le cloisonnement.",
        );
        continue;
      }
      if (roleEditeur(clause)) {
        ecarts.push(
          entete(table, forme) +
            `la politique « ${politique.nom} » réserve l'accès à ` +
            "`app_est_role_editeur()`. C'est la moitié écriture de la forme " +
            "« référentiel » : elle donne le droit au salarié de l'éditeur et " +
            "le retire à la société propriétaire — l'inverse exact de ce que " +
            "le §22.5 promet au client.",
        );
        continue;
      }
      if (!ancre(clause, "societe_id")) {
        ecarts.push(
          entete(table, forme) +
            `la politique « ${politique.nom} » n'est pas ancrée sur ` +
            "`societe_id = app.societe_id`. Une politique permissive non " +
            "ancrée s'ajoute aux autres par OU : elle élargit, elle ne " +
            "restreint jamais.",
        );
        continue;
      }
      if (branchePlateforme(clause) && !colonne.obligatoire) {
        ecarts.push(
          entete(table, forme) +
            `la politique « ${politique.nom} » porte la branche ` +
            "`OR societe_id IS NULL` alors que la colonne est NULLABLE. Sur " +
            "une colonne `NOT NULL` cette branche est un vestige INERTE de la " +
            "rédaction de L0-04 ; ici elle est VIVANTE, et c'est une porte : " +
            "toute ligne sans société devient lisible et écrivable par toutes " +
            "les sociétés.",
        );
      }
      if (parc !== undefined && !filtreClient(clause)) {
        ecarts.push(
          entete(table, "parc") +
            `la politique « ${politique.nom} » a perdu le filtre ` +
            "`app.client_id`. C'est la réparation que la revue R0 redoutait : " +
            "la clause société seule PASSE, et un compte portail voit alors " +
            "tout le parc de la société au lieu du sien (D10).",
        );
      }
      if (parc?.perimetre === true && !filtrePerimetre(clause)) {
        ecarts.push(
          entete(table, "parc") +
            `la politique « ${politique.nom} » a perdu le filtre ` +
            "`app.perimetre_sites` : un compte portail restreint à un site en " +
            "voit alors d'autres (D10).",
        );
      }
    }
  }

  if (politiques.length > 0 && !couvreToutesCommandes(politiques)) {
    ecarts.push(
      entete(table, forme) +
        "ses politiques ne couvrent pas les quatre commandes. Une commande " +
        "sans politique n'est pas ouverte — elle est fermée —, mais " +
        "l'application ne peut plus l'exercer : c'est une panne, pas un " +
        "cloisonnement.",
    );
  }

  return ecarts;
}

/**
 * Écarts de la forme « appartenance » (D61) — société pour tout le monde, PLUS
 * sa propre ligne EN LECTURE SEULE pour le sujet.
 *
 * La forme se juge politique par politique, et la question posée à chacune est
 * la même : *par quoi est-elle ancrée, et sur quelle commande ?* Une politique
 * permissive s'ajoute aux autres par OU — elle élargit, elle ne restreint
 * jamais —, si bien qu'une seule mal ancrée suffit à défaire la table.
 */
/**
 * Écarts de la forme « ADHÉSION » (D67) — `societe` et elle seule.
 *
 * Deux moitiés, et le gardien exige les DEUX : l'ancrage d'identité
 * (`id = app.societe_id`, D42) qui gouverne tout, plus la branche « mes
 * sociétés » — ancrée sur `app.utilisateur_id` — **en `SELECT` et en `SELECT`
 * seul**. La même branche sur une écriture laisserait un compte renommer une
 * société, ou s'en attacher une.
 */
function ecartsAdhesion(
  table: string,
  politiques: readonly PolitiqueObservee[],
): string[] {
  const ecarts: string[] = [];
  let ancreesIdentite = 0;
  let mesSocietesEnLecture = 0;

  for (const politique of politiques) {
    const commande = politique.commande.toUpperCase();
    for (const clause of clausesGardiennes(politique)) {
      if (ouvertureTotale(clause) || roleEditeur(clause)) {
        ecarts.push(
          entete(table, "adhésion") +
            `la politique « ${politique.nom} » porte la forme « référentiel ». ` +
            "C'est la forme qui NE s'applique JAMAIS à une table métier.",
        );
        continue;
      }

      if (ancre(clause, "id")) {
        ancreesIdentite += 1;
        continue;
      }

      // Non ancrée sur l'identité : c'est la branche « mes sociétés », et elle
      // n'est tolérée qu'à DEUX conditions, toutes deux vérifiées ici.
      if (!ancreUtilisateur(clause)) {
        ecarts.push(
          entete(table, "adhésion") +
            `la politique « ${politique.nom} » n'est ancrée NI sur ` +
            "`id = app.societe_id`, NI sur `app.utilisateur_id`. Une politique " +
            "permissive non ancrée s'ajoute aux autres par OU : elle élargit, " +
            "elle ne restreint jamais.",
        );
        continue;
      }

      if (commande !== "SELECT") {
        // LE CŒUR DU GARDIEN, et la faute telle qu'elle se commettrait : en
        // « simplifiant » vers FOR ALL.
        ecarts.push(
          entete(table, "adhésion") +
            `la politique « ${politique.nom} » porte l'ancrage « mes ` +
            `sociétés » sur ${commande}, et non sur SELECT seul. Un compte ` +
            "pourrait alors ÉCRIRE la ligne d'une société où il est habilité — " +
            "la renommer, changer sa devise, ou s'en attacher une. La branche " +
            "de D67 est une lecture, et rien d'autre.",
        );
        continue;
      }

      mesSocietesEnLecture += 1;
    }
  }

  // TÉMOINS DE NON-VACUITÉ, dans les deux sens — et aucun des deux ne se
  // signale tout seul. Zéro ancrage d'identité, c'est le cloisonnement de la
  // table racine perdu ; zéro branche « mes sociétés », c'est le mur du
  // sélecteur revenu, et il ne fait rougir aucun scénario existant.
  if (politiques.length > 0 && ancreesIdentite === 0) {
    ecarts.push(
      entete(table, "adhésion") +
        "aucune politique n'est ancrée sur `id = app.societe_id`. La table " +
        "racine du cloisonnement ne se garde plus elle-même (D42).",
    );
  }
  if (politiques.length > 0 && mesSocietesEnLecture === 0) {
    ecarts.push(
      entete(table, "adhésion") +
        "aucune politique de SELECT n'est ancrée sur `app.utilisateur_id`. La " +
        "branche de D67 a disparu : plus aucun compte ne peut lire le NOM des " +
        "sociétés où il est habilité, et un sélecteur ne peut proposer que des " +
        "UUID — le mur que D67 abat, revenu en silence.",
    );
  }

  return ecarts;
}

function ecartsAppartenance(
  table: string,
  politiques: readonly PolitiqueObservee[],
  colonne: ColonneSociete,
): string[] {
  const ecarts: string[] = [];
  let ancreesSociete = 0;
  let proprelLigneEnLecture = 0;

  for (const politique of politiques) {
    const commande = politique.commande.toUpperCase();
    for (const clause of clausesGardiennes(politique)) {
      if (ouvertureTotale(clause) || roleEditeur(clause)) {
        ecarts.push(
          entete(table, "appartenance") +
            `la politique « ${politique.nom} » porte la forme « référentiel ». ` +
            "C'est la forme qui NE s'applique JAMAIS à une table métier.",
        );
        continue;
      }

      if (ancre(clause, "societe_id")) {
        ancreesSociete += 1;
        if (branchePlateforme(clause) && !colonne.obligatoire) {
          ecarts.push(
            entete(table, "appartenance") +
              `la politique « ${politique.nom} » porte la branche ` +
              "`OR societe_id IS NULL` alors que la colonne est NULLABLE.",
          );
        }
        continue;
      }

      // Non ancrée sur la société : c'est la branche « sa propre ligne », et
      // elle n'est tolérée qu'à DEUX conditions, toutes deux vérifiées ici.
      if (!ancreUtilisateur(clause)) {
        ecarts.push(
          entete(table, "appartenance") +
            `la politique « ${politique.nom} » n'est ancrée NI sur ` +
            "`societe_id = app.societe_id`, NI sur `app.utilisateur_id`. Une " +
            "politique permissive non ancrée s'ajoute aux autres par OU : " +
            "elle élargit, elle ne restreint jamais.",
        );
        continue;
      }

      if (commande !== "SELECT") {
        // LE CŒUR DU GARDIEN. Une branche « sa propre ligne » sur une commande
        // d'écriture laisse un compte s'attribuer le rôle de son choix sur la
        // société de son choix — c'est-à-dire se promouvoir.
        ecarts.push(
          entete(table, "appartenance") +
            `la politique « ${politique.nom} » porte l'ancrage « sa propre ` +
            `ligne » sur ${commande}, et non sur SELECT seul. Un compte ` +
            "pourrait alors ÉCRIRE sa propre habilitation : s'attribuer le " +
            "rôle de son choix sur la société de son choix. La branche de " +
            "D61 est une lecture, et rien d'autre.",
        );
        continue;
      }

      proprelLigneEnLecture += 1;
    }
  }

  // TÉMOINS DE NON-VACUITÉ, dans les deux sens. Zéro politique ancrée sur la
  // société, c'est le cloisonnement perdu ; zéro branche « sa propre ligne »,
  // c'est le mur de D61 revenu — et aucun des deux ne se signale tout seul.
  if (politiques.length > 0 && ancreesSociete === 0) {
    ecarts.push(
      entete(table, "appartenance") +
        "aucune de ses politiques n'est ancrée sur " +
        "`societe_id = app.societe_id` : le cloisonnement société a disparu, " +
        "et il ne reste que la branche d'identité.",
    );
  }
  if (politiques.length > 0 && proprelLigneEnLecture === 0) {
    ecarts.push(
      entete(table, "appartenance") +
        "aucune de ses politiques ne porte la branche « sa propre ligne » en " +
        "`SELECT`. La table retombe sur la forme « société », et aucun compte " +
        "ne peut plus découvrir sa propre société — le mur que D61 abat.",
    );
  }

  if (politiques.length > 0 && !couvreToutesCommandes(politiques)) {
    ecarts.push(
      entete(table, "appartenance") +
        "ses politiques ne couvrent pas les quatre commandes.",
    );
  }

  return ecarts;
}

/** Écarts de la forme « journal » — lecture habilitée, ajout seul (I8, L0-10). */
function ecartsJournal(
  table: string,
  politiques: readonly PolitiqueObservee[],
): string[] {
  const ecarts: string[] = [];
  const parCommande = (commande: string) =>
    politiques.filter((p) => p.commande.toUpperCase() === commande);

  for (const interdite of ["ALL", "UPDATE", "DELETE"]) {
    if (parCommande(interdite).length > 0) {
      ecarts.push(
        entete(table, "journal") +
          `une politique porte la commande ${interdite}. Le journal est en ` +
          "AJOUT SEUL (I8, D32) : une politique qui autorise la réécriture ou " +
          "l'effacement retire au mot « inaltérable » son seul contenu.",
      );
    }
  }

  const lectures = parCommande("SELECT");
  if (lectures.length === 0) {
    ecarts.push(
      entete(table, "journal") +
        "aucune politique de SELECT : le journal n'est consultable par " +
        "personne, pas même par `admin_societe` et `direction` (§5.2).",
    );
  }
  for (const lecture of lectures) {
    const clause = lecture.lecture ?? "";
    if (!ancre(clause, "societe_id")) {
      ecarts.push(
        entete(table, "journal") +
          `la politique de lecture « ${lecture.nom} » n'est pas ancrée sur ` +
          "`societe_id = app.societe_id` : une société lirait le journal " +
          "d'une autre.",
      );
    }
    if (!habilitationJournal(clause)) {
      ecarts.push(
        entete(table, "journal") +
          `la politique de lecture « ${lecture.nom} » n'exige plus ` +
          "`app_peut_consulter_journal_audit()` : tout rôle de la société y " +
          "lirait les valeurs avant/après de tout le métier (§5.2).",
      );
    }
  }

  const ajouts = parCommande("INSERT");
  if (ajouts.length === 0) {
    ecarts.push(
      entete(table, "journal") +
        "aucune politique d'INSERT : le déclencheur ne peut plus écrire, et " +
        "le journal cesse silencieusement d'être alimenté.",
    );
  }
  for (const ajout of ajouts) {
    if (!ancre(ajout.ecriture ?? "", "societe_id")) {
      ecarts.push(
        entete(table, "journal") +
          `la politique d'ajout « ${ajout.nom} » n'est pas ancrée sur ` +
          "`societe_id = app.societe_id` : une société écrirait au journal " +
          "d'une autre.",
      );
    }
  }

  return ecarts;
}

/**
 * Écarts de la forme « HABILITATION » — la sixième (L1-02b).
 *
 * Trois exigences, et chacune répare une fuite différente.
 *
 *   1. L'ancrage SOCIÉTÉ, comme partout ailleurs.
 *   2. Le DISCRIMINANT `app.client_id`. Sans lui, la clause serait soit
 *      « société » seule — et un compte portail lirait les habilitations des
 *      autres clients de sa société, la fuite mesurée le 07/09/2026 —, soit
 *      « sa propre ligne » pour tout le monde, ce qui retirerait à un
 *      `admin_societe` la vue des habilitations de SA société.
 *   3. La RESTRICTION, ancrée soit sur `app.utilisateur_id` (la table
 *      d'habilitation elle-même), soit sur l'habilitation parente par un
 *      `EXISTS` (la table de périmètre). La seconde n'est pas une faveur : la
 *      sous-requête est elle-même soumise aux politiques, si bien que la règle
 *      est écrite UNE fois et se recompose — plutôt que deux clauses jumelles
 *      qui divergeront (§9, 01/09).
 *
 * La forme « parc » est explicitement refusée ici, et c'est le refus qui
 * compte : elle lit `app.perimetre_sites`, laquelle est calculée EN LISANT ces
 * tables. Une politique qui lit la variable que sa propre lecture alimente ne
 * se referme jamais.
 */
/**
 * LA DIXIÈME FORME — « rattachement » (D92, ticket L2-12).
 *
 * Elle est « habilitation » PLUS une branche, et c'est ainsi qu'elle est
 * écrite : les politiques ancrées sur la société sont jugées par
 * `ecartsHabilitation`, mot pour mot, et cette fonction ne juge que ce que la
 * dixième forme AJOUTE. *Réécrire les exigences de la huitième ici en ferait
 * deux lectures d'un même critère, condamnées à diverger (§9, 01/09).*
 */
function ecartsRattachement(
  table: string,
  politiques: readonly PolitiqueObservee[],
): string[] {
  const ecarts: string[] = [];
  let propreLigneEnLecture = 0;

  const ancreesSurLIdentite = politiques.filter((politique) =>
    clausesGardiennes(politique).some(
      (clause) => !ancre(clause, "societe_id") && ancreUtilisateur(clause),
    ),
  );

  for (const politique of ancreesSurLIdentite) {
    const commande = politique.commande.toUpperCase();
    if (commande !== "SELECT") {
      // LE CŒUR DU GARDIEN. Une branche « mon rattachement » sur une commande
      // d'écriture laisse un compte SE RATTACHER au client de son choix,
      // c'est-à-dire s'ouvrir le parc d'un tiers — la fuite exacte que la
      // forme « parc » existe pour empêcher.
      ecarts.push(
        entete(table, "rattachement") +
          `la politique « ${politique.nom} » porte l'ancrage « mon ` +
          `rattachement » sur ${commande}, et non sur SELECT seul. Un compte ` +
          "pourrait alors ÉCRIRE son propre rattachement : se donner le " +
          "client de son choix, et lire son parc. La branche de D92 est une " +
          "lecture, et rien d'autre.",
      );
      continue;
    }
    propreLigneEnLecture += 1;
  }

  // Tout le reste — ancrage société, discriminant `app.client_id`, absence de
  // lecture circulaire du périmètre — est jugé par la huitième forme, sur les
  // politiques qui ne portent PAS la branche d'identité.
  const societeSeules = politiques.filter(
    (politique) => !ancreesSurLIdentite.includes(politique),
  );
  ecarts.push(...ecartsHabilitation(table, societeSeules));

  // TÉMOIN DE NON-VACUITÉ — zéro branche « mon rattachement » en `SELECT`,
  // c'est le mur de D92 revenu, et il ne se signale pas tout seul.
  if (politiques.length > 0 && propreLigneEnLecture === 0) {
    ecarts.push(
      entete(table, "rattachement") +
        "aucune de ses politiques ne porte la branche « mon rattachement » en " +
        "`SELECT`. La table retombe sur la forme « habilitation », et aucun " +
        "compte portail n'atteint plus aucun écran : il n'a pas de ligne dans " +
        "`utilisateur_societe` (D10), donc aucune société, donc aucune " +
        "lecture de son propre rattachement.",
    );
  }
  // TÉMOIN INVERSE — zéro politique ancrée sur la société, c'est le
  // cloisonnement perdu, et `ecartsHabilitation` ne le dit pas sur une
  // population vide.
  if (politiques.length > 0 && societeSeules.length === 0) {
    ecarts.push(
      entete(table, "rattachement") +
        "aucune de ses politiques n'est ancrée sur " +
        "`societe_id = app.societe_id` : le cloisonnement société a disparu, " +
        "et il ne reste que la branche d'identité.",
    );
  }

  return ecarts;
}

function ecartsHabilitation(
  table: string,
  politiques: readonly PolitiqueObservee[],
): string[] {
  const ecarts: string[] = [];
  const entree = TABLES_HABILITATION.find((e) => e.table === table);

  for (const politique of politiques) {
    for (const clause of clausesGardiennes(politique)) {
      if (ouvertureTotale(clause) || roleEditeur(clause)) {
        ecarts.push(
          entete(table, "habilitation") +
            `la politique « ${politique.nom} » porte la forme « référentiel ». ` +
            "C'est la forme qui NE s'applique JAMAIS à une table métier.",
        );
        continue;
      }

      if (!ancre(clause, "societe_id")) {
        ecarts.push(
          entete(table, "habilitation") +
            `la politique « ${politique.nom} » n'est pas ancrée sur ` +
            "`societe_id = app.societe_id` : une société lirait les " +
            "habilitations d'une autre.",
        );
      }

      if (!filtreClient(clause)) {
        ecarts.push(
          entete(table, "habilitation") +
            `la politique « ${politique.nom} » a PERDU le discriminant ` +
            "`app.client_id`. Sans lui, il n'y a plus de forme « habilitation » " +
            "du tout : soit la clause retombe sur « société » seule, et un " +
            "compte portail lit les habilitations des autres clients de sa " +
            "société — leurs identités par jointure, et la liste de ces " +
            "clients par `DISTINCT` (mesuré le 07/09/2026) —, soit elle " +
            "restreint tout le monde à sa propre ligne, et `admin_societe` " +
            "perd la vue des habilitations de SA société.",
        );
      }

      if (filtrePerimetre(clause)) {
        ecarts.push(
          entete(table, "habilitation") +
            `la politique « ${politique.nom} » lit app.perimetre_sites. ` +
            "C'est CIRCULAIRE : cette variable est calculée en lisant cette " +
            "table même. Une politique qui lit la variable que sa propre " +
            "lecture alimente ne se referme jamais.",
        );
      }

      const restreint =
        entree?.ancre === "parent"
          ? ancreParent(clause)
          : ancreUtilisateur(clause);
      if (!restreint) {
        ecarts.push(
          entete(table, "habilitation") +
            `la politique « ${politique.nom} » a perdu sa RESTRICTION. ` +
            (entree?.ancre === "parent"
              ? "Le périmètre doit s'adosser à l'habilitation parente par un " +
                "`EXISTS (SELECT 1 FROM utilisateur_client …)`, dont la " +
                "sous-requête est elle-même soumise aux politiques."
              : "Elle doit s'ancrer sur `app.utilisateur_id` — « sa propre " +
                "ligne » —, sans quoi le discriminant `app.client_id` ne " +
                "discrimine plus rien."),
        );
      }
    }
  }

  return ecarts;
}

/**
 * Écarts entre ce que I1 exige et ce que la base porte réellement.
 *
 * Le renversement de D41, appliqué aux politiques : le contrôle part des
 * COLONNES observées — toute table portant `societe_id NOT NULL`, plus
 * `societe` par exception — et non d'une liste de tables à vérifier. Une table
 * métier créée demain sans sa politique fait tomber la vérification le jour où
 * elle est écrite.
 *
 * Trois témoins ouvrent la fonction, et ils comptent autant que les règles : un
 * décompte nul ressemble toujours à un sans-faute (§9, 30/08).
 */
export function ecartsPolitiques(
  colonnes: readonly ColonneSociete[],
  politiques: readonly PolitiqueObservee[],
): string[] {
  if (colonnes.length === 0) {
    return [
      "aucune table observée dans le schéma « public » : le contrôle des " +
        "formes de politique n'a rien établi. Base vide, mauvaise base, ou " +
        "requête jouée hors du schéma attendu.",
    ];
  }

  const premiereCategorie = tablesPremiereCategorie(colonnes);

  if (premiereCategorie.length === 0) {
    return [
      "aucune table de la PREMIÈRE catégorie de I1 observée : ni `societe`, " +
        "ni aucune table portant `societe_id`. Le contrôle des formes de " +
        "politique n'a rien gardé.",
    ];
  }

  if (politiques.length === 0) {
    return [
      "aucune politique observée dans `pg_policies` : le contrôle des formes " +
        "n'a rien lu. Les politiques ont-elles été appliquées ?",
    ];
  }

  // `ecartsWithCheckExplicite` n'est PAS appelée ici, et c'est délibéré : elle
  // porte sur TOUTES les politiques, pas sur les seules tables de la première
  // catégorie de I1, et elle est câblée séparément dans la veille. L'appeler
  // aussi d'ici ferait rendre deux fois le même écart — un lecteur qui voit
  // deux lignes identiques cherche la seconde faute.
  const ecarts: string[] = [
    ...ecartsListeDesignation(),
    ...ecartsListeHeritage(),
    ...ecartsListeAscendance(),
  ];

  // La contradiction inverse : un référentiel de plateforme qui porterait
  // `societe_id NOT NULL` relèverait de deux catégories à la fois (D41).
  for (const colonne of colonnes) {
    if (
      (REFERENTIELS_PLATEFORME as readonly string[]).includes(colonne.table) &&
      colonne.presente &&
      colonne.obligatoire
    ) {
      ecarts.push(
        `« ${colonne.table} » est un référentiel de plateforme (I1, 2ᵉ ` +
          "catégorie) et porte pourtant `societe_id NOT NULL` : elle relève " +
          "de deux catégories à la fois, ce que D41 interdit. Un référentiel " +
          "surchargeable porte `societe_id` NULLABLE (D4).",
      );
    }
  }

  for (const colonne of premiereCategorie) {
    const table = colonne.table;

    if (colonne.presente && !colonne.obligatoire) {
      ecarts.push(
        `« ${table} » relève de la première catégorie de I1 et porte un ` +
          "`societe_id` NULLABLE. Une table métier le porte `NOT NULL` ou " +
          "passe par un arbitrage — et une colonne nullable rend VIVANTE la " +
          "branche `OR societe_id IS NULL` que les politiques du lot 0 " +
          "traînent depuis L0-04.",
      );
    }

    const siennes = politiques.filter((p) => p.table === table);
    if (siennes.length === 0) {
      ecarts.push(
        entete(table, formeAttendue(table)) +
          "elle ne porte AUCUNE politique. Avec `FORCE ROW LEVEL SECURITY` et " +
          "sans politique, plus personne n'y lit ni n'y écrit : c'est une " +
          "panne, et elle se découvrira en production.",
      );
      continue;
    }

    const restrictives = siennes.filter(
      (p) => p.permissive.toUpperCase() !== "PERMISSIVE",
    );
    for (const politique of restrictives) {
      ecarts.push(
        entete(table, formeAttendue(table)) +
          `la politique « ${politique.nom} » est RESTRICTIVE. Aucune forme du ` +
          "dépôt ne l'est : une restrictive se combine par ET et peut rendre " +
          "muettes les permissives voisines sans qu'aucune d'elles ne change.",
      );
    }

    const forme = formeAttendue(table);
    if (forme === "journal") {
      ecarts.push(...ecartsJournal(table, siennes));
    } else if (forme === "habilitation") {
      ecarts.push(...ecartsHabilitation(table, siennes));
    } else if (forme === "filiation") {
      ecarts.push(...ecartsFiliation(table, siennes));
    } else if (forme === "appartenance") {
      ecarts.push(...ecartsAppartenance(table, siennes, colonne));
    } else if (forme === "rattachement") {
      ecarts.push(...ecartsRattachement(table, siennes));
    } else if (forme === "adhésion") {
      ecarts.push(...ecartsAdhesion(table, siennes));
    } else if (forme === "héritage") {
      ecarts.push(...ecartsHeritage(table, siennes));
    } else if (forme === "ascendance") {
      ecarts.push(...ecartsAscendance(table, siennes));
    } else {
      ecarts.push(...ecartsSociete(table, forme, siennes, colonne));
    }
  }

  // Une politique `ALL` garde des DEUX côtés — `qual` et `with_check` —, et une
  // faute écrite dans les deux clauses produit deux fois le même message mot
  // pour mot. Un doublon n'ajoute aucune information et abîme le seul canal par
  // lequel l'alarme parle : un lecteur qui voit deux lignes identiques cherche
  // la différence entre elles. Deux écarts DISTINCTS restent distincts.
  return [...new Set(ecarts)];
}

/**
 * Rapport de journal — ce qui a été observé, avant tout verdict, et TABLE PAR
 * TABLE NOMMÉE.
 *
 * **Ce que le décompte seul ne disait pas.** Une première rédaction rendait
 * « 9 tables de la 1ʳᵉ catégorie : 6 société, 1 parc, 1 journal, 1 identité ».
 * Le verdict, lui, était déjà table par table — `ecartsPolitiques` confronte
 * chaque table à `formeAttendue(table)` et nomme le filtre perdu —, mais le
 * rapport ne permettait pas de s'en assurer, et il invitait à une lecture
 * fausse : croire que le décompte MESURE la conformité. Il ne la mesure pas, et
 * il ne peut pas la mesurer. **Le décompte porte sur la forme ATTENDUE, jamais
 * sur la forme observée** — `formeAttendue` lit `TABLES_PARC`, une liste close
 * du dépôt, que rien de ce qui se passe en base ne peut déplacer.
 *
 * *Mesuré le 06/09/2026, sur une base d'épreuve façonnée à l'identique de la
 * base hébergée : la politique « parc » de `client` remplacée à la main par une
 * clause société seule — la faute exacte que cette veille existe pour attraper,
 * puisqu'elle contourne le dépôt. Le décompte est resté « 1 parc », inchangé ;
 * le verdict est tombé en nommant `client` et le filtre `app.client_id` perdu,
 * et la veille est sortie en code 1. Le contrôle mordait ; c'est le rapport qui
 * ne le donnait pas à lire.*
 *
 * Le décompte reste — c'est le témoin de non-vacuité : une forme à zéro dit que
 * le contrôle n'a pas regardé ce qu'il croit regarder. Les noms s'y ajoutent,
 * parce qu'un décompte ne se vérifie pas et qu'un nom se vérifie.
 */
export function rapportPolitiques(
  colonnes: readonly ColonneSociete[],
  politiques: readonly PolitiqueObservee[],
): string {
  const premiereCategorie = tablesPremiereCategorie(colonnes);
  const parForme = new Map<Forme, string[]>();
  for (const colonne of premiereCategorie) {
    const forme = formeAttendue(colonne.table);
    parForme.set(forme, [...(parForme.get(forme) ?? []), colonne.table]);
  }

  const lignes = [...parForme.entries()].map(
    ([forme, tables]) =>
      `    ${forme.padEnd(11)} (${tables.length}) : ${[...tables].sort().join(", ")}`,
  );

  return [
    "Formes de politique RLS (observées dans pg_policies, non déclarées)",
    `  ${premiereCategorie.length} table(s) de la 1ʳᵉ catégorie de I1, chacune ` +
      "confrontée à SA forme attendue :",
    ...lignes,
    `  ${politiques.length} politique(s) lue(s) au total`,
    "",
  ].join("\n");
}

/**
 * LA ONZIÈME FORME — « héritage » (D93, ticket L8-01, 13/09/2026).
 *
 * *Un document est visible si sa CIBLE l'est, et la classe ne fait que
 * RÉTRÉCIR.* C'est la filiation de L1-04 avec deux différences, et ce sont
 * elles qui font l'arbitrage que L8-04 exigeait — « n'inventez pas une forme de
 * politique de plus ; une forme de plus est un arbitrage, jamais un effet de
 * bord » :
 *
 *   1. **La cible est POLYMORPHE.** `document` a deux parents possibles et
 *      exactement un des deux renseigné (`num_nonnulls(...) = 1`). La forme
 *      « filiation » n'en connaît qu'un, et lui en donner deux en silence
 *      aurait été l'effet de bord que le ticket refuse.
 *   2. **La classe RÉTRÉCIT.** `interne` disparaît pour un compte portail —
 *      `app.client_id` posée. C'est un axe de RESTRICTION, jamais un axe
 *      d'accès : il n'ouvre rien à personne.
 *
 * `cibles` énumère les couples parent/clé. **La clause doit nommer les DEUX**,
 * chacun joint sur SA colonne : une clause qui n'en nommerait qu'un rendrait
 * l'autre moitié des documents invisible — ce qui ne casse rien de visible, la
 * liste se raccourcissant en silence.
 *
 * **Liste close, gardée dans les deux sens.** Le RETRAIT est ici le geste
 * dangereux : `document` retomberait sur la forme « société », et un compte
 * portail restreint à un site lirait la notice d'un modèle qu'il ne possède
 * pas — c'est-à-dire apprendrait ce que les autres sites exploitent.
 */
export const TABLES_HERITAGE = [
  {
    table: "document",
    cibles: [
      { parent: "machine", cle: "machine_id" },
      { parent: "modele_materiel", cle: "modele_id" },
    ],
    /** La colonne qui RÉTRÉCIT, et la valeur qui survit au portail. */
    classe: { colonne: "classe", ouverte: "client" },
  },
] as const;

/** Les entrées que l'arbitrage D93 autorise. Recopiées : c'est la doctrine. */
const HERITAGE_ARBITRE = ["document"];

/** Écarts de la liste « héritage » — additions comme retraits. */
export function ecartsListeHeritage(
  liste: readonly string[] = TABLES_HERITAGE.map((entree) => entree.table),
): string[] {
  const ecarts = liste
    .filter((table) => !HERITAGE_ARBITRE.includes(table))
    .map(
      (table) =>
        `« ${table} » a été rangée sous la forme « héritage ». Elle ne vaut ` +
        "que pour une table dont la CIBLE est polymorphe et dont une colonne " +
        "de classe RÉTRÉCIT l'accès du portail — `document` (D93). Une table " +
        "à parent unique relève de « filiation », et une table qui DONNE " +
        "accès au parc de « habilitation ». Toute addition est un arbitrage.",
    );

  for (const arbitree of HERITAGE_ARBITRE) {
    if (!liste.includes(arbitree)) {
      ecarts.push(
        `« ${arbitree} » ne figure plus sous la forme « héritage » : elle ` +
          "retomberait sur la clause de société seule, qui PASSE tous les " +
          "gardiens, et un compte portail restreint à un site lirait la " +
          "documentation d'un modèle absent de son site — c'est-à-dire " +
          "apprendrait ce que les autres sites exploitent. Le RETRAIT est ici " +
          "le geste dangereux : il ne casse rien de visible.",
      );
    }
  }

  return ecarts;
}

/**
 * Écarts de la forme « héritage » : les DEUX cibles, et le rétrécissement.
 *
 * Trois exigences, et la troisième est celle qu'on oublie : la clause ne doit
 * PAS s'ancrer sur `societe_id`. Cet ancrage serait une seconde source du même
 * fait (§9, 01/09) — la clé étrangère composite le tient déjà — et il donnerait
 * l'illusion d'un cloisonnement là où c'est la sous-requête qui cloisonne.
 */
function ecartsHeritage(
  table: string,
  politiques: readonly PolitiqueObservee[],
): string[] {
  const entree = TABLES_HERITAGE.find((candidate) => candidate.table === table);
  if (entree === undefined) {
    return [];
  }

  const ecarts: string[] = [];
  for (const politique of politiques) {
    for (const clause of clausesGardiennes(politique)) {
      const normalisee = normaliser(clause).toLowerCase();

      for (const cible of entree.cibles) {
        if (
          !normalisee.includes("exists") ||
          !normalisee.includes(cible.parent) ||
          !normalisee.includes(cible.cle)
        ) {
          ecarts.push(
            entete(table, "héritage") +
              `la politique « ${politique.nom} » ne s'adosse pas à sa cible ` +
              `« ${cible.parent} » par sa clé « ${cible.cle} ». La forme ` +
              "attendue nomme les DEUX cibles, chacune jointe sur SA " +
              "colonne : `EXISTS (SELECT 1 FROM " +
              `${cible.parent} WHERE ${cible.parent}.id = ${table}.${cible.cle})\`. ` +
              "Une clause qui n'en nomme qu'une rend l'autre moitié des " +
              "documents invisible — et la liste se raccourcit en silence.",
          );
        }
      }

      if (
        !normalisee.includes(entree.classe.colonne) ||
        !normalisee.includes(entree.classe.ouverte) ||
        !filtreClient(clause)
      ) {
        ecarts.push(
          entete(table, "héritage") +
            `la politique « ${politique.nom} » ne RÉTRÉCIT pas par ` +
            `« ${entree.classe.colonne} ». Sans la branche ` +
            `\`${entree.classe.colonne} = '${entree.classe.ouverte}' OR app.client_id IS NULL\`, ` +
            "un compte portail lit les documents INTERNES de ses propres " +
            "machines — un rapport d'expertise, une note de litige. La classe " +
            "est le seul axe que L8-04 autorise, et il ne fait que retirer.",
        );
      }

      if (ancre(clause, "societe_id")) {
        ecarts.push(
          entete(table, "héritage") +
            `la politique « ${politique.nom} » s'ancre en plus sur ` +
            "`societe_id = app.societe_id`. C'est une SECONDE source du même " +
            "fait (§9, 01/09) : la clé étrangère composite le tient déjà, et " +
            "deux lectures d'un même critère divergent en silence. Pire, elle " +
            "donne l'illusion que le cloisonnement vient de là, alors qu'il " +
            "vient tout entier de la sous-requête.",
        );
      }

      if (ouvertureTotale(clause) || roleEditeur(clause)) {
        ecarts.push(
          entete(table, "héritage") +
            `la politique « ${politique.nom} » porte la forme « référentiel ». ` +
            "C'est la forme qui NE s'applique JAMAIS à une table métier.",
        );
      }
    }
  }
  return ecarts;
}

/**
 * LA DOUZIÈME FORME — « ascendance » (D93, ticket L8-01, 13/09/2026).
 *
 * *Un parent est visible si l'un de ses ENFANTS l'est* — pour un compte portail
 * et pour lui seul. C'est l'INVERSE exact de la filiation, et c'est pourquoi ce
 * n'est pas la même forme : la filiation propage vers le bas une visibilité
 * déjà acquise, l'ascendance REFUSE vers le haut une visibilité que la clause
 * de société donnait.
 *
 * **La décision d'exploitation du 13/09/2026 :** un compte de portail ne voit
 * les documents d'un modèle que si une machine de ce modèle se trouve dans son
 * propre périmètre. *Sinon la présence d'une notice révèle la composition du
 * parc des autres sites : un compte restreint à Ducos déduirait ce que Koné
 * possède, et le cloisonnement fuirait par la liste des documents au lieu de
 * fuir par les données — et il fuirait quand même.*
 *
 * **Le DISCRIMINANT est `app.client_id`**, comme dans la forme « habilitation »
 * et pour la même raison : la restriction ne vise que le compte portail. Un
 * utilisateur interne garde la clause de société seule — sans quoi créer un
 * modèle avant sa première machine serait impossible, la table se refusant à
 * elle-même.
 *
 * **Liste close, gardée dans les deux sens.** Le RETRAIT fait retomber la table
 * sur la forme « société », qui passe tous les gardiens et rouvre la fuite.
 */
export const TABLES_ASCENDANCE = [
  { table: "modele_materiel", enfant: "machine", cle: "modele_id" },
  { table: "famille_materiel", enfant: "modele_materiel", cle: "famille_id" },
] as const;

/** Les entrées que l'arbitrage D93 autorise. Recopiées : c'est la doctrine. */
const ASCENDANCE_ARBITREE = ["modele_materiel", "famille_materiel"];

/** Écarts de la liste « ascendance » — additions comme retraits. */
export function ecartsListeAscendance(
  liste: readonly string[] = TABLES_ASCENDANCE.map((entree) => entree.table),
): string[] {
  const ecarts = liste
    .filter((table) => !ASCENDANCE_ARBITREE.includes(table))
    .map(
      (table) =>
        `« ${table} » a été rangée sous la forme « ascendance ». Elle ne vaut ` +
        "que pour une table dont la seule existence d'une ligne apprendrait à " +
        "un compte portail ce que les autres sites de sa société exploitent " +
        "(D93). Toute addition est un arbitrage — et elle a un coût, celui de " +
        "rendre la table invisible au portail tant qu'aucun enfant ne l'est.",
    );

  for (const arbitree of ASCENDANCE_ARBITREE) {
    if (!liste.includes(arbitree)) {
      ecarts.push(
        `« ${arbitree} » ne figure plus sous la forme « ascendance » : elle ` +
          "retomberait sur la clause de société SEULE, qui passe tous les " +
          "gardiens sans rien dire, et un compte portail restreint à un site " +
          "énumérerait le matériel de toute la société. Le RETRAIT est ici le " +
          "geste dangereux — il ne casse rien de visible.",
      );
    }
  }

  return ecarts;
}

/**
 * Écarts de la forme « ascendance » : l'ancrage société, le discriminant, et
 * l'existence d'un enfant.
 *
 * L'ancrage société est ici EXIGÉ — à l'inverse de « héritage » —, parce que
 * `modele_materiel` et `famille_materiel` sont des tables métier ORDINAIRES qui
 * portent leur `societe_id` : la sous-requête ne remplace pas leur
 * cloisonnement, elle le rétrécit pour le seul compte portail.
 */
function ecartsAscendance(
  table: string,
  politiques: readonly PolitiqueObservee[],
): string[] {
  const entree = TABLES_ASCENDANCE.find(
    (candidate) => candidate.table === table,
  );
  if (entree === undefined) {
    return [];
  }

  const ecarts: string[] = [];
  for (const politique of politiques) {
    for (const clause of clausesGardiennes(politique)) {
      const normalisee = normaliser(clause).toLowerCase();

      if (ouvertureTotale(clause) || roleEditeur(clause)) {
        ecarts.push(
          entete(table, "ascendance") +
            `la politique « ${politique.nom} » porte la forme « référentiel ». ` +
            "C'est la forme qui NE s'applique JAMAIS à une table métier — et " +
            "sur celle-ci elle rendrait le catalogue entier lisible au portail.",
        );
        continue;
      }

      if (!ancre(clause, "societe_id")) {
        ecarts.push(
          entete(table, "ascendance") +
            `la politique « ${politique.nom} » n'est pas ancrée sur ` +
            "`societe_id = app.societe_id`. L'ascendance RÉTRÉCIT le " +
            "cloisonnement de société pour le compte portail ; elle ne le " +
            "remplace pas.",
        );
      }

      if (!filtreClient(clause)) {
        ecarts.push(
          entete(table, "ascendance") +
            `la politique « ${politique.nom} » ne lit pas \`app.client_id\`. ` +
            "C'est le DISCRIMINANT qui distingue un compte portail d'un " +
            "utilisateur interne : sans lui, ou bien la restriction ne mord " +
            "sur personne, ou bien elle rend impossible la création d'un " +
            "modèle avant sa première machine.",
        );
      }

      if (
        !normalisee.includes("exists") ||
        !normalisee.includes(entree.enfant) ||
        !normalisee.includes(entree.cle)
      ) {
        ecarts.push(
          entete(table, "ascendance") +
            `la politique « ${politique.nom} » ne s'adosse pas à son enfant ` +
            `« ${entree.enfant} » par sa clé « ${entree.cle} ». La forme ` +
            "attendue est `EXISTS (SELECT 1 FROM " +
            `${entree.enfant} WHERE ${entree.enfant}.${entree.cle} = ${table}.id)\` — ` +
            "la visibilité de l'enfant remonte alors sans qu'aucun filtre soit " +
            "réécrit. Sans elle, un compte portail énumère le matériel de " +
            "toute sa société et en déduit ce que les autres sites exploitent.",
        );
      }
    }
  }
  return ecarts;
}

/**
 * Une table du schéma, et les tables qu'elle référence par clé étrangère.
 * Fournie par le lecteur de schéma Prisma — ce module ne lit rien lui-même.
 */
export type TableEtParents = {
  readonly table: string;
  readonly parents: readonly string[];
};

/**
 * LE CRITÈRE DE LA SIXIÈME FORME — la première table fille réelle d'une table
 * du parc.
 *
 * *Voir l'en-tête de ce module, section « la forme filiation ».* Le principe est
 * tranché, la forme n'est pas construite, et **ce contrôle est ce qui
 * l'appellera** : une borne qui porte sa condition plutôt qu'une date (§9,
 * 01/09). Tant qu'aucune fille n'existe, il ne demande rien.
 *
 * **La population part du SCHÉMA, jamais d'une liste.** C'est la clé étrangère
 * qui dit qui est le parent : une table fille créée demain est reconnue le jour
 * où elle est écrite, sans qu'aucune liste soit à compléter. Une table du parc
 * qui en référence une autre n'en est pas une fille au sens de cette forme —
 * `site` référence `client`, et les deux portent déjà « parc ».
 */
/**
 * LA SIXIÈME FORME, CONSTRUITE AU TICKET L1-04 — « filiation ».
 *
 * *Une fille est visible si son parent l'est.* Le principe était tranché depuis
 * L1-02 et la forme délibérément NON construite : le critère qui l'appelait
 * était **la première table fille réelle d'une table du parc**, une borne qui
 * porte sa condition plutôt qu'une date. `site_habilitation_requise` est cette
 * table.
 *
 * `parent` et `cle` disent l'adossement : la clause s'écrit
 * `EXISTS (SELECT 1 FROM <parent> WHERE <parent>.id = <fille>.<cle>)`, et rien
 * d'autre. **Aucune clause de société n'y est ajoutée**, et c'est une décision :
 * elle serait redondante avec celle que le parent porte déjà, donc une seconde
 * source du même fait (§9, 01/09). Ce qui empêche une fille de dériver de la
 * société de son parent n'est pas une clause mais la clé étrangère composite,
 * contrôlée par la base et exempte de RLS par construction.
 *
 * **Liste close, gardée dans les deux sens** — comme `TABLES_PARC`, et pour la
 * même raison : c'est le RETRAIT qui ouvre la brèche. Une fille qui perdrait
 * cette forme retomberait sur « société », et un compte portail restreint au
 * site S1 lirait les lignes filles du site S2.
 */
export const TABLES_FILIATION = [
  { table: "site_habilitation_requise", parent: "site", cle: "site_id" },
] as const;

/** Les entrées que l'arbitrage autorise. Recopiées : c'est la doctrine. */
const FILIATION_ARBITREE = ["site_habilitation_requise"];

/** Écarts de la liste « filiation » — additions comme retraits. */
export function ecartsListeFiliation(
  liste: readonly string[] = TABLES_FILIATION.map((entree) => entree.table),
): string[] {
  const ecarts = liste
    .filter((table) => !FILIATION_ARBITREE.includes(table))
    .map(
      (table) =>
        `« ${table} » a été rangée sous la forme « filiation ». Elle ne vaut ` +
        "que pour une table FILLE d'une table du parc — une donnée du parc " +
        "dont la visibilité doit suivre celle de son parent. Une table qui " +
        "DONNE accès au parc relève de la forme « habilitation », jamais de " +
        "celle-ci : l'y ranger serait circulaire.",
    );

  for (const arbitree of FILIATION_ARBITREE) {
    if (!liste.includes(arbitree)) {
      ecarts.push(
        `« ${arbitree} » ne figure plus sous la forme « filiation » : elle ` +
          "retomberait sur la clause de société seule, et un compte portail " +
          "restreint au site S1 lirait les exigences du site S2 du même " +
          "client. Le RETRAIT est ici le geste dangereux — il ne casse rien " +
          "de visible.",
      );
    }
  }

  return ecarts;
}

/**
 * Écarts de la forme « filiation » : la clause doit s'adosser au PARENT.
 *
 * Deux exigences, et la seconde est celle qu'on oublie : la sous-requête nomme
 * le parent ET la clé étrangère de la fille. Une clause qui nommerait le parent
 * sans le joindre sur la bonne colonne serait vraie dès qu'un seul parent
 * existe — c'est-à-dire toujours.
 */
function ecartsFiliation(
  table: string,
  politiques: readonly PolitiqueObservee[],
): string[] {
  const entree = TABLES_FILIATION.find(
    (candidate) => candidate.table === table,
  );
  if (entree === undefined) {
    return [];
  }

  const ecarts: string[] = [];
  for (const politique of politiques) {
    for (const clause of clausesGardiennes(politique)) {
      // MINUSCULES : `pg_policies` rend `EXISTS` en capitales, et la première
      // rédaction cherchait `exists`. Le gardien rougissait sur une clause
      // JUSTE — c'est la « graphie » du §9 (26/08), rencontrée du côté du
      // lecteur cette fois, et attrapée par son propre scénario.
      const normalisee = normaliser(clause).toLowerCase();
      if (
        !normalisee.includes("exists") ||
        !normalisee.includes(entree.parent) ||
        !normalisee.includes(entree.cle)
      ) {
        ecarts.push(
          entete(table, "filiation") +
            `la politique « ${politique.nom} » ne s'adosse pas à son parent ` +
            `« ${entree.parent} » par sa clé « ${entree.cle} ». La forme ` +
            "attendue est `EXISTS (SELECT 1 FROM " +
            `${entree.parent} WHERE ${entree.parent}.id = ${table}.${entree.cle})\` — ` +
            "la visibilité du parent se propage alors sans qu'aucun filtre soit " +
            "réécrit. Une clause de société seule laisserait un compte portail " +
            "restreint à un site lire les lignes filles d'un autre.",
        );
      }
      if (ouvertureTotale(clause) || roleEditeur(clause)) {
        ecarts.push(
          entete(table, "filiation") +
            `la politique « ${politique.nom} » porte la forme « référentiel ». ` +
            "C'est la forme qui NE s'applique JAMAIS à une table métier.",
        );
      }
    }
  }
  return ecarts;
}

/**
 * Les tables rattachées au parc dont la question N'EST PAS celle de la
 * filiation. Liste close, justifiée, et gardée des deux côtés.
 *
 * **Une seule entrée, et c'est le critère lui-même qui l'a trouvée** — elle
 * n'a pas été prévue. `utilisateur_client` a reçu au ticket L1-02 sa clé
 * étrangère vers `client` (D56 en est voisin, la décision est de L1-02), et le
 * contrôle l'a aussitôt signalée comme première table fille du parc.
 *
 * Elle n'en est pas une **au sens de cette forme**, et la distinction est de
 * fond, pas de commodité. La filiation dit : *une donnée du parc est visible si
 * son parent l'est.* `utilisateur_client` n'est pas une donnée du parc — c'est
 * l'HABILITATION qui donne accès au parc, celle-là même dont la politique tire
 * `app.client_id`. La faire hériter de la visibilité de son client serait
 * circulaire.
 *
 * **Sa vraie question est autre, et elle est ouverte** : sous la forme
 * « société » qu'elle porte, un compte portail du client A peut lire la ligne
 * d'habilitation d'un compte du client B de la même société. Ce n'est pas la
 * filiation, c'est `utilisateur_id = <le compte courant>` — et cela précède ce
 * ticket : la table portait déjà `client_id` et cette politique. La clé
 * étrangère n'a rien ouvert, elle a rendu la question VISIBLE. Portée au
 * registre des arbitrages.
 */
export const RATTACHEES_HORS_FILIATION = [
  "utilisateur_client",
  "utilisateur_client_site",
] as const;

/**
 * Les entrées que l'arbitrage autorise. Recopiées : c'est la doctrine.
 *
 * **La seconde est RATIFIÉE par l'exploitation le 07/09/2026**, et la façon
 * dont elle l'a été est ce que la liste close existe pour produire. Le ticket
 * L1-02b l'a ajoutée en appliquant la décision de sa table mère ; la session
 * a REFUSÉ de la tenir pour acquise et l'a portée au registre, la liste
 * disant « toute addition passe par un arbitrage » ; l'exploitation a
 * répondu : *`utilisateur_client_site` est une habilitation, pas une donnée
 * du parc, exactement comme sa table mère.* **Le mécanisme a fonctionné comme
 * prévu — la liste a exigé qu'on la regarde**, et c'est tout ce qu'une liste
 * close sait faire de bien.
 * `utilisateur_client_site` référence `site`, qui est du parc : le critère la
 * réclamerait comme table fille. Elle n'en est pas une, exactement pour la
 * raison écrite ci-dessus — c'est une HABILITATION, pas une donnée du parc, et
 * la faire hériter de la visibilité d'un site serait circulaire au carré : le
 * site n'est visible que si `app.perimetre_sites` le nomme, et
 * `app.perimetre_sites` est calculée en lisant cette table.
 *
 * Les deux portent la forme « habilitation », la sixième, qui est la réponse à
 * leur vraie question — celle que le commentaire ci-dessus laissait ouverte.
 */
const HORS_FILIATION_ARBITREES = [
  "utilisateur_client",
  "utilisateur_client_site",
];

/**
 * Écarts de la liste ci-dessus — additions comme retraits, sur le modèle de
 * `ecartsListeParc` et de `ecartsListeHorsDomaine`.
 *
 * L'addition est le geste dangereux ici : y ranger une table ferait taire le
 * critère sur une vraie table fille, ce qui est exactement ce qu'il existe pour
 * empêcher.
 */
export function ecartsListeRattachees(
  liste: readonly string[] = RATTACHEES_HORS_FILIATION,
): string[] {
  const ecarts = liste
    .filter((table) => !HORS_FILIATION_ARBITREES.includes(table))
    .map(
      (table) =>
        `« ${table} » a été rangée hors de la filiation : c'est le geste qui ` +
        "fait taire le critère sur une vraie table fille. Toute addition passe " +
        "par un arbitrage, elle ne se décide pas dans un ticket.",
    );

  for (const attendue of HORS_FILIATION_ARBITREES) {
    if (!liste.includes(attendue)) {
      ecarts.push(
        `« ${attendue} » ne figure plus hors de la filiation : le critère la ` +
          "réclamerait comme table fille, alors que sa question est celle de " +
          "l'habilitation et non celle de la visibilité héritée.",
      );
    }
  }

  return ecarts;
}

export function ecartsTablesFilles(
  observees: readonly TableEtParents[],
  horsFiliation: readonly string[] = RATTACHEES_HORS_FILIATION,
): string[] {
  if (observees.length === 0) {
    return [
      "aucune table observée : le critère de la forme « filiation » n'a rien " +
        "établi. Schéma vide, ou lecture jouée hors du schéma attendu.",
    ];
  }

  const parc: readonly string[] = TABLES_PARC.map((entree) => entree.table);
  // Celles qui PORTENT déjà la forme sortent du message : il appelle la forme,
  // il ne la réclame pas deux fois. Leur clause est jugée par `ecartsFiliation`,
  // et leur liste est close dans les deux sens par `ecartsListeFiliation` — le
  // périmètre n'est donc pas rétréci, il est déplacé vers un contrôle plus
  // exigeant.
  // La forme « héritage » (D93) est PLUS exigeante que la filiation sur les
  // mêmes tables : elle réclame les DEUX cibles polymorphes ET le
  // rétrécissement par la classe. `document` est fille de `machine` par sa clé
  // étrangère, donc le critère ci-dessous l'atteint ; la réclamer sous
  // « filiation » ferait réclamer MOINS que ce qu'elle porte. Sa liste est
  // close dans les deux sens par `ecartsListeHeritage`.
  const construites: readonly string[] = [
    ...TABLES_FILIATION.map((entree) => entree.table),
    ...TABLES_HERITAGE.map((entree) => entree.table),
  ];

  return [
    ...ecartsListeRattachees(horsFiliation),
    ...ecartsListeFiliation(),
    ...observees
      .filter(
        (observee) =>
          !parc.includes(observee.table) &&
          !horsFiliation.includes(observee.table) &&
          !construites.includes(observee.table) &&
          observee.parents.some((parent) => parc.includes(parent)),
      )
      .map((observee) => {
        const parents = observee.parents.filter((parent) =>
          parc.includes(parent),
        );
        return (
          `« ${observee.table} » est la PREMIÈRE table fille d'une table du ` +
          `parc (${parents.join(", ")}), et le critère de la forme « filiation » de ` +
          "politique est donc atteint. Elle ne prend NI la forme « société » — " +
          "qui laisserait un compte portail restreint à un site lire les lignes " +
          "filles d'un autre —, NI la forme « parc », qu'elle ne peut pas porter " +
          "sans dupliquer un rattachement que sa clé étrangère tient déjà. Le " +
          "principe est tranché depuis L1-02 : une fille est visible si son " +
          "parent l'est, par une clause adossée à sa clé étrangère " +
          "(`EXISTS (SELECT 1 FROM <parent> …)`). Son coût est mesuré et écrit " +
          "en tête de ce module. Construire la forme, l'ajouter à `Forme` et à " +
          "`RAPPEL_FORMES`, puis retirer cette table de ce message. La forme " +
          "« habilitation » de L1-02b n'est PAS celle-là : elle répond à « qui " +
          "est ce compte », celle-ci répond à « son parent est-il visible »."
        );
      }),
  ];
}
