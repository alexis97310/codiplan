import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

/**
 * QUELLE FONCTION DE DÉPÔT UN HUMAIN PEUT-IL ATTEINDRE ? (R3-12)
 *
 * ## Ce que ce module répare
 *
 * Les marques `LIVRÉ` du backlog ont été posées sur trois preuves : *la prose du
 * ticket, **l'existence du module dans `lib/`**, et l'existence de la table en
 * base.* **Les trois prouvent qu'une COUCHE a été écrite ; aucune ne prouve
 * qu'un humain l'atteigne.** L1-01 l'a montré en acte : « Clients — CRUD,
 * recherche » était `LIVRÉ`, relu contre ses sources le 11/09, avec **zéro route
 * et zéro écran**.
 *
 * Et le cas se répète : neuf modules n'étaient atteints par aucun chemin, et des
 * fonctions d'écriture dormaient à l'intérieur de modules pourtant atteints —
 * `absences` en était le cas net, lu pour le dénominateur du taux d'occupation
 * et **incapable de recevoir une déclaration**.
 *
 * ## La population se DÉRIVE du dépôt, jamais d'une liste
 *
 * Tout fichier `lib/<domaine>/depot*.ts` est un module de dépôt, et toute
 * fonction qu'il exporte entre dans le contrôle **le jour où elle est écrite**.
 * C'est le périmètre inversé de D55 appliqué non plus à l'audit mais aux
 * chemins : *une liste d'admis tenue à la main oublie, par construction, la
 * fonction que personne n'y a ajoutée.*
 *
 * ## CE QU'IL NE PROUVE PAS, et c'est écrit plutôt que tu
 *
 * Il prouve qu'un chemin **existe dans le code**, jamais qu'il est **trouvable
 * par un humain** — c'est la limite que `atteignabilite-ecrans.ts` annonce déjà,
 * et elle vaut ici pour la même raison. Il ne voit pas non plus un appel
 * construit à l'exécution : `depot[nom]()` lui échappe, et c'est la forme 6 du
 * §9 (26/08), qu'aucun motif statique n'arrête.
 *
 * **Et il ne dit RIEN de la qualité du chemin** : une fonction appelée depuis un
 * écran mort compte comme atteinte. *Ce qu'il rend lisible est l'absence TOTALE
 * de chemin, qui est le défaut mesuré — pas la qualité du chemin, qui ne se
 * mesure pas.*
 */

/**
 * La racine du dépôt.
 *
 * `process.cwd()` plutôt que `import.meta.url` : **Vitest sert les sources
 * derrière un préfixe `/@fs/`**, si bien qu'un chemin dérivé de l'URL du module
 * n'existe pas sur le disque — *mesuré ici même, `ENOENT … scandir
 * '/@fs/…/app'`.* Les deux commandes qui lisent ce module s'exécutent depuis la
 * racine, c'est la convention du dépôt (`file-de-nuit.ts` fait de même).
 */
const RACINE = resolve(process.cwd());

/** Les répertoires où un chemin peut passer. `tests/` n'en est pas un. */
const REPERTOIRES = ["app", "components", "lib"];

const EXTENSIONS = [".ts", ".tsx"];

function parcourir(repertoire: string, trouves: string[]): void {
  for (const entree of readdirSync(repertoire)) {
    const chemin = join(repertoire, entree);
    if (statSync(chemin).isDirectory()) {
      parcourir(chemin, trouves);
    } else if (EXTENSIONS.some((ext) => chemin.endsWith(ext))) {
      trouves.push(chemin);
    }
  }
}

/** Tous les fichiers source des trois répertoires, en chemins relatifs. */
export function fichiersDuDepot(): readonly string[] {
  const trouves: string[] = [];
  for (const repertoire of REPERTOIRES) {
    parcourir(join(RACINE, repertoire), trouves);
  }
  return trouves.map((chemin) => relative(RACINE, chemin)).sort();
}

/** Le contenu d'un fichier du dépôt. */
export function lire(chemin: string): string {
  return readFileSync(join(RACINE, chemin), "utf8");
}

/**
 * Le fichier qu'une spécification d'import DÉSIGNE, ou `null`.
 *
 * Les deux formes sont résolues : l'alias `@/` du `tsconfig`, et le chemin
 * relatif. **Un répertoire est résolu par son `index`** — le dépôt en a un
 * (`lib/calendar`), et l'oublier aurait coupé l'arbre à cet endroit précis,
 * silencieusement.
 */
export function resoudre(depuis: string, specification: string): string | null {
  const base = specification.startsWith("@/")
    ? specification.slice(2)
    : specification.startsWith(".")
      ? relative(RACINE, resolve(RACINE, dirname(depuis), specification))
      : null;
  if (base === null) {
    return null;
  }
  for (const candidat of [
    ...EXTENSIONS.map((ext) => `${base}${ext}`),
    ...EXTENSIONS.map((ext) => `${base}/index${ext}`),
  ]) {
    try {
      if (statSync(join(RACINE, candidat)).isFile()) {
        return candidat;
      }
    } catch {
      // Le candidat n'existe pas : on essaie le suivant.
    }
  }
  return null;
}

const IMPORT = /from\s+["']([^"']+)["']/g;

/** Les fichiers du dépôt qu'un source importe. */
export function importesPar(chemin: string, source: string): readonly string[] {
  const cibles = new Set<string>();
  for (const trouve of source.matchAll(IMPORT)) {
    const cible = resoudre(chemin, trouve[1] ?? "");
    if (cible !== null) {
      cibles.add(cible);
    }
  }
  return [...cibles];
}

/**
 * LA FERMETURE TRANSITIVE DEPUIS `app/`.
 *
 * C'est elle qui rend le contrôle juste : `lib/absences/periode.ts` n'est
 * importé par aucun écran, et il est pourtant atteint — par
 * `lib/interventions/depot.ts`, que les routes appellent. *Exiger un import
 * direct depuis `app/` aurait refusé un chemin qui existe* ; c'est le même
 * raisonnement que la fermeture transitive des écrans.
 */
export function fichiersAtteints(
  fichiers: readonly string[],
  sources: ReadonlyMap<string, string>,
): ReadonlySet<string> {
  const atteints = new Set<string>(
    fichiers.filter((chemin) => chemin.startsWith("app/")),
  );
  const aVisiter = [...atteints];
  while (aVisiter.length > 0) {
    const courant = aVisiter.pop() as string;
    for (const cible of importesPar(courant, sources.get(courant) ?? "")) {
      if (!atteints.has(cible)) {
        atteints.add(cible);
        aVisiter.push(cible);
      }
    }
  }
  return atteints;
}

/** Un module de dépôt : `lib/<domaine>/depot*.ts`. */
export function estModuleDeDepot(chemin: string): boolean {
  return /^lib\/[^/]+\/depot[^/]*\.ts$/.test(chemin);
}

const EXPORT_FONCTION = /export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/g;

/** Les fonctions qu'un module exporte. */
export function fonctionsExportees(source: string): readonly string[] {
  return [...source.matchAll(EXPORT_FONCTION)].map((t) => t[1] ?? "");
}

/** Ce qu'on sait d'une fonction de dépôt. */
export type FonctionDeDepot = {
  readonly module: string;
  readonly fonction: string;
  /** Les fichiers ATTEINTS qui l'appellent. Vide = aucun chemin. */
  readonly appelants: readonly string[];
};

/**
 * L'ÉTAT DES CHEMINS, MESURÉ SUR LE DÉPÔT.
 *
 * Un appelant est un fichier **atteint depuis `app/`** qui **importe** le module
 * ET **nomme** la fonction suivie d'une parenthèse. *L'import seul ne suffit
 * pas* — un module s'importe pour une autre de ses fonctions —, et le nom seul
 * non plus : deux modules peuvent exporter le même nom, et c'est déjà arrivé
 * dans ce dépôt (§9, 09/09).
 */
export function cheminsDesDepots(): readonly FonctionDeDepot[] {
  const fichiers = fichiersDuDepot();
  const sources = new Map(fichiers.map((chemin) => [chemin, lire(chemin)]));
  const atteints = fichiersAtteints(fichiers, sources);

  const resultat: FonctionDeDepot[] = [];
  for (const depot of fichiers.filter(estModuleDeDepot)) {
    for (const fonction of fonctionsExportees(sources.get(depot) ?? "")) {
      const appel = new RegExp(`\\b${fonction}\\s*\\(`);
      const appelants = [...atteints]
        .filter((chemin) => chemin !== depot)
        .filter((chemin) =>
          importesPar(chemin, sources.get(chemin) ?? "").includes(depot),
        )
        .filter((chemin) => appel.test(sources.get(chemin) ?? ""))
        .sort();
      resultat.push({ module: depot, fonction, appelants });
    }
  }
  return resultat;
}

/** L'état d'un module de `lib/` : est-il atteint, et par quoi ? */
export type ModuleDeLib = {
  /** `lib/<domaine>` — le répertoire, pas le fichier. */
  readonly module: string;
  /** Les fichiers de `app/` qui l'atteignent, directement ou de proche en proche. */
  readonly atteintPar: readonly string[];
};

/**
 * CHAQUE MODULE DE `lib/`, ET CE QUI L'ATTEINT.
 *
 * C'est la mesure qui a ouvert R3-12 — *neuf modules atteints par aucun chemin*
 * —, rendue par une commande plutôt que par un `grep` retapé à chaque fois.
 *
 * **Le module est le RÉPERTOIRE, pas le fichier** : `lib/absences` est atteint
 * dès que l'un de ses fichiers l'est, et c'est la bonne maille pour la question
 * posée — *« ce domaine a-t-il un chemin »*. La maille fine, celle des fonctions
 * de dépôt, est au-dessus : `absences` était atteint et pourtant personne ne
 * pouvait déclarer une absence.
 */
export function cheminsDesModules(): readonly ModuleDeLib[] {
  const fichiers = fichiersDuDepot();
  const sources = new Map(fichiers.map((chemin) => [chemin, lire(chemin)]));
  const atteints = fichiersAtteints(fichiers, sources);

  const modules = new Map<string, Set<string>>();
  for (const chemin of fichiers.filter((f) => f.startsWith("lib/"))) {
    const domaine = chemin.split("/").slice(0, 2).join("/");
    if (!modules.has(domaine)) {
      modules.set(domaine, new Set());
    }
    if (!atteints.has(chemin)) {
      continue;
    }
    // CE QUI L'ATTEINT, et non « il est atteint » : *un décompte se lit en
    // trois secondes et ne se vérifie pas ; un nom se vérifie* (§9, 06/09).
    for (const source of fichiers.filter((f) => f.startsWith("app/"))) {
      if (importesPar(source, sources.get(source) ?? "").includes(chemin)) {
        modules.get(domaine)?.add(source);
      }
    }
    // Atteint de proche en proche : aucun fichier de `app/` ne le nomme, et le
    // module l'est quand même. On le dit plutôt que de rendre une liste vide,
    // qui se lirait « orphelin ».
    if (modules.get(domaine)?.size === 0) {
      modules.get(domaine)?.add(INDIRECT);
    }
  }
  return [...modules]
    .map(([domaine, atteignants]) => ({
      module: domaine,
      atteintPar: [...atteignants].sort(),
    }))
    .sort((a, b) => a.module.localeCompare(b.module));
}

/** Marque d'un module atteint sans qu'aucun fichier de `app/` le nomme. */
export const INDIRECT = "(de proche en proche)";

/**
 * LES MODULES DE `lib/` QU'AUCUN CHEMIN N'ATTEINT — liste close, gardée dans
 * les deux sens.
 *
 * **Elle est le compte rendu de la mesure du 14/09/2026**, tenue à jour par le
 * gardien plutôt que par la mémoire : un module qui gagne un chemin doit sortir
 * de cette liste, un module qui en perd un doit y entrer. *Ce qui compte n'est
 * pas sa taille : c'est qu'elle ne bouge pas sans qu'on le décide.*
 */
export const MODULES_SANS_CHEMIN: readonly {
  readonly module: string;
  readonly motif: string;
}[] = [
  {
    module: "lib/compteurs",
    motif:
      "Un relevé se saisit sur le terrain (L2-03) : il suppose l'application technicien du lot 3, et rien d'autre ne le produit.",
  },
  {
    module: "lib/courriel",
    motif:
      "Le canal d'envoi est appelé par un SCRIPT — l'amorçage du premier compte —, jamais par un écran. *Un chemin qui passe par une commande d'exploitation est un chemin*, et il n'entre pas dans cette mesure, qui part de `app/`. Ouvert par la première notification déclenchée depuis un écran.",
  },
  {
    module: "lib/reporting",
    motif:
      "La consolidation est du lot 5, et elle n'a AUCUN appelant par décision : c'est la seule zone autorisée à convertir des devises (I2), et son rôle de base porte un secret distinct qui n'existe pas encore (D38).",
  },
];

/**
 * **La mesure du 14/09/2026 en nommait NEUF**, et il n'en reste que quatre : la
 * liste n'a pas été corrigée, *le dépôt a bougé entre-temps.* `contacts`,
 * `excel`, `materiel` et `prestations` ont reçu un chemin avec l'écran d'import
 * (L1-11), les écrans clients (L1-01 rouvert) et le catalogue (R3-15) ;
 * `imports` aussi. **C'est exactement ce qu'un contrôle mesuré apporte sur une
 * liste écrite à la main : elle vieillit, et il ne vieillit pas.**
 */

/** Une exemption : une fonction sans chemin, et la raison écrite. */
export type SansChemin = {
  readonly module: string;
  readonly fonction: string;
  readonly motif: string;
};

/**
 * LES FONCTIONS DE DÉPÔT QU'AUCUN CHEMIN N'ATTEINT, ET LE MOTIF DE CHACUNE.
 *
 * **La liste naît longue, et c'est la vérité.** Ce qui compte n'est pas sa
 * taille : c'est qu'elle ne puisse plus **grandir en silence** — une fonction
 * écrite demain sans appelant fait rougir le gardien — et qu'elle ne puisse pas
 * **rétrécir** sans qu'un appelant existe réellement.
 *
 * **Un motif n'est pas une excuse, c'est une ÉCHÉANCE.** Il dit par quel travail
 * le chemin arrivera, ou pourquoi il n'en viendra jamais. *« C'est normal »
 * n'est pas un motif* : cela ne se vérifie pas, et cela ne se retire jamais.
 *
 * **Et une entrée dont la fonction A un appelant fait ÉCHOUER le gardien.** Une
 * exemption qui ne protège plus rien est le trou du §9 (31/08) : elle survit à
 * ce qu'elle exemptait, silencieusement, et le jour où une fonction du même nom
 * reviendra elle héritera d'une exemption que personne ne lui a accordée.
 */
export const FONCTIONS_SANS_CHEMIN: readonly SansChemin[] = [
  // ── LE LOT 1 A POSÉ DES RÉFÉRENTIELS QUE PERSONNE N'ÉCRIT ENCORE ─────────
  {
    module: "lib/clients/depot.ts",
    fonction: "supprimerClient",
    motif:
      "L1-01 rouvert a livré la liste, la fiche et la création ; la suppression n'a AUCUN écran et n'en aura peut-être jamais — un client référencé par une intervention ne se supprime pas. Se retire le jour où la désactivation remplace la suppression, ou le jour où un écran l'appelle.",
  },
  // ── LE LOT 2 A POSÉ LA DEMANDE ; SON ÉCRAN EST AU PORTAIL ────────────────
  {
    module: "lib/demandes/depot.ts",
    fonction: "deposerDemande",
    motif:
      "Le dépôt d'une demande est un parcours de PORTAIL (chapitre 9, P5), et le portail est en consultation seule (L2-12). Ouvert par l'écran de dépôt du portail.",
  },
  {
    module: "lib/demandes/depot.ts",
    fonction: "accuserReception",
    motif: "Même flux que `deposerDemande` — la demande n'a aucun écran.",
  },
  {
    module: "lib/demandes/depot.ts",
    fonction: "qualifierDemande",
    motif:
      "La qualification est le geste de l'ADV sur une demande reçue : elle suppose l'écran de la file des demandes, qui reste à écrire.",
  },
  {
    module: "lib/demandes/depot.ts",
    fonction: "marquerTransformee",
    motif: "Même écran que `qualifierDemande`.",
  },
  {
    module: "lib/demandes/depot.ts",
    fonction: "cloreSansSuite",
    motif: "Même écran que `qualifierDemande`.",
  },
  // ── LE LOT 8 A POSÉ LE BAC DE RÉCEPTION, SANS ÉCRAN ──────────────────────
  {
    module: "lib/documents/depot.ts",
    fonction: "recevoir",
    motif:
      "L8-07 a posé le bac de réception ; son écran n'existe pas, et le stockage d'objets qu'il suppose non plus (lot 8). Ouvert par l'écran du bac.",
  },
  {
    module: "lib/documents/depot.ts",
    fonction: "classer",
    motif: "Même écran que `recevoir`.",
  },
  {
    module: "lib/documents/depot.ts",
    fonction: "avancement",
    motif: "Même écran que `recevoir`.",
  },
  {
    module: "lib/documents/depot.ts",
    fonction: "prochainATraiter",
    motif: "Même écran que `recevoir`.",
  },
  {
    module: "lib/documents/depot.ts",
    fonction: "ecarter",
    motif: "Même écran que `recevoir`.",
  },
  // ── DES FONCTIONS DE LECTURE QUE L'ÉCRAN VOISIN N'APPELLE PAS ────────────
  {
    module: "lib/prestations/depot.ts",
    fonction: "lirePrestation",
    motif:
      "R3-15 a livré le catalogue en une page : la liste et les formulaires y tiennent, et aucune fiche isolée n'existe. Se retire le jour où une fiche de prestation est écrite, ou la fonction avec elle.",
  },
  {
    module: "lib/clients/depot.ts",
    fonction: "lireClient",
    motif:
      "La fiche d'un client lit par `dernieresInterventionsDuClient` et par la requête de sa page ; cette lecture-ci a été posée par L1-01 avant que la fiche existe. Se retire avec elle, ou le jour où la fiche l'appelle.",
  },
  // `sitesParClient` a QUITTÉ cette liste le 17/09/2026 (AT-07) : elle avait un
  // appelant réel depuis le 14/09 — la liste des clients affiche déjà ses
  // sites —, mais `app/(back-office)/clients/page.tsx` n'importait alors
  // `lib/clients/depot.ts` que PAR LE BARREL (`@/lib/clients`), invisible à ce
  // gardien qui résout chaque import vers UN fichier. AT-07 a ajouté un import
  // direct depuis le dépôt pour `compterClients`, et ce même import a rendu
  // `sitesParClient` visible du même coup — le motif écrit ici mentait donc
  // déjà, et la mesure venait seulement de le révéler.
  {
    module: "lib/imports/depot.ts",
    fonction: "decompter",
    motif:
      "Le décompte d'un lot, posé par L1-08e ; l'écran d'import (L1-11) lit le rapport lui-même, qui porte ses lignes. *Deux décomptes du même fait* — celui-ci est le second, et il se retire plutôt qu'il ne trouve un appelant.",
  },
  {
    module: "lib/interventions/depot.ts",
    fonction: "lireIntervention",
    motif:
      "La fiche d'une intervention lit par sa propre requête de page, qui rend davantage que cette fonction. Posée par D84 avant l'écran. Se retire avec elle, ou le jour où la fiche l'appelle.",
  },
  {
    module: "lib/sites/depot.ts",
    fonction: "supprimerSite",
    motif:
      "Même raison que `supprimerClient` : un site référencé par une intervention ne se supprime pas, et L1-02 a posé la fonction avant que la question soit tranchée.",
  },
  // ── LA RÉDUCTION DES ALLERS-RETOURS DU 16/09/2026 (SUITE) A DÉPLACÉ LA
  // CRÉATION EN LOT VERS `creerXxxEnLot` — CES SIX VARIANTES « Dans » Y
  // PERDENT LEUR SEUL APPELANT EXTERNE ───────────────────────────────────
  {
    module: "lib/clients/depot.ts",
    fonction: "creerClientDans",
    motif:
      "L'application d'un lot de clients écrivait ses créations une ligne à la fois par ce chemin ; elle écrit désormais en un `createMany` via `creerClientsEnLot`. La fonction reste appelée INTRA-module par `creerClient`, que `app/api/clients/creer/route.ts` atteint — ce gardien ne trace pas un appel interne au même fichier de dépôt (`chemin !== depot`). Se retire si un appelant externe réapparaît.",
  },
  {
    module: "lib/sites/depot.ts",
    fonction: "creerSiteDans",
    motif:
      "Même raison que `creerClientDans` : l'application d'un lot de sites écrit désormais par `creerSitesEnLot`. Reste appelée intra-module par `creerSite`, atteint par `app/api/sites/creer/route.ts`.",
  },
  {
    module: "lib/materiel/depot.ts",
    fonction: "creerModeleDans",
    motif:
      "Même raison que `creerClientDans` : l'application d'un lot de modèles écrit désormais par `creerModelesEnLot`. Reste appelée intra-module par sa fonction publique de création.",
  },
  {
    module: "lib/materiel/depot.ts",
    fonction: "creerFamilleDans",
    motif:
      "Même raison que `creerClientDans` : l'application d'un lot de familles écrit désormais par `creerFamillesEnLot`. Reste appelée intra-module par sa fonction publique de création.",
  },
  {
    module: "lib/prestations/depot.ts",
    fonction: "creerPrestationDans",
    motif:
      "Même raison que `creerClientDans` : l'application d'un lot de prestations écrit désormais par `creerPrestationsEnLot`. Reste appelée intra-module par `creerPrestation`.",
  },
  {
    module: "lib/machines/depot.ts",
    fonction: "creerMachineDans",
    motif:
      "L'application d'un lot d'équipements écrivait ses créations une ligne à la fois par ce chemin, son SEUL appelant : aucun écran de création manuelle d'un équipement n'existe, seul l'import en crée. Elle écrit désormais en un `createMany` via `creerMachinesEnLot`. Se retire le jour où un écran de création manuelle l'appelle.",
  },
  // ── AGENCE-1 (21/09/2026) — DEUX VARIANTES « Dans », EXTRAITES POUR R6-01,
  // SANS SECOND APPELANT AUJOURD'HUI ───────────────────────────────────────
  {
    module: "lib/agences/depot.ts",
    fonction: "creerAgenceDans",
    motif:
      "Extraite pour R6-01 — écrit dans une transaction que l'appelant tient, comme `creerSiteDans` — mais appelée INTRA-module seulement, par `creerAgence`, qu'`app/api/parametres/agences/creer/route.ts` atteint. Ce gardien ne trace pas un appel interne au même fichier de dépôt (`chemin !== depot`). Se retire si un import de sites en vient à créer des agences.",
  },
  {
    module: "lib/agences/depot.ts",
    fonction: "modifierAgenceDans",
    motif:
      "Même raison que `creerAgenceDans` : appelée INTRA-module par `modifierAgence`, qu'`app/api/parametres/agences/[id]/modifier/route.ts` atteint. Se retire si un import de sites en vient à corriger des agences.",
  },
  {
    module: "lib/agences/depot.ts",
    fonction: "motifDeLErreur",
    motif:
      "Exportée par la revue de #275 (DÉFAUT 1) pour être éprouvée SANS base — ce bac à sable ne joint ni PostgreSQL ni Docker, et cette fonction est le seul moyen d'y fabriquer l'erreur qu'un déclencheur lève réellement (`tests/unit/agences/depot.test.ts`). Appelée INTRA-module par `creerAgence` et `modifierAgence`, tous deux atteints. Se retire si un second module de dépôt vient à la réutiliser.",
  },
];
