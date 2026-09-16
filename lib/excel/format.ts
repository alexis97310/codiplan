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
  "colonne_obligatoire_absente_ressemblance",
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

/**
 * LE TYPE QU'UNE CELLULE DE MARQUEUR ANNONCE — sans juger (R6-01).
 *
 * `analyserMarqueur` répond à *« ce fichier est-il celui que j'attends ? »* et
 * il lui faut donc savoir ce qu'on attend. **Celle-ci répond à la question qui
 * PRÉCÈDE** : *« qu'est-ce que ce fichier prétend être ? »* — de quoi choisir
 * le gabarit contre lequel on le jugera ensuite.
 *
 * Elle rend `null` dès que la cellule n'est pas un marqueur lisible, et elle
 * **ne dit pas pourquoi** : les cinq motifs appartiennent à `analyserMarqueur`,
 * qui les rend avec leur ligne et leur valeur. *Les énoncer ici aussi serait
 * deux lectures d'un même critère* (§9, 01/09) — et la seconde vieillirait sans
 * rougir, puisque rien ne la confronterait à la première.
 *
 * **La VERSION n'est pas rendue non plus**, et c'est la même borne : une
 * version antérieure ou postérieure est un refus motivé de `controlerFeuille`,
 * pas un défaut de sélection. *Un fichier « clients v2 » se juge contre le
 * gabarit des clients, et c'est là qu'il apprend que la v2 n'est pas lue.*
 */
export function typeAnnonce(cellule: Cellule | undefined): string | null {
  const trouve = MARQUEUR.exec((cellule?.texte ?? "").trim());
  return trouve === null ? null : (trouve[1] ?? null);
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
/**
 * L'ÉPOQUE DU CLASSEUR — le 30 décembre 1899, en UTC.
 *
 * **Exportée depuis L1-08c**, parce que la LIAISON au classeur en a besoin pour
 * faire le chemin inverse : `read-excel-file` rend un `Date` là où la grammaire
 * attend un numéro de série. La recopier dans la liaison aurait été deux
 * écritures d'un même fait (§9, 01/09) — et celle de la liaison serait devenue
 * fausse le jour où l'on toucherait à celle-ci, sans rougir.
 */
export const EPOQUE_MS = Date.UTC(1899, 11, 30);
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
    // ── LE ZÉRO N'EST PAS UNE DATE, ET CE N'EST PAS NON PLUS UNE ERREUR ────
    //
    // **Mesuré le 10/09/2026 sur le classeur réel de CODIMA** : la colonne
    // « Dernière intervention » de l'onglet parc porte **171 cellules à zéro**,
    // et zéro y veut dire *jamais d'intervention* — une ABSENCE, pas une
    // saisie fautive. Les ranger sous `date_hors_plage` ferait rejeter 171
    // machines pour un champ légitimement vide, ce qui est exactement le
    // contraire de ce que I6 promet.
    //
    // **Et une bibliothèque de lecture ne le dit pas toute seule** : mesuré,
    // `read-excel-file` rend `1899-12-30T00:00:00.000Z` pour ces cellules —
    // *une date parfaitement formée, et parfaitement fausse.* C'est ici que le
    // zéro s'écarte, jamais dans la liaison.
    //
    // Le sérial 60 — le 29 février 1900 qui n'a jamais existé — reste une
    // ANOMALIE et non une absence : personne ne saisit « pas de date » en
    // tapant 60.
    if (serie === 0) {
      return echec("cellule_vide");
    }
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
 * accents dépliés. Ratifié par l'exploitation le 09/09/2026 : *une tolérance
 * choisit à la place de celui qui a écrit le fichier, et un import de masse est
 * précisément le moment où l'on ne veut pas qu'un outil devine.*
 *
 * ## LA PAIRE EST RÉPARÉE, ET LA RESSEMBLANCE NE SERT QU'AU MESSAGE
 *
 * Un en-tête mal orthographié ressortait **deux fois** dans le rapport —
 * « colonne obligatoire absente » et « colonne inconnue » — et cette paire se
 * lisait sans explication. *Le rapport est lu par quelqu'un qui n'a pas le
 * schéma en tête : c'est lui qu'il faut servir, pas la complétude du
 * diagnostic.*
 *
 * Quand une colonne obligatoire manque **et** qu'un en-tête inconnu lui
 * ressemble, les deux sont dits **en une seule anomalie qui les nomme tous les
 * deux**, et l'en-tête sort de la liste des inconnues : il n'est pas silencié,
 * il est expliqué.
 *
 * **La ressemblance ne déplace RIEN.** Elle n'apparie pas, ne lit pas la
 * colonne, ne change aucune donnée : elle ne fabrique qu'une phrase. C'est ce
 * qui la distingue d'une tolérance — *une tolérance choisit, une explication
 * décrit.* Le jour où quelqu'un voudra s'en servir pour apparier, il devra
 * prendre la décision que l'exploitation vient de refuser.
 */
/**
 * Ramène un en-tête à ce qui reste quand la casse, les accents et la
 * ponctuation ont disparu. **Sert UNIQUEMENT à expliquer**, jamais à apparier.
 */
function empreinteLisible(nom: string): string {
  return nom
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Distance d'édition, bornée : au-delà de `plafond` elle rend `plafond + 1`.
 *
 * Bornée parce qu'on ne veut pas la valeur exacte : on veut savoir si deux
 * en-têtes sont assez proches pour qu'une phrase les rapproche. Une distance
 * non bornée coûterait plus et ne dirait rien de plus.
 */
function distance(a: string, b: string, plafond: number): number {
  if (Math.abs(a.length - b.length) > plafond) {
    return plafond + 1;
  }
  let precedente = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const courante = [i, ...Array<number>(b.length).fill(0)];
    for (let j = 1; j <= b.length; j += 1) {
      courante[j] = Math.min(
        precedente[j]! + 1,
        courante[j - 1]! + 1,
        precedente[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    precedente = courante;
  }
  return precedente[b.length]!;
}

/**
 * L'en-tête inconnu qui ressemble le plus à `attendue`, ou `null`.
 *
 * Deux formes de ressemblance, et elles couvrent ce qu'un tableur produit
 * réellement : la **même chaîne à la casse, aux accents et à la ponctuation
 * près** — c'est le cas majoritaire —, et la **faute de frappe**, jusqu'à deux
 * caractères, sur un nom assez long pour que ce ne soit pas un hasard.
 *
 * En cas d'égalité, le premier en-tête du fichier gagne : le résultat ne dépend
 * pas de l'ordre dans lequel les colonnes attendues sont déclarées.
 */
function ressemblanceLaPlusProche(
  attendue: string,
  candidats: readonly string[],
): string | null {
  const cible = empreinteLisible(attendue);
  if (cible === "") {
    return null;
  }
  let meilleur: { nom: string; ecart: number } | null = null;
  for (const candidat of candidats) {
    const forme = empreinteLisible(candidat);
    const ecart =
      forme === cible
        ? 0
        : cible.length >= 4 && forme.length >= 4
          ? distance(cible, forme, 2)
          : 3;
    if (ecart <= 2 && (meilleur === null || ecart < meilleur.ecart)) {
      meilleur = { nom: candidat, ecart };
    }
  }
  return meilleur?.nom ?? null;
}

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

  // Un en-tête inconnu n'explique qu'UNE colonne manquante : sans cela, un
  // fichier qui aurait perdu sa ligne d'en-têtes verrait le même intrus cité
  // partout, et le rapport dirait dix fois la même chose.
  const disponibles = new Set(inconnues);

  for (const colonne of attendues) {
    if (!colonne.obligatoire || indices.has(colonne.nom)) {
      continue;
    }
    const proche = ressemblanceLaPlusProche(colonne.nom, [...disponibles]);
    if (proche === null) {
      anomalies.push({
        code: "colonne_obligatoire_absente",
        colonne: colonne.nom,
      });
      continue;
    }
    disponibles.delete(proche);
    anomalies.push({
      code: "colonne_obligatoire_absente_ressemblance",
      colonne: colonne.nom,
      valeur: proche,
    });
  }

  // L'en-tête qui a servi à expliquer sort des « inconnues » : il n'est pas
  // silencié, il est NOMMÉ une fois au lieu de deux.
  return {
    indices,
    inconnues: inconnues.filter((nom) => disponibles.has(nom)),
    anomalies,
  };
}
