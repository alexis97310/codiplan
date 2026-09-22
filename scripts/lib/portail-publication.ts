import {
  verdictDePublication,
  type VerdictPublication,
} from "../../lib/db/verdict-publication";
import { MIGRATIONS_ATTENDUES } from "../../lib/db/migrations-attendues";

/**
 * LE PORTAIL DE PUBLICATION (RELEASE-1) — l'orchestration autour du verdict.
 *
 * `lib/db/verdict-publication.ts` porte le verdict, pur. Ici vivent les trois
 * pièces qui l'entourent et qui, elles, touchent à l'environnement réel :
 * le sens des codes de sortie côté Vercel, la traduction de la sortie de
 * `scripts/migrations-appliquees.mts` en liste (ou `null`), et la porte de
 * secours qu'un humain peut actionner.
 */

/**
 * ── LE SENS DES CODES DE SORTIE CÔTÉ VERCEL, ET IL EST INVERSÉ DE L'INTUITION ──
 *
 * Documenté par Vercel (Ignored Build Step) : la commande sort TOUJOURS en 0
 * ou en 1.
 *   - code `1` → la construction CONTINUE (l'état `BUILDING` se poursuit) ;
 *   - code `0` → la construction est ANNULÉE, le déploiement passe à `CANCELED`.
 *
 * **Ce n'est PAS un code Unix classique** où 0 vaudrait succès. Un lot qui se
 * trompe de sens ne publie plus jamais rien, ou publie toujours — dans les
 * deux cas silencieusement, puisque le résultat ressemble à un fonctionnement
 * normal jusqu'à ce que quelqu'un le remarque. `tests/unit/ci/portail-publication.test.ts`
 * fige ces deux valeurs en dur pour que les inverser fasse rougir un gardien,
 * pas seulement une relecture.
 */
export const CODE_DE_SORTIE: Record<VerdictPublication["decision"], number> = {
  publier: 1,
  bloquer: 0,
  illisible: 0,
};

/** Le nom de la variable que l'application déployée utilise déjà pour se
 * connecter (`prisma/schema.prisma`, `env("DATABASE_URL")`) — le portail ne
 * demande donc aucun secret que la mise en ligne de l'application n'exigeait
 * pas déjà. */
export const VARIABLE_CONNEXION = "DATABASE_URL";

/**
 * LA PORTE DE SECOURS, explicite et bruyante (point 3 du ticket).
 *
 * Un blocage qu'aucune main ne peut lever est une panne de plus. Positionnée
 * à `"oui"` — jamais une simple présence — pour qu'une variable posée par
 * erreur avec une autre valeur ne force rien en silence.
 */
export const VARIABLE_FORCAGE = "FORCER_PUBLICATION_MALGRE_RETARD";

export function publicationForcee(
  env: Record<string, string | undefined>,
): boolean {
  return env[VARIABLE_FORCAGE] === "oui";
}

/** La sortie brute d'une invocation de `scripts/migrations-appliquees.mts`. */
export type SortieScriptMigrationsAppliquees = {
  readonly codeSortie: number | null;
  readonly stdout: string;
  readonly stderr: string;
};

/**
 * Traduit la sortie du script en la liste attendue par `verdictDePublication`
 * — ou `null` quand elle n'est pas exploitable.
 *
 * `scripts/migrations-appliquees.mts` ne distingue délibérément PAS, dans son
 * propre code, une base neuve (table absente) d'une base injoignable : les
 * deux écrivent sur `stderr` et laissent `stdout` vide (voir son docblock).
 * Cette traduction-ci hérite donc de la même prudence à un endroit — un
 * `stderr` non vide est lu comme `illisible`, jamais comme « zéro migration
 * appliquée » — et va plus loin sur un autre : un code de sortie non nul (le
 * script a levé au lieu d'être intercepté par son propre `try/catch`) est
 * traité de la même façon, plutôt que de faire confiance à un `stdout` qui
 * pourrait être partiel.
 */
export function appliqueesDepuisSortieScript(
  sortie: SortieScriptMigrationsAppliquees,
): string[] | null {
  if (sortie.codeSortie !== 0) {
    return null;
  }
  if (sortie.stderr.trim().length > 0) {
    return null;
  }
  return sortie.stdout
    .split("\n")
    .map((ligne) => ligne.trim())
    .filter((ligne) => ligne.length > 0);
}

/** Le rapport, écrit dans la sortie de construction (une automatisation
 * muette ne peut pas être auditée). */
export function rapport(verdict: VerdictPublication): string {
  const lignes = ["## Portail de publication (RELEASE-1)", ""];
  if (verdict.decision === "publier") {
    lignes.push(
      "**publier** — la base de production porte toutes les migrations que ce commit attend.",
    );
  } else if (verdict.decision === "bloquer") {
    lignes.push(
      `**bloquer** — ${verdict.nombre} migration(s) manquante(s) en production. La première est \`${verdict.nom}\`.`,
      "",
      "Geste : lancer le flux « DB migrate & seed », cible « production », purge décochée, puis republier.",
    );
  } else {
    lignes.push(
      `**illisible** — ${verdict.motif}`,
      "",
      `Vérifier que la variable \`${VARIABLE_CONNEXION}\` est posée pour l'environnement de production sur Vercel — ce n'est PAS le même secret que celui du flux GitHub « DB migrate ».`,
    );
  }
  lignes.push(
    "",
    `Pour publier malgré tout : poser \`${VARIABLE_FORCAGE}=oui\` sur ce déploiement.`,
    "",
  );
  return lignes.join("\n");
}

/**
 * L'ORCHESTRATION, sans force de publication — celle-ci est un geste
 * distinct, tenu par le seul appelant CLI (`scripts/portail-publication.mts`),
 * jamais mêlé à la lecture de la base : un verdict « publier » forcé et un
 * verdict « publier » mérité ne doivent pas se ressembler dans la sortie de
 * construction.
 *
 * `invoquerScript` est injectable pour que ce calcul s'éprouve sans
 * sous-processus ni base — voir `tests/unit/ci/portail-publication.test.ts`.
 */
export function calculerVerdict(
  env: Record<string, string | undefined>,
  invoquerScript: (
    env: Record<string, string | undefined>,
  ) => SortieScriptMigrationsAppliquees,
): VerdictPublication {
  if ((env[VARIABLE_CONNEXION] ?? "").trim().length === 0) {
    return {
      decision: "illisible",
      motif: `La variable ${VARIABLE_CONNEXION} n'est pas posée pour ce déploiement Vercel.`,
    };
  }
  const appliquees = appliqueesDepuisSortieScript(invoquerScript(env));
  return verdictDePublication(MIGRATIONS_ATTENDUES, appliquees);
}
