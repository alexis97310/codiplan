import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  calculerVerdict,
  type MesuresPage,
  type ReleveReseau,
  type Verdict,
} from "./mesures";

/**
 * LE DOSSIER PAR ÉCRAN, POUR LES 8 AGENTS (point 4 du ticket
 * 9F6A-DOSSIER-AUDIT-8-AGENTS) — un module SANS Playwright : il assemble ce
 * que `ecrans.spec.ts` a déjà capturé et mesuré en `docs/audits/9F6/`, jamais
 * en lisant un navigateur lui-même.
 */

export const RACINE_9F6 = join(process.cwd(), "docs/audits/9F6");
export const DOSSIER_ECRANS = join(RACINE_9F6, "ecrans");

export type LargeurCle = "1280" | "375";

export type MesureLargeur = {
  readonly statut: "capturee" | "absente" | "echec";
  readonly note?: string;
  readonly mesuresSite?: MesuresPage;
  readonly mesuresMaquette?: MesuresPage;
  readonly reseau?: ReleveReseau;
  readonly dureeNavigationMs?: number;
  readonly urlFinale?: string;
  readonly maquetteExiste: boolean;
  readonly siteTronquee?: boolean;
  readonly maquetteTronquee?: boolean;
  readonly verdict?: Verdict;
  readonly verdictDetail?: readonly string[];
};

export type EntreeDossier = {
  readonly cle: string;
  readonly zone: string;
  readonly libelle: string;
  readonly route: string | null;
  readonly role: string;
  readonly etat?: string;
  readonly maquetteHash: string | null;
  readonly largeurs: Readonly<Record<LargeurCle, MesureLargeur>>;
};

/** Le paquet (1 à 8) d'un écran — RÈGLE UNIQUE, dérivée de sa clé. */
export function paquetDe(cle: string): string {
  if (
    /^(racine|connexion|mot-de-passe-oublie|enrolement|premier-acces|arrivee|sante|portail)/.test(
      cle,
    )
  ) {
    return "P1 — Accès et sans session";
  }
  if (/^(tableau-de-bord|indicateurs|absences)/.test(cle)) {
    return "P2 — Pilotage";
  }
  if (/^planning/.test(cle)) {
    return "P3 — Planning";
  }
  if (
    cle === "interventions" ||
    cle === "interventions-a-facturer" ||
    cle === "interventions-nouvelle" ||
    /^demandes/.test(cle)
  ) {
    return "P4 — Demandes et registre";
  }
  if (/^interventions-/.test(cle)) {
    return "P5 — Fiches intervention et bon";
  }
  if (/^(clients|sites|parc|vgp)/.test(cle)) {
    return "P6 — Clients, sites, parc, VGP";
  }
  if (/^(parametres|imports)/.test(cle)) {
    return "P7 — Paramètres et imports";
  }
  if (/^terrain/.test(cle)) {
    return "P8 — Terrain";
  }
  return "P1 — Accès et sans session";
}

function ligneMesure(largeur: LargeurCle, m: MesureLargeur): string {
  const verdict = m.verdict ?? "non mesure";
  const anomalies: string[] = [];
  if (m.mesuresSite) {
    if (m.mesuresSite.debordementHorizontal) anomalies.push("débordement H");
    if (m.mesuresSite.imagesCassees.length > 0) {
      anomalies.push(
        `${m.mesuresSite.imagesCassees.length} image(s) cassée(s)`,
      );
    }
    if (m.mesuresSite.boutonsSansNom.length > 0) {
      anomalies.push(
        `${m.mesuresSite.boutonsSansNom.length} bouton(s) sans nom`,
      );
    }
    if (m.mesuresSite.champsSansEtiquette.length > 0) {
      anomalies.push(
        `${m.mesuresSite.champsSansEtiquette.length} champ(s) sans étiquette`,
      );
    }
  }
  if (m.reseau) {
    if (m.reseau.reponsesEnEchec.length > 0) {
      anomalies.push(`${m.reseau.reponsesEnEchec.length} réponse(s) 4xx/5xx`);
    }
    if (m.reseau.requetesEnEchec.length > 0) {
      anomalies.push(`${m.reseau.requetesEnEchec.length} requête(s) en échec`);
    }
    if (m.reseau.erreursConsole.length > 0) {
      anomalies.push(`${m.reseau.erreursConsole.length} erreur(s) console`);
    }
  }
  const duree =
    m.dureeNavigationMs !== undefined ? `${m.dureeNavigationMs} ms` : "—";
  const anomaliesTexte = anomalies.length > 0 ? anomalies.join(", ") : "aucune";
  return `| ${largeur} px | ${m.statut} | ${verdict} | ${duree} | ${anomaliesTexte} |`;
}

function imagesExistantes(
  cle: string,
  largeur: LargeurCle,
  m: MesureLargeur,
): readonly string[] {
  const liens: string[] = [];
  if (m.statut === "capturee") {
    liens.push(`![Site ${largeur} (haut)](site-${largeur}-haut.jpg)`);
    liens.push(
      `![Site ${largeur} (pleine${m.siteTronquee ? ", tronquée" : ""})](site-${largeur}-pleine.jpg)`,
    );
  }
  if (m.maquetteExiste) {
    liens.push(`![Maquette ${largeur} (haut)](maquette-${largeur}-haut.jpg)`);
    liens.push(
      `![Maquette ${largeur} (pleine${m.maquetteTronquee ? ", tronquée" : ""})](maquette-${largeur}-pleine.jpg)`,
    );
  }
  return liens;
}

function construireFiche(entree: EntreeDossier): string {
  const paquet = paquetDe(entree.cle);
  const lignes: string[] = [];
  lignes.push(`# ${entree.zone} · ${entree.libelle}`);
  lignes.push("");
  lignes.push(`- **Clé** : \`${entree.cle}\``);
  lignes.push(`- **Route réelle** : \`${entree.route ?? "absente"}\``);
  lignes.push(`- **Rôle** : ${entree.role}`);
  lignes.push(
    `- **Hash de maquette** : \`${entree.maquetteHash ?? "aucune"}\``,
  );
  lignes.push(`- **État** : ${entree.etat ?? "—"}`);
  lignes.push(`- **Paquet** : ${paquet}`);
  lignes.push("");
  lignes.push("## Mesures et verdict automatique");
  lignes.push("");
  lignes.push(
    "| Largeur | Statut | Verdict | Durée navigation | Anomalies mesurées |",
  );
  lignes.push("|---|---|---|---|---|");
  for (const largeur of ["1280", "375"] as const) {
    const m = entree.largeurs[largeur];
    lignes.push(ligneMesure(largeur, m));
  }
  lignes.push("");
  lignes.push("## Images");
  lignes.push("");
  for (const largeur of ["1280", "375"] as const) {
    const m = entree.largeurs[largeur];
    const liens = imagesExistantes(entree.cle, largeur, m);
    if (liens.length === 0) continue;
    lignes.push(`### ${largeur} px`);
    lignes.push("");
    for (const lien of liens) lignes.push(lien);
    lignes.push("");
  }
  lignes.push("## Écarts avec la maquette");
  lignes.push("");
  lignes.push("");
  lignes.push("## Ergonomie et textes");
  lignes.push("");
  lignes.push("");
  lignes.push("## Défauts (cause probable fichier:ligne)");
  lignes.push("");
  lignes.push("");
  return lignes.join("\n");
}

/** Écrit `fiche.md`, `mesures.json` pour UN écran — le dossier `ecrans/<cle>/` existe déjà (captures). */
export function ecrireLaFicheDUnEcran(entree: EntreeDossier): void {
  const dossier = join(DOSSIER_ECRANS, entree.cle);
  mkdirSync(dossier, { recursive: true });
  writeFileSync(join(dossier, "fiche.md"), construireFiche(entree) + "\n");
  writeFileSync(join(dossier, "mesures.json"), JSON.stringify(entree, null, 2));
}

/** Calcule le verdict des deux largeurs d'une entrée — appelé par l'appelant avant écriture. */
export function calculerLesVerdicts(
  entree: Omit<EntreeDossier, "largeurs"> & {
    largeurs: Record<
      LargeurCle,
      Omit<MesureLargeur, "verdict" | "verdictDetail">
    >;
  },
): EntreeDossier {
  const largeurs: Record<LargeurCle, MesureLargeur> = {
    "1280": undefined as never,
    "375": undefined as never,
  };
  for (const largeur of ["1280", "375"] as const) {
    const m = entree.largeurs[largeur];
    const site = m.mesuresSite ?? null;
    const maquette = m.mesuresMaquette ?? null;
    const reseau = m.reseau ?? null;
    if (m.statut !== "capturee") {
      largeurs[largeur] = {
        ...m,
        verdict: "non mesure",
        verdictDetail: [m.note ?? "Non capturée."],
      };
      continue;
    }
    const { verdict, detail } = calculerVerdict(
      site,
      maquette,
      reseau,
      m.maquetteExiste,
    );
    largeurs[largeur] = { ...m, verdict, verdictDetail: detail };
  }
  return { ...entree, largeurs };
}

export function ecrireIndex(entrees: readonly EntreeDossier[]): void {
  mkdirSync(RACINE_9F6, { recursive: true });
  const index = entrees.map((e) => ({
    cle: e.cle,
    zone: e.zone,
    libelle: e.libelle,
    route: e.route,
    role: e.role,
    etat: e.etat ?? null,
    paquet: paquetDe(e.cle),
    verdict1280: e.largeurs["1280"].verdict ?? "non mesure",
    verdict375: e.largeurs["375"].verdict ?? "non mesure",
    fichiers: [`ecrans/${e.cle}/fiche.md`],
  }));
  writeFileSync(join(RACINE_9F6, "index.json"), JSON.stringify(index, null, 2));

  const lignes: string[] = [];
  lignes.push("# Index des écrans — 9F6A-DOSSIER-AUDIT-8-AGENTS");
  lignes.push("");
  lignes.push(
    "| Clé | Zone | Libellé | Route | Rôle | Paquet | Verdict 1280 | Verdict 375 |",
  );
  lignes.push("|---|---|---|---|---|---|---|---|");
  for (const e of index) {
    lignes.push(
      `| \`${e.cle}\` | ${e.zone} | ${e.libelle} | \`${e.route ?? "absente"}\` | ${e.role} | ${e.paquet} | ${e.verdict1280} | ${e.verdict375} |`,
    );
  }
  writeFileSync(join(RACINE_9F6, "index.md"), lignes.join("\n") + "\n");
}

export function ecrireRepartition(entrees: readonly EntreeDossier[]): void {
  const paquets = new Map<string, EntreeDossier[]>();
  for (const e of entrees) {
    const p = paquetDe(e.cle);
    const liste = paquets.get(p) ?? [];
    liste.push(e);
    paquets.set(p, liste);
  }
  const ordre = [
    "P1 — Accès et sans session",
    "P2 — Pilotage",
    "P3 — Planning",
    "P4 — Demandes et registre",
    "P5 — Fiches intervention et bon",
    "P6 — Clients, sites, parc, VGP",
    "P7 — Paramètres et imports",
    "P8 — Terrain",
  ];
  const tailles = ordre.map((p) => (paquets.get(p) ?? []).length);
  const maxTaille = Math.max(...tailles);
  const minTaille = Math.min(...tailles.filter((t) => t > 0));

  const lignes: string[] = [];
  lignes.push("# Répartition en 8 paquets — 9F6A-DOSSIER-AUDIT-8-AGENTS");
  lignes.push("");
  lignes.push(
    "Chaque écran est dans EXACTEMENT un paquet (épreuve `tests/unit/audits/9f6-repartition.test.ts`, sur `index.json`).",
  );
  lignes.push("");
  if (maxTaille > 2 * minTaille) {
    lignes.push(
      `**Déséquilibre mesuré** : le plus grand paquet (${maxTaille} écrans) fait plus du double du plus petit (${minTaille} écrans).`,
    );
    lignes.push("");
  }
  for (const p of ordre) {
    const liste = paquets.get(p) ?? [];
    const images = liste.reduce((somme, e) => {
      let n = 0;
      for (const largeur of ["1280", "375"] as const) {
        const m = e.largeurs[largeur];
        if (m.statut === "capturee") n += 2;
        if (m.maquetteExiste) n += 2;
      }
      return somme + n;
    }, 0);
    lignes.push(`## ${p}`);
    lignes.push("");
    lignes.push(`${liste.length} écran(s), ${images} image(s).`);
    lignes.push("");
    for (const e of liste) {
      lignes.push(`- \`${e.cle}\` — ${e.zone} · ${e.libelle}`);
    }
    lignes.push("");
  }
  mkdirSync(RACINE_9F6, { recursive: true });
  writeFileSync(join(RACINE_9F6, "repartition.md"), lignes.join("\n") + "\n");
}
