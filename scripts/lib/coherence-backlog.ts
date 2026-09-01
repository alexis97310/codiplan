import { createHash } from "node:crypto";

import {
  extraireChapitre10,
  lireDecisions,
  lireRegles,
  type Decision,
  type Regle,
} from "./cablage-arbitrages";

/**
 * COHÉRENCE DU BACKLOG AVEC LES SOURCES QU'IL CITE — ticket R0-b.
 *
 * **Le défaut, une catégorie plus bas que É8.** `docs/backlog.md` est de rang 4
 * et il cite des règles de rang 2 et des décisions de rang 1. Rien ne vérifiait
 * que ce qu'il en dit soit encore vrai. Mesuré : L1-08 portait « seul le dernier
 * lot est annulable » APRÈS que D54 l'eut supprimé — même silence qu'É8, à
 * l'étage du plan plutôt qu'à celui des règles.
 *
 * **LE CONTRÔLE EST ÉTROIT, ET C'EST DÉLIBÉRÉ.** Le backlog est un plan : il
 * bouge sans cesse, et une réciprocité complète — chaque règle nommant les
 * tickets qui la lisent — coûterait plus qu'elle ne rapporterait. Le mode de
 * défaillance réel est **le ticket qui cite une règle ayant CHANGÉ depuis**.
 * C'est celui-là, et lui seul, qu'on attrape.
 *
 * **CE QUE LE CONTRÔLE VÉRIFIE, ET CE QU'IL NE PEUT PAS VÉRIFIER.** La
 * cohérence de sens entre un critère d'acceptation et le texte d'une règle
 * n'est pas décidable statiquement — il faudrait lire. Ce qui EST décidable,
 * c'est que la relecture ait eu lieu **contre le texte courant** : chaque
 * ticket citant une source porte l'empreinte des sources qu'il cite, et cette
 * empreinte change dès que l'une d'elles bouge. Le gardien ne prouve donc pas
 * la cohérence ; il **force la relecture au moment exact où elle est due**, et
 * refuse qu'on l'oublie en silence. C'est la seule chose qu'une machine puisse
 * tenir ici, et il vaut mieux l'écrire que laisser croire davantage.
 *
 * **La population, et le piège — fermé par la STRUCTURE, pas par un plancher.**
 * Un ticket qui ne cite rien n'est pas couvert : c'est assumé, il sera lu contre
 * le chapitre 10 le jour où on l'écrira. Mais « cite au moins un identifiant »
 * est un critère de sélection, et retirer une citation devrait donc faire
 * SORTIR un ticket de la population au lieu de le faire échouer (§9, 31/08).
 * Deux propriétés l'en empêchent, et aucune n'est un chiffre arbitraire :
 * l'empreinte porte sur l'ENSEMBLE des sources citées, si bien qu'en retirer
 * une la fait changer — c'est un écart, pas une sortie ; et les retirer TOUTES
 * laisse une estampille qui ne s'adosse plus à rien — écart aussi. Les
 * planchers qui suivent ne sont donc pas la parade : ce sont des témoins de
 * vacuité, contre un parseur devenu aveugle.
 *
 * **LA CLÔTURE PAR LES AMENDEMENTS, et l'angle mort qu'elle ferme.** Un ticket
 * peut être rendu faux par une décision qu'il ne cite PAS : L0-10 citait D32 et
 * décrivait le périmètre d'audit en notions, alors que D52 puis D53 l'avaient
 * remplacé par une liste de tables. L'empreinte de D32 n'avait pas bougé, et le
 * ticket restait vert. La parade est la réciprocité, une étage plus bas : une
 * décision amendée porte la ligne `**Amendé par Dxx.**`, et l'empreinte d'un
 * ticket se calcule sur la CLÔTURE de ses citations — la décision citée, plus
 * celles qui l'amendent, transitivement. Bouger D53 réveille donc tout ticket
 * qui cite D32.
 *
 * **Limite annoncée** : ce qui n'est pas un ticket n'est pas couvert — la note
 * « AVANT L1-01… » du lot 1, par exemple, est normative et cite D10 et D22 sans
 * entrer dans la population. Elle vit sous le contrat de R0-a, qui a ses
 * propres gardiens.
 */

/** Un ticket du backlog, citant ou non. */
export type Ticket = {
  readonly ref: string;
  readonly texte: string;
  /** Règles et décisions citées, `RG-XXX-NN` et `Dnn`, plages dépliées. */
  readonly sourcesCitees: readonly string[];
  /** L'empreinte estampillée dans le ticket, si elle y est. */
  readonly empreinteDeclaree: string | null;
};

export type AnalyseBacklog = {
  readonly tickets: readonly Ticket[];
  readonly couverts: readonly Ticket[];
  readonly sourcesConnues: readonly string[];
  readonly ecarts: readonly string[];
};

const REF_TICKET = /^\*\*(L\d+-\d+[a-z]?)\b/;
const FIN_DE_BLOC = /^(?:#{1,6}\s|---\s*$)/;

/** `RG-IMP-02`, et la plage `RG-IMP-01 à 05` que le backlog écrit couramment. */
const CITATION_REGLE = /\b(RG-[A-Z]{3})-(\d{2})(?:\s+(?:à|a)\s+(\d{2}))?\b/g;
const CITATION_DECISION = /\bD(\d{1,3})\b/g;

/** L'estampille : la date de relecture et l'empreinte des sources citées. */
const ESTAMPILLE =
  /^\*Relu contre les sources citées le (\d{2}\/\d{2}\/\d{4}) — empreinte `([0-9a-f]{8})`\.\*$/;

/** La ligne qu'une décision amendée porte : `**Amendé par D52, D53.**` */
const AMENDE_PAR = /^\*\*Amendé par (D\d+(?:,\s*D\d+)*)\.\*\*/gm;

/** Ce qui, dans un corps de décision, ressemble à cette ligne sans en être une. */
const AMENDE_PAR_APPROXIMATIF = /^\*\*Amendé par /gm;

/** Ce qui, dans un ticket, ressemble à une estampille sans en être une. */
const ESTAMPILLE_APPROXIMATIVE = /^\*Relu contre les sources citées/;

/** La forme attendue, écrite une fois — les messages d'écart la citent. */
export const FORME_ESTAMPILLE =
  "*Relu contre les sources citées le JJ/MM/AAAA — empreinte `ab12cd34`.*";

export function empreinte(texte: string): string {
  return createHash("sha256")
    .update(texte.replace(/\s+/g, " ").trim(), "utf8")
    .digest("hex")
    .slice(0, 8);
}

/**
 * Le texte courant d'une source citée : la ligne de la règle au chapitre 10,
 * ou le corps de la décision dans le recueil.
 */
export function textesDesSources(
  regles: readonly Regle[],
  decisions: readonly Decision[],
): Map<string, string> {
  const textes = new Map<string, string>();
  for (const regle of regles) textes.set(regle.ref, regle.texte);
  for (const decision of decisions) {
    textes.set(decision.ref, `${decision.titre}\n${decision.corps}`);
  }
  return textes;
}

/**
 * Qui amende qui, lu dans le corps des décisions. Une ligne mal formée est un
 * écart, jamais un silence : elle passerait pour « aucun amendement ».
 */
export function amendementsDeDecisions(decisions: readonly Decision[]): {
  amendeurs: Map<string, string[]>;
  ecarts: string[];
} {
  const amendeurs = new Map<string, string[]>();
  const ecarts: string[] = [];

  for (const decision of decisions) {
    const trouves = [...decision.corps.matchAll(AMENDE_PAR)];
    const approximatifs = [...decision.corps.matchAll(AMENDE_PAR_APPROXIMATIF)];
    if (trouves.length !== approximatifs.length) {
      ecarts.push(
        `${decision.ref} : ligne d'amendement mal formée — la forme attendue est ` +
          "« **Amendé par D52, D53.** »",
      );
    }
    const refs = trouves.flatMap((m) => m[1].split(",").map((r) => r.trim()));
    if (refs.length > 0) amendeurs.set(decision.ref, [...new Set(refs)]);
  }

  return { amendeurs, ecarts };
}

/**
 * La CLÔTURE d'un ensemble de citations : les sources citées, plus celles qui
 * les amendent, transitivement. C'est elle qui ferme l'angle mort du ticket
 * rendu faux par une décision qu'il ne cite pas.
 */
export function clotureDesSources(
  citees: readonly string[],
  amendeurs: ReadonlyMap<string, readonly string[]>,
): string[] {
  const vues = new Set<string>();
  const aVoir = [...citees];
  while (aVoir.length > 0) {
    const ref = aVoir.pop() as string;
    if (vues.has(ref)) continue;
    vues.add(ref);
    for (const amendeur of amendeurs.get(ref) ?? []) aVoir.push(amendeur);
  }
  return [...vues].sort();
}

/** L'empreinte attendue d'un ticket : ses sources, triées, concaténées. */
export function empreinteAttendue(
  sources: readonly string[],
  textes: ReadonlyMap<string, string>,
): string {
  return empreinte(
    [...sources]
      .sort()
      .map((ref) => `${ref} ${textes.get(ref) ?? ""}`)
      .join(""),
  );
}

function citations(bloc: string): string[] {
  const trouvees = new Set<string>();

  for (const m of bloc.matchAll(CITATION_REGLE)) {
    const [, famille, debut, fin] = m;
    const premier = Number(debut);
    const dernier = fin === undefined ? premier : Number(fin);
    // Déplier la plage est indispensable : « tests sur RG-IMP-01 à 05 » cite
    // RG-IMP-02, et c'est exactement la règle qui avait changé sous L1-08.
    for (let n = premier; n <= Math.max(premier, dernier); n += 1) {
      trouvees.add(`${famille}-${String(n).padStart(2, "0")}`);
    }
  }
  for (const m of bloc.matchAll(CITATION_DECISION)) trouvees.add(`D${m[1]}`);

  return [...trouvees].sort();
}

/** Découpe le backlog en tickets. TOUS les tickets, citants ou non. */
export function lireTickets(backlog: string): {
  tickets: Ticket[];
  ecarts: string[];
} {
  const ecarts: string[] = [];
  const tickets: Ticket[] = [];
  let courant: { ref: string; lignes: string[] } | undefined;

  const fermer = (): void => {
    if (!courant) return;
    const texte = courant.lignes.join("\n");
    const estampilles = courant.lignes
      .map((ligne) => ESTAMPILLE.exec(ligne))
      .filter((m): m is RegExpExecArray => m !== null);
    const approximatives = courant.lignes.filter((ligne) =>
      ESTAMPILLE_APPROXIMATIVE.test(ligne),
    );

    // Une estampille mal formée ne doit JAMAIS passer pour une absence
    // d'estampille : ce sont deux états différents, et l'un est une faute.
    if (approximatives.length !== estampilles.length) {
      ecarts.push(
        `${courant.ref} : estampille mal formée — la forme attendue est « ${FORME_ESTAMPILLE} »`,
      );
    }
    if (estampilles.length > 1) {
      ecarts.push(`${courant.ref} : deux estampilles dans le même ticket`);
    }

    tickets.push({
      ref: courant.ref,
      texte,
      sourcesCitees: citations(texte),
      empreinteDeclaree: estampilles[0]?.[2] ?? null,
    });
    courant = undefined;
  };

  for (const ligne of backlog.split("\n")) {
    const entete = REF_TICKET.exec(ligne);
    if (entete) {
      fermer();
      courant = { ref: entete[1], lignes: [ligne] };
      continue;
    }
    if (FIN_DE_BLOC.test(ligne)) {
      fermer();
      continue;
    }
    courant?.lignes.push(ligne);
  }
  fermer();

  return { tickets, ecarts };
}

export function analyserBacklog(
  backlog: string,
  cahierDesCharges: string,
  arbitrages: string,
): AnalyseBacklog {
  const { tickets, ecarts: ecartsTickets } = lireTickets(backlog);
  const { regles } = lireRegles(cahierDesCharges);
  const { decisions } = lireDecisions(arbitrages);
  const textes = textesDesSources(regles, decisions);
  const { amendeurs, ecarts: ecartsAmendements } =
    amendementsDeDecisions(decisions);
  const ecarts = [...ecartsTickets, ...ecartsAmendements];

  // Témoin d'adossement du parseur amont : sans chapitre 10, toute citation
  // serait « source inconnue » et le message désignerait la mauvaise cause.
  if (
    regles.length === 0 ||
    extraireChapitre10(cahierDesCharges).length === 0
  ) {
    ecarts.push(
      "aucune règle lue au chapitre 10 : le contrôle ne peut pas s'exercer",
    );
  }

  const couverts: Ticket[] = [];

  for (const ticket of tickets) {
    for (const ref of ticket.sourcesCitees.filter((r) => !textes.has(r))) {
      ecarts.push(
        `${ticket.ref} cite ${ref}, qui n'existe ni au chapitre 10 ni dans docs/arbitrages.md`,
      );
    }

    const connues = clotureDesSources(
      ticket.sourcesCitees.filter((ref) => textes.has(ref)),
      amendeurs,
    ).filter((ref) => textes.has(ref));
    if (connues.length === 0) {
      // Un ticket qui ne cite rien n'est pas couvert — c'est assumé. Mais une
      // estampille sans citation ne s'adosse à rien et doit le dire.
      if (ticket.empreinteDeclaree !== null) {
        ecarts.push(
          `${ticket.ref} porte une estampille mais ne cite aucune règle ni décision — ` +
            "l'estampille ne s'adosse à rien : la retirer, ou citer la source relue",
        );
      }
      continue;
    }

    couverts.push(ticket);
    const attendue = empreinteAttendue(connues, textes);

    if (ticket.empreinteDeclaree === null) {
      ecarts.push(
        `${ticket.ref} cite ${connues.join(", ")} et ne porte aucune estampille — ` +
          "relire le ticket contre le texte courant de ces sources, puis inscrire " +
          `l'empreinte ${attendue}`,
      );
      continue;
    }

    if (ticket.empreinteDeclaree !== attendue) {
      ecarts.push(
        `${ticket.ref} : le texte d'au moins une source citée a CHANGÉ depuis la ` +
          `dernière relecture (${connues.join(", ")}). Relire le ticket contre le ` +
          "texte courant, corriger ce qui a cessé d'être vrai, puis remplacer " +
          `l'empreinte ${ticket.empreinteDeclaree} par ${attendue}`,
      );
    }
  }

  return {
    tickets,
    couverts,
    sourcesConnues: [...textes.keys()].sort(),
    ecarts: [...new Set(ecarts)].sort(),
  };
}
