/**
 * LA GRAMMAIRE DES FICHIERS D'IMPORT (ticket L1-08, décision D31).
 *
 * D31 arrête six mécaniques : le marqueur de version en `A1`, les en-têtes en
 * ligne 2, les données à partir de la ligne 3, les dates en `JJ/MM/AAAA`, les
 * nombres à virgule décimale sans séparateur de milliers, et les colonnes
 * inconnues ignorées avec avertissement. Ce module porte **la grammaire**, et
 * elle seule : il ne lit aucun classeur, ne touche aucune base, et n'a **aucune
 * dépendance**.
 *
 * ## Pourquoi la grammaire est séparée de la lecture du classeur
 *
 * Ce n'est pas un découpage d'esthète. La liaison à SheetJS est **en attente
 * d'arbitrage** : le paquet `xlsx` du registre npm est figé à `0.18.5`, et deux
 * avis de sécurité de gravité HAUTE le visent **sans version corrigée
 * atteignable depuis npm** — dont CVE-2023-30533, une pollution de prototype qui
 * se déclenche précisément **à la LECTURE d'un fichier fabriqué**, c'est-à-dire
 * dans l'usage exact de ce ticket. La mesure et la question sont au registre du
 * 08/09/2026 ; rien n'est décidé ici.
 *
 * Ce que ce découpage garantit en attendant : le jour où la liaison arrive,
 * **elle n'aura aucune règle à porter** — elle rendra une grille de cellules, et
 * tout ce qui suit est déjà écrit et éprouvé.
 *
 * ## Ce que ce module NE fait pas, et pourquoi c'est écrit
 *
 * Il ne rend aucun texte destiné à l'écran. Chaque anomalie porte un **code**,
 * et le libellé vit au dictionnaire (`lib/i18n/fr.ts`) — c'est la coupure de
 * L0-11 : une chaîne technique qui deviendrait visible est une clé de plus
 * là-bas, jamais une traduction ici.
 */

/** Ce qui peut se trouver dans une cellule, abstrait de tout classeur. */
export type Cellule = {
  /** La cellule porte du TEXTE (y compris un nombre saisi comme texte). */
  readonly texte?: string;
  /** La cellule porte un NOMBRE, tel que le classeur le stocke. */
  readonly nombre?: number;
  /** La cellule porte une DATE, sous la forme du numéro de série du classeur. */
  readonly serie?: number;
};

/** Les codes d'anomalie. Le libellé est au dictionnaire, jamais ici. */
export const ANOMALIES = [
  "marqueur_absent",
  "marqueur_illisible",
  "marqueur_autre_type",
  "marqueur_version_anterieure",
  "marqueur_version_posterieure",
  "entete_en_double",
  "colonne_obligatoire_absente",
  "date_format",
  "date_hors_plage",
  "date_avec_heure",
  "nombre_format",
  "nombre_separateur_milliers",
  "nombre_point_decimal",
  "cellule_vide",
] as const;

export type CodeAnomalie = (typeof ANOMALIES)[number];

export type Anomalie = {
  readonly code: CodeAnomalie;
  /** Ce que la cellule contenait, pour que le rapport puisse le montrer. */
  readonly valeur?: string;
};

function echec(
  code: CodeAnomalie,
  valeur?: string,
): { readonly ok: false } & {
  readonly anomalie: Anomalie;
} {
  return {
    ok: false,
    anomalie: valeur === undefined ? { code } : { code, valeur },
  };
}

/* ────────────────────────────────────────────────────────────────────────
 * 1. LE MARQUEUR DE VERSION — `CODIPLAN-<type>-v<n>` en A1
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * D31 : *« Un fichier d'une version antérieure est reconnu et refusé avec un
 * message explicite. »* Le mot qui décide est **reconnu** : le refus doit
 * distinguer « ce n'est pas un fichier CODIPLAN » de « c'est le bon format, dans
 * une version que je ne sais plus lire ». Ce sont deux corrections différentes
 * pour celui qui reçoit le refus — trouver le bon fichier, ou retélécharger le
 * modèle —, et un message unique lui ferait chercher au mauvais endroit.
 *
 * **La version POSTÉRIEURE est un cas que D31 ne tranche pas**, et il est refusé
 * plutôt qu'inventé : un fichier qui se déclare en v3 lu par du code qui connaît
 * la v2 ne peut pas l'être sans supposer ce que la v3 a changé. Le refuser est
 * la seule lecture qui ne détruit rien ; la question est au registre.
 */
const MARQUEUR = /^CODIPLAN-([a-z0-9_]+)-v(\d+)$/;

export type Marqueur =
  | { readonly etat: "conforme" }
  | { readonly etat: "absent" }
  | { readonly etat: "illisible"; readonly valeur: string }
  | { readonly etat: "autre_type"; readonly type: string }
  | { readonly etat: "version_anterieure"; readonly version: number }
  | { readonly etat: "version_posterieure"; readonly version: number };

const ETAT_VERS_CODE: Record<
  Exclude<Marqueur["etat"], "conforme">,
  CodeAnomalie
> = {
  absent: "marqueur_absent",
  illisible: "marqueur_illisible",
  autre_type: "marqueur_autre_type",
  version_anterieure: "marqueur_version_anterieure",
  version_posterieure: "marqueur_version_posterieure",
};

/** Le code d'anomalie d'un marqueur non conforme. */
export function codeDuMarqueur(marqueur: Marqueur): CodeAnomalie | null {
  return marqueur.etat === "conforme" ? null : ETAT_VERS_CODE[marqueur.etat];
}

export function analyserMarqueur(
  cellule: Cellule | undefined,
  attendu: { readonly type: string; readonly version: number },
): Marqueur {
  const brut = (cellule?.texte ?? "").trim();
  if (brut === "") {
    return { etat: "absent" };
  }
  if (!brut.startsWith("CODIPLAN-")) {
    // Ce n'est pas un fichier CODIPLAN du tout : le lecteur doit aller chercher
    // un autre fichier, pas un autre modèle.
    return { etat: "absent" };
  }
  const trouve = MARQUEUR.exec(brut);
  if (trouve === null) {
    return { etat: "illisible", valeur: brut };
  }
  const [, type, version] = trouve;
  if (type !== attendu.type) {
    return { etat: "autre_type", type: type! };
  }
  const n = Number(version);
  if (n < attendu.version) {
    return { etat: "version_anterieure", version: n };
  }
  if (n > attendu.version) {
    return { etat: "version_posterieure", version: n };
  }
  return { etat: "conforme" };
}

/* ────────────────────────────────────────────────────────────────────────
 * 2. LES DATES — `JJ/MM/AAAA`, et rien d'autre
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Le jour où le tableur a commencé à compter. Excel place le sérial 1 au
 * 1ᵉʳ janvier 1900 **et croit que 1900 était bissextile** : le sérial 60 désigne
 * un 29 février 1900 qui n'a jamais existé, et tout ce qui précède est décalé
 * d'un jour. Plutôt que de porter deux époques, **tout sérial antérieur au
 * 1ᵉʳ mars 1900 est refusé** : cela ferme la classe entière du défaut, et aucune
 * donnée d'exploitation ne s'y trouve.
 */
const EPOQUE_MS = Date.UTC(1899, 11, 30);
const PREMIER_SERIAL_SUR = 61;

const JJMMAAAA = /^(\d{2})\/(\d{2})\/(\d{4})$/;

export type LectureDate =
  | { readonly ok: true; readonly valeur: Date }
  | { readonly ok: false; readonly anomalie: Anomalie };

/**
 * Une date se lit sous DEUX formes, et l'une des deux n'est pas dans D31.
 *
 * Le texte `JJ/MM/AAAA` est la forme que D31 arrête. Mais une colonne mise au
 * format « date » dans le tableur ne porte pas de texte : elle porte un
 * **numéro de série**, et c'est le cas le plus courant — refuser cette forme
 * refuserait le fichier normal produit par le modèle qu'on distribue.
 *
 * **Et le sérial est lu en UTC, jamais par un `Date` local.** Une conversion qui
 * passe par le fuseau de la machine décale le jour d'un cran d'un côté ou de
 * l'autre du méridien — la Nouvelle-Calédonie est à UTC+11, et le serveur ne
 * l'est pas nécessairement. Un import saisi le 1ᵉʳ du mois se rangerait au 31 du
 * mois précédent, sans que rien ne le dise.
 *
 * Un sérial FRACTIONNAIRE porte une heure : ce n'est plus une date `JJ/MM/AAAA`,
 * et il est refusé plutôt qu'arrondi. Arrondir choisirait un jour à la place de
 * celui qui a saisi.
 */
export function lireDate(cellule: Cellule | undefined): LectureDate {
  if (cellule === undefined) {
    return echec("cellule_vide");
  }

  if (cellule.serie !== undefined) {
    const serie = cellule.serie;
    if (!Number.isInteger(serie)) {
      return echec("date_avec_heure", String(serie));
    }
    if (serie < PREMIER_SERIAL_SUR) {
      return echec("date_hors_plage", String(serie));
    }
    return { ok: true, valeur: new Date(EPOQUE_MS + serie * 86_400_000) };
  }

  const brut = (cellule.texte ?? "").trim();
  if (brut === "") {
    return echec("cellule_vide");
  }
  const trouve = JJMMAAAA.exec(brut);
  if (trouve === null) {
    return echec("date_format", brut);
  }
  const jour = Number(trouve[1]);
  const mois = Number(trouve[2]);
  const annee = Number(trouve[3]);
  const valeur = new Date(Date.UTC(annee, mois - 1, jour));
  // `Date.UTC` ne refuse rien : le 31/02 devient le 3 mars. La seule façon de
  // le voir est de relire ce qu'on vient d'écrire.
  if (
    valeur.getUTCFullYear() !== annee ||
    valeur.getUTCMonth() !== mois - 1 ||
    valeur.getUTCDate() !== jour
  ) {
    return echec("date_hors_plage", brut);
  }
  return { ok: true, valeur };
}

/* ────────────────────────────────────────────────────────────────────────
 * 3. LES NOMBRES — virgule décimale, aucun séparateur de milliers
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Un nombre lu d'un fichier ne rend **jamais un flottant**, et c'est la
 * conséquence directe de I3 : les décimales sont une propriété de la DEVISE, et
 * un montant se stocke en entier dans son unité la plus fine. Rendre `12345.67`
 * obligerait le premier appelant à remultiplier par cent — c'est-à-dire à faire
 * l'arithmétique flottante que I3 interdit, une ligne après nous.
 *
 * La lecture rend donc les **chiffres** et leur **échelle** : `« 1234,56 »` rend
 * les chiffres `123456` et une échelle de deux. Le contrôle « ce fichier
 * porte-t-il plus de décimales que la devise n'en admet ? » devient une
 * comparaison d'entiers, et il appartient à l'appelant qui connaît la devise.
 *
 * *Cet exemple s'écrit en toutes lettres exprès.* Le gardien de I3 refuse
 * `decimales: <chiffre>` partout hors de `lib/money/`, **y compris dans un
 * commentaire** — il n'élague pas la documentation. Le faire élaguer pour
 * laisser passer cette phrase aurait été assouplir un gardien pour faire passer
 * son propre code, ce que le §5 interdit ; l'observation est au registre.
 */
export type NombreLu = {
  readonly chiffres: bigint;
  readonly decimales: number;
};

export type LectureNombre =
  | { readonly ok: true; readonly valeur: NombreLu }
  | { readonly ok: false; readonly anomalie: Anomalie };

const NOMBRE_VIRGULE = /^-?\d+(?:,\d+)?$/;

export function lireNombre(cellule: Cellule | undefined): LectureNombre {
  if (cellule === undefined) {
    return echec("cellule_vide");
  }

  if (cellule.nombre !== undefined) {
    // Une cellule NUMÉRIQUE ne porte aucun séparateur : le tableur a déjà tranché
    // la question que D31 pose au texte. On la relit par sa représentation
    // décimale plutôt que par des multiplications flottantes.
    return depuisTexteDecimal(String(cellule.nombre), ".");
  }

  const brut = (cellule.texte ?? "").trim();
  if (brut === "") {
    return echec("cellule_vide");
  }
  // Les trois confusions que D31 ferme, distinguées pour que le refus dise
  // laquelle : l'espace de milliers, le point décimal, et le reste.
  if (/[\s  ]/.test(brut)) {
    return echec("nombre_separateur_milliers", brut);
  }
  if (brut.includes(".")) {
    return echec("nombre_point_decimal", brut);
  }
  if (!NOMBRE_VIRGULE.test(brut)) {
    return echec("nombre_format", brut);
  }
  return depuisTexteDecimal(brut, ",");
}

function depuisTexteDecimal(brut: string, separateur: string): LectureNombre {
  const [entiere, fraction = ""] = brut.split(separateur);
  if (entiere === undefined || !/^-?\d+$/.test(entiere)) {
    return echec("nombre_format", brut);
  }
  if (fraction !== "" && !/^\d+$/.test(fraction)) {
    return echec("nombre_format", brut);
  }
  const negatif = entiere.startsWith("-");
  const chiffres = BigInt((negatif ? entiere.slice(1) : entiere) + fraction);
  return {
    ok: true,
    valeur: {
      chiffres: negatif ? -chiffres : chiffres,
      decimales: fraction.length,
    },
  };
}

/* ────────────────────────────────────────────────────────────────────────
 * 4. LES COLONNES — inconnues ignorées, obligatoires exigées
 * ──────────────────────────────────────────────────────────────────────── */

export type ColonneAttendue = {
  readonly nom: string;
  readonly obligatoire: boolean;
};

export type Appariement = {
  /** Le nom de colonne vers son indice dans la ligne d'en-têtes. */
  readonly indices: ReadonlyMap<string, number>;
  /** Les colonnes du fichier que le modèle ne connaît pas — AVERTISSEMENT. */
  readonly inconnues: readonly string[];
  /** Ce qui empêche de lire le fichier — BLOQUANT, avant toute ligne. */
  readonly anomalies: readonly (Anomalie & { readonly colonne: string })[];
};

/**
 * D31 : *« Colonnes inconnues : ignorées avec avertissement, jamais
 * bloquantes. »* Deux cas que D31 ne tranche pas, et qui sont refusés plutôt
 * qu'inventés — la question est au registre.
 *
 * **Un en-tête en double** : lire la seconde colonne écraserait silencieusement
 * la première, et rien dans le rapport ne dirait laquelle a gagné.
 *
 * **Une colonne obligatoire absente** : ce n'est pas une ligne qui manque, c'est
 * le fichier qui n'est pas celui qu'on croit. Le signaler ligne à ligne
 * produirait trois cents rejets identiques là où une phrase suffit.
 *
 * **L'appariement est EXACT après élagage des espaces** — ni casse ignorée, ni
 * accents dépliés. Une tolérance est une décision, et elle se paie une fois : le
 * jour où deux colonnes ne diffèrent que par la casse, la tolérance choisit à la
 * place de celui qui a écrit le fichier. En l'état, un en-tête mal orthographié
 * ressort DEUX fois dans le rapport — « colonne obligatoire absente » et
 * « colonne inconnue » —, et cette paire se lit sans explication.
 */
export function apparierColonnes(
  entetes: readonly (Cellule | undefined)[],
  attendues: readonly ColonneAttendue[],
): Appariement {
  const indices = new Map<string, number>();
  const inconnues: string[] = [];
  const anomalies: (Anomalie & { colonne: string })[] = [];
  const connues = new Set(attendues.map((c) => c.nom));
  const vues = new Set<string>();

  entetes.forEach((cellule, indice) => {
    const nom = (cellule?.texte ?? "").trim();
    if (nom === "") {
      return;
    }
    if (vues.has(nom)) {
      anomalies.push({ code: "entete_en_double", colonne: nom, valeur: nom });
      return;
    }
    vues.add(nom);
    if (connues.has(nom)) {
      indices.set(nom, indice);
    } else {
      inconnues.push(nom);
    }
  });

  for (const colonne of attendues) {
    if (colonne.obligatoire && !indices.has(colonne.nom)) {
      anomalies.push({
        code: "colonne_obligatoire_absente",
        colonne: colonne.nom,
      });
    }
  }

  return { indices, inconnues, anomalies };
}
