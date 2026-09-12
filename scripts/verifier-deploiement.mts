#!/usr/bin/env tsx
/**
 * LA VÉRIFICATION APRÈS DÉPLOIEMENT (R3-01) — le lanceur.
 *
 * ## Ce qu'il fait, et ce qu'il ne fait SURTOUT pas
 *
 * Il ouvre `/api/sante` sur le déploiement, lit la réponse, et rend le verdict
 * que `scripts/lib/verdict-deploiement.ts` calcule. **Il n'applique AUCUNE
 * migration**, et c'est écrit au ticket : une migration ne part jamais toute
 * seule (`db-migrate.yml`, décision du 20/08). Il nomme le geste ; un humain le
 * joue, et le regarde.
 *
 * ## LES RÉESSAIS SONT BORNÉS, ET ILS NE RÉESSAIENT PAS TOUT
 *
 * Un déploiement met une minute ou deux, une base suspendue se réveille : ces
 * deux états s'améliorent en attendant. **Une migration manquante, non.** La
 * liste des natures réessayables vit dans le module de verdict, et ce lanceur ne
 * la recopie pas — *une liste close recopiée « pour la lisibilité » devient
 * fausse le jour où la première grandit, sans rougir* (§9, 01/09).
 *
 * ## IL NE SAUTE JAMAIS EN SILENCE
 *
 * Sans `URL_PRODUCTION`, il ne rend pas la main en vert : il rend
 * `adresse_absente` et sort en 1. *Un contrôle qui se tait quand il n'est pas
 * configuré est le contrôle qu'on croit avoir* — et c'est exactement l'espèce de
 * panne que ce ticket répare.
 *
 * ## CE QU'IL ÉCRIT, ET OÙ
 *
 * Le verdict sur la sortie standard, et — quand la CI lui donne
 * `GITHUB_STEP_SUMMARY` — **le même verdict dans le résumé de l'exécution**, là
 * où il est visible sans ouvrir un journal. Une alarme qui exige trois clics
 * pour être lue finit par ne pas l'être (écart É12).
 */
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import {
  CODE_DE_SORTIE,
  NATURES_A_REESSAYER,
  verdictDuDeploiement,
  type VerdictDeploiement,
} from "./lib/verdict-deploiement";

/** Le chemin interrogé — la sonde lisible par une machine, jamais la page. */
const CHEMIN = "/api/sante";

/**
 * Le budget de réessai.
 *
 * Six tentatives espacées de 20 secondes, soit **une fenêtre d'environ deux
 * minutes** : c'est l'ordre de grandeur d'un déploiement, mesuré plutôt que
 * supposé sur les exécutions de septembre. Au-delà, attendre davantage ne
 * renseigne plus — le contrôle dit ce qu'il a vu et rend la main.
 */
const TENTATIVES = 6;
const ATTENTE_MS = 20_000;

/** Le délai au-delà duquel on considère que rien n'a répondu. */
const DELAI_REQUETE_MS = 15_000;

async function interroger(adresse: string): Promise<string | null> {
  const controleur = new AbortController();
  const minuterie = setTimeout(() => controleur.abort(), DELAI_REQUETE_MS);
  try {
    const reponse = await fetch(`${adresse}${CHEMIN}`, {
      signal: controleur.signal,
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    // La route promet 200 QUOI QU'IL ARRIVE : tout autre code dit que ce n'est
    // pas elle qui a répondu — une page d'erreur d'hébergeur, une redirection
    // d'authentification, un déploiement absent. On le traite comme un silence,
    // et le texte reçu part dans le journal plutôt que dans le verdict.
    if (reponse.status !== 200) {
      process.stdout.write(
        `Réponse HTTP ${reponse.status} sur ${CHEMIN} — ce n'est pas la sonde.\n`,
      );
      return null;
    }
    return await reponse.text();
  } catch {
    return null;
  } finally {
    clearTimeout(minuterie);
  }
}

/** L'adresse, sans barre finale : `https://exemple/` + `/api/sante` ferait `//`. */
function adresseNettoyee(brut: string | undefined): string | null {
  const propre = (brut ?? "").trim().replace(/\/+$/, "");
  return propre.length > 0 ? propre : null;
}

export async function verifier(
  env: Record<string, string | undefined> = process.env,
  attendre: (ms: number) => Promise<void> = (ms) =>
    new Promise((resoudre) => setTimeout(resoudre, ms)),
): Promise<VerdictDeploiement> {
  const adresse = adresseNettoyee(env.URL_PRODUCTION);
  const commitAttendu = (env.COMMIT_ATTENDU ?? "").trim() || null;

  // Sans adresse, il n'y a rien à réessayer : le verdict est immédiat.
  if (adresse === null) {
    return verdictDuDeploiement({ adresse: null, corps: null, commitAttendu });
  }

  let verdict = verdictDuDeploiement({
    adresse,
    corps: await interroger(adresse),
    commitAttendu,
  });

  for (let reste = TENTATIVES - 1; reste > 0; reste -= 1) {
    if (!NATURES_A_REESSAYER.includes(verdict.nature)) break;
    process.stdout.write(
      `${verdict.nature} — nouvelle tentative dans ${ATTENTE_MS / 1000} s ` +
        `(${reste} restante(s)).\n`,
    );
    await attendre(ATTENTE_MS);
    verdict = verdictDuDeploiement({
      adresse,
      corps: await interroger(adresse),
      commitAttendu,
    });
  }

  return verdict;
}

/**
 * LE RAPPORT, et chaque ligne dit de quel côté du miroir elle vient.
 *
 * *Une ligne qui ne peut pas bouger sous une faute n'est jamais présentée à côté
 * de celles qui le peuvent* (§9, 06/09). L'adresse et le commit visé sont des
 * PARAMÈTRES — ils ne bougeraient pas si la production tombait —, et ils sont
 * nommés comme tels.
 */
function rapport(
  verdict: VerdictDeploiement,
  env: Record<string, string | undefined>,
): string {
  const lignes = [
    verdict.nature === "sain"
      ? "## Déploiement vérifié"
      : `## Déploiement — ${verdict.nature}`,
    "",
    verdict.detail,
  ];
  if (verdict.geste !== null) {
    lignes.push("", `**Le geste :** ${verdict.geste}`);
  }
  lignes.push(
    "",
    "| Paramètre du contrôle | |",
    "|---|---|",
    `| Adresse interrogée | \`${adresseNettoyee(env.URL_PRODUCTION) ?? "(absente)"}${CHEMIN}\` |`,
    `| Commit visé | \`${(env.COMMIT_ATTENDU ?? "").trim().slice(0, 7) || "(aucun)"}\` |`,
    `| Code de sortie | \`${CODE_DE_SORTIE[verdict.nature]}\` — 0 sain, 1 écart constaté, 75 rien constaté |`,
    "",
  );
  return lignes.join("\n");
}

const invoqueeDirectement =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (invoqueeDirectement) {
  const verdict = await verifier();
  const texte = rapport(verdict, process.env);
  process.stdout.write(`${texte}\n`);

  // Le même verdict dans le résumé de l'exécution, quand la CI en offre un.
  const resume = process.env.GITHUB_STEP_SUMMARY;
  if (resume !== undefined && resume.trim().length > 0) {
    appendFileSync(resume, `${texte}\n`);
  }

  // ── LE VERDICT EST TRANSMIS, JAMAIS REDÉRIVÉ DU CODE DE SORTIE ───────────
  //
  // L'alarme a besoin de savoir LAQUELLE des natures a rougi, pour ouvrir le
  // bon fil et nommer le bon geste. Le recalculer depuis le code de sortie
  // serait une seconde lecture d'un même critère (§9, 01/09) — et une lecture
  // PERDANTE : 75 recouvre trois natures distinctes. La nature, le détail et
  // le geste passent donc tels quels, et le flux ne les recopie pas.
  const sorties = process.env.GITHUB_OUTPUT;
  if (sorties !== undefined && sorties.trim().length > 0) {
    appendFileSync(
      sorties,
      [
        `nature=${verdict.nature}`,
        // Le CODE aussi, et c'est ce qui évite à l'alarme de redériver la
        // distinction « écart constaté » / « rien constaté » à sa façon.
        `code=${CODE_DE_SORTIE[verdict.nature]}`,
        // Le délimiteur protège d'un détail qui porterait un retour à la ligne.
        `detail<<FIN_DETAIL\n${verdict.detail}\nFIN_DETAIL`,
        `geste<<FIN_GESTE\n${verdict.geste ?? ""}\nFIN_GESTE`,
        "",
      ].join("\n"),
    );
  }

  process.exit(CODE_DE_SORTIE[verdict.nature]);
}
