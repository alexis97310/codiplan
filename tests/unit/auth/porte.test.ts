import { describe, expect, it } from "vitest";

import { CAPACITES, type Capacite } from "@/lib/auth/habilitations";
import { exigerCapacite } from "@/lib/auth/porte";
import { Role } from "@/lib/auth/roles";
import { type ContexteSession } from "@/lib/auth/contexte";
import { type SessionServeur } from "@/lib/auth/session";

import { fichiersSource } from "../outils/fichiers-source";

/**
 * D-12 — LA PORTE, ET LE GARDIEN QUI EMPÊCHE LE DÉFAUT DE REVENIR.
 *
 * ## Ce que la mesure du 20/09 a établi
 *
 * `contexteCourant()` prouve une session et une société ; il ne lit aucun
 * rôle. La matrice de `lib/auth/habilitations.ts` est juste et éprouvée, et
 * n'avait pour appelants hors tests que deux modules de LECTURE — zéro route.
 * Un rôle sans la capacité qu'exige un geste pouvait donc l'accomplir quand
 * même, à l'intérieur d'une société correctement cloisonnée.
 *
 * ## LA PARTIE QUI COMPTE LE PLUS N'EST PAS LE BRANCHEMENT
 *
 * C'est la population de ce fichier, DÉDUITE du disque : une route neuve doit
 * apparaître toute seule, gardée ou exemptée, jamais oubliée. La liste des
 * exemptions est fermée dans les DEUX sens, comme
 * `tests/unit/gardiens/chemins-de-depot.test.ts` — une exemption dont la
 * route a retrouvé une capacité survivrait sinon à ce qu'elle exemptait.
 */

// ── LA CORRESPONDANCE ROUTE → CAPACITÉ, CHAQUE LIGNE VENANT DU §5.2 ─────────

const ROUTE_CAPACITE: Readonly<Record<string, Capacite>> = {
  // « Administrer les utilisateurs » — et D37 : admin_societe administre les
  // comptes, les agences ET LES HABILITATIONS de sa société.
  "app/api/habilitations/creer/route.ts": "administrer_utilisateurs",
  "app/api/habilitations/[id]/modifier/route.ts": "administrer_utilisateurs",
  "app/api/habilitations/[id]/activite/route.ts": "administrer_utilisateurs",
  "app/api/habilitations/attributions/creer/route.ts":
    "administrer_utilisateurs",
  "app/api/habilitations/attributions/[id]/retirer/route.ts":
    "administrer_utilisateurs",
  "app/api/habilitations/exigences/creer/route.ts": "administrer_utilisateurs",
  "app/api/habilitations/exigences/[id]/retirer/route.ts":
    "administrer_utilisateurs",
  "app/api/techniciens/creer/route.ts": "administrer_utilisateurs",
  "app/api/techniciens/[id]/modifier/route.ts": "administrer_utilisateurs",
  // « Créer / modifier une machine ».
  "app/api/machines/creer/route.ts": "gerer_machine",
  "app/api/machines/[id]/modifier/route.ts": "gerer_machine",
  // « Créer / modifier un client ou un site » (D130).
  "app/api/clients/creer/route.ts": "gerer_client_site",
  "app/api/clients/[id]/modifier/route.ts": "gerer_client_site",
  "app/api/sites/creer/route.ts": "gerer_client_site",
  "app/api/sites/[id]/modifier/route.ts": "gerer_client_site",
  // « Créer une demande ».
  "app/api/interventions/creer/route.ts": "creer_demande",
  // « Qualifier / affecter ». Rattacher une machine après coup (chantier
  // INT-MACHINE 2.2, 20/09/2026) qualifie l'intervention au même titre
  // qu'affecter un technicien — arbitrage de ce lot, voir la PR.
  "app/api/interventions/[id]/affecter/route.ts": "qualifier_affecter",
  "app/api/interventions/[id]/machine/route.ts": "qualifier_affecter",
  // « Modifier le planning » — une absence déplace du planning au même titre
  // qu'un déplacement d'intervention.
  "app/api/interventions/[id]/deplacer/route.ts": "modifier_planning",
  "app/api/absences/declarer/route.ts": "modifier_planning",
  "app/api/absences/lever/route.ts": "modifier_planning",
  // « Importer / exporter en masse ».
  "app/api/imports/controler/route.ts": "importer_exporter",
  "app/api/imports/[id]/appliquer/route.ts": "importer_exporter",
  "app/api/imports/[id]/annuler/route.ts": "importer_exporter",
  "app/api/imports/[id]/rejets/route.ts": "importer_exporter",
  // « Paramétrer une société » — dix-sept routes de `parametres/`.
  "app/api/parametres/forfaits/creer/route.ts": "parametrer_societe",
  "app/api/parametres/forfaits/[id]/activite/route.ts": "parametrer_societe",
  "app/api/parametres/forfaits/[id]/modifier/route.ts": "parametrer_societe",
  "app/api/parametres/materiel/familles/creer/route.ts": "parametrer_societe",
  "app/api/parametres/materiel/familles/[id]/activite/route.ts":
    "parametrer_societe",
  "app/api/parametres/materiel/familles/[id]/modifier/route.ts":
    "parametrer_societe",
  "app/api/parametres/materiel/modeles/creer/route.ts": "parametrer_societe",
  "app/api/parametres/materiel/modeles/[id]/activite/route.ts":
    "parametrer_societe",
  "app/api/parametres/materiel/modeles/[id]/modifier/route.ts":
    "parametrer_societe",
  "app/api/parametres/prestations/creer/route.ts": "parametrer_societe",
  "app/api/parametres/prestations/[id]/activite/route.ts": "parametrer_societe",
  "app/api/parametres/prestations/[id]/modifier/route.ts": "parametrer_societe",
  "app/api/parametres/plages/ajouter/route.ts": "parametrer_societe",
  "app/api/parametres/plages/[id]/modifier/route.ts": "parametrer_societe",
  "app/api/parametres/plages/[id]/supprimer/route.ts": "parametrer_societe",
  "app/api/parametres/agences/creer/route.ts": "parametrer_societe",
  "app/api/parametres/agences/[id]/modifier/route.ts": "parametrer_societe",
  "app/api/parametres/pas-creneau/route.ts": "parametrer_societe",
  "app/api/parametres/trajet-zone/route.ts": "parametrer_societe",
  // « Saisir un rapport ».
  "app/api/terrain/[id]/compteur/route.ts": "saisir_rapport",
};

// ── LES ROUTES EXEMPTÉES, NOMMÉES AVEC LEUR MOTIF ───────────────────────────

type Exemption = { readonly chemin: string; readonly motif: string };

const EXEMPTIONS: readonly Exemption[] = [
  {
    chemin: "app/api/vgp/enregistrer/[id]/route.ts",
    motif:
      "aucune ligne « enregistrer une VGP » au §5.2 — arbitrage en attente",
  },
  // Les lignes « Clôturer une intervention » / « Valider un rapport » ne
  // disent rien de « suspendre » ni de « reprendre » ; leur rattacher une
  // capacité serait, là aussi, inventer une règle non écrite.
  {
    chemin: "app/api/interventions/[id]/cloturer/route.ts",
    motif:
      "la matrice ne distingue pas clôturer/suspendre/reprendre — arbitrage en attente",
  },
  {
    chemin: "app/api/interventions/[id]/annuler/route.ts",
    motif:
      "la matrice ne distingue pas clôturer/suspendre/reprendre — arbitrage en attente",
  },
  {
    chemin: "app/api/interventions/[id]/suspendre/route.ts",
    motif:
      "la matrice ne distingue pas clôturer/suspendre/reprendre — arbitrage en attente",
  },
  {
    chemin: "app/api/interventions/[id]/reprendre/route.ts",
    motif:
      "la matrice ne distingue pas clôturer/suspendre/reprendre — arbitrage en attente",
  },
  // Les routes qui PRÉCÈDENT une société active et un rôle : la matrice
  // n'a rien à en dire, exactement comme les mises en page qui précèdent la
  // session (`tests/unit/auth/chrome.test.ts`).
  {
    chemin: "app/api/auth/[...all]/route.ts",
    motif: "le protocole d'authentification lui-même, avant tout rôle",
  },
  {
    chemin: "app/api/session/premier-acces/route.ts",
    motif: "établit la session — précède tout rôle",
  },
  {
    chemin: "app/api/session/code/route.ts",
    motif: "établit la session — précède tout rôle",
  },
  {
    chemin: "app/api/session/deconnexion/route.ts",
    motif: "ferme la session — aucune capacité à exiger pour partir",
  },
  {
    chemin: "app/api/session/connexion/route.ts",
    motif: "établit la session — précède tout rôle",
  },
  {
    chemin: "app/api/session/enrolement/route.ts",
    motif: "établit le second facteur — précède tout rôle",
  },
  {
    chemin: "app/api/session/societe/route.ts",
    motif: "choisit la société active — précède le rôle qu'elle porte",
  },
  {
    chemin: "app/api/sante/route.ts",
    motif: "sonde de santé (R3-01) — son contrat entier est de ne rien exiger",
  },
  {
    chemin: "app/api/machines/qr/[jeton]/route.ts",
    motif:
      "résolution d'un scan gouvernée par le périmètre technicien (D22, L2-02), pas par la matrice de capacités",
  },
];

const sansCommentaires = (source: string): string =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, "\n")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

/** Chaque route mutante d'`app/api/`, chemin relatif à la racine. */
const ROUTES = fichiersSource(["app/api"])
  .filter((f) => f.chemin.endsWith("/route.ts"))
  .map((f) => ({ ...f, contenu: sansCommentaires(f.contenu) }));

const CHEMINS_EXISTANTS = new Set(ROUTES.map((r) => r.chemin));

/** La capacité que le SOURCE d'une route appelle réellement, ou `null`. */
function capaciteAppelee(contenu: string): string | null {
  const trouve = /\bexigerCapacite\(\s*"([a-z_]+)"/.exec(contenu);
  return trouve?.[1] ?? null;
}

describe("D-12 — chaque route mutante est GARDÉE ou EXEMPTÉE, jamais oubliée", () => {
  it("TÉMOIN — la population n'est pas vide, et elle vient du disque", () => {
    expect(ROUTES.length).toBeGreaterThan(45);
  });

  it("toute route appelle `exigerCapacite`, ou figure dans les exemptions", () => {
    const exemptes = new Set(EXEMPTIONS.map((e) => e.chemin));
    const oubliees = ROUTES.filter(
      (r) => capaciteAppelee(r.contenu) === null && !exemptes.has(r.chemin),
    ).map((r) => r.chemin);

    expect(
      oubliees,
      "une route n'appelle pas `exigerCapacite` et ne figure pas dans " +
        "EXEMPTIONS : elle a échappé à D-12. Soit elle gagne une ligne dans " +
        "ROUTE_CAPACITE, soit une exemption nommée avec son motif.",
    ).toEqual([]);
  });

  it("toute capacité appelée dans une route existe dans CAPACITES", () => {
    const inconnues = ROUTES.map((r) => capaciteAppelee(r.contenu))
      .filter((c): c is string => c !== null)
      .filter((c) => !(CAPACITES as readonly string[]).includes(c));
    expect(inconnues).toEqual([]);
  });

  it("la correspondance ROUTE_CAPACITE est exacte, route par route", () => {
    for (const [chemin, capacite] of Object.entries(ROUTE_CAPACITE)) {
      const route = ROUTES.find((r) => r.chemin === chemin);
      expect(route, `${chemin} est absente du disque`).toBeDefined();
      expect(
        capaciteAppelee(route!.contenu),
        `${chemin} devrait appeler exigerCapacite("${capacite}")`,
      ).toBe(capacite);
    }
  });

  it("aucune route n'appelle une capacité hors de ROUTE_CAPACITE", () => {
    // La direction inverse de l'épreuve précédente : une route qui appelle
    // `exigerCapacite` avec une capacité que la table ne prévoit pas serait
    // une correspondance inventée, jamais confrontée au tableau du ticket.
    const horsTable = ROUTES.filter((r) => {
      const capacite = capaciteAppelee(r.contenu);
      return capacite !== null && ROUTE_CAPACITE[r.chemin] !== capacite;
    }).map((r) => r.chemin);
    expect(horsTable).toEqual([]);
  });

  it("le compte des routes gardées est celui annoncé dans la proposition", () => {
    expect(Object.keys(ROUTE_CAPACITE).length).toBe(45);
  });

  it("aucune exemption ne survit à son objet — adossement dans les deux sens", () => {
    const fantomes = EXEMPTIONS.filter(
      (e) => !CHEMINS_EXISTANTS.has(e.chemin),
    ).map((e) => e.chemin);
    expect(
      fantomes,
      "une exemption nomme une route qui n'existe plus sur le disque.",
    ).toEqual([]);

    const devenuesInutiles = EXEMPTIONS.filter((e) => {
      const route = ROUTES.find((r) => r.chemin === e.chemin);
      return route !== undefined && capaciteAppelee(route.contenu) !== null;
    }).map((e) => e.chemin);
    expect(
      devenuesInutiles,
      "une route exemptée appelle désormais `exigerCapacite` : son " +
        "exemption ne protège plus rien et doit être retirée.",
    ).toEqual([]);
  });

  it("tout motif est écrit, et aucun n'est vide", () => {
    const muets = EXEMPTIONS.filter((e) => e.motif.trim().length < 10);
    expect(muets).toEqual([]);
  });

  it("aucun chemin n'est à la fois gardé et exempté", () => {
    const gardees = new Set(Object.keys(ROUTE_CAPACITE));
    const doublons = EXEMPTIONS.filter((e) => gardees.has(e.chemin)).map(
      (e) => e.chemin,
    );
    expect(doublons).toEqual([]);
  });

  it("le gardien détecte réellement une route sans capacité — la contre-épreuve", () => {
    expect(capaciteAppelee("export async function POST() {}")).toBeNull();
    expect(
      capaciteAppelee('const c = await exigerCapacite("gerer_machine");'),
    ).toBe("gerer_machine");
  });
});

// ── `exigerCapacite` ELLE-MÊME ──────────────────────────────────────────────

const SOCIETE = "0192f0a0-1000-7000-8000-0000000000a1";
const UTILISATEUR = "0192f0a0-1000-7000-8000-0000000000b2";

function contexte(surcharge: Partial<ContexteSession> = {}): ContexteSession {
  return {
    utilisateurId: UTILISATEUR,
    societeId: SOCIETE,
    role: Role.adv,
    secondFacteurValide: false,
    adresseIp: null,
    clientId: null,
    ...surcharge,
  };
}

function sessionFabriquee(surcharge: Partial<ContexteSession> = {}) {
  return async (): Promise<SessionServeur> => ({
    jetonSession: "jeton-de-test",
    contexte: contexte(surcharge),
    identite: { nom: "Épreuve", email: "epreuve@codima.test", mfaActif: false },
  });
}

describe("D-12 — `exigerCapacite`, les cinq verdicts", () => {
  it("société absente → `null`", async () => {
    const resultat = await exigerCapacite(
      "gerer_machine",
      sessionFabriquee({ societeId: null, role: null }),
    );
    expect(resultat).toBeNull();
  });

  it("rôle absent → `null`", async () => {
    const resultat = await exigerCapacite(
      "gerer_machine",
      sessionFabriquee({ role: null }),
    );
    expect(resultat).toBeNull();
  });

  it("rôle sans la capacité → `null` — le cas du ticket", async () => {
    // Le client n'a « aucun » accès à `administrer_utilisateurs` : c'est
    // exactement la ligne qui protège
    // `POST /api/habilitations/attributions/creer` d'un compte non habilité.
    const resultat = await exigerCapacite(
      "administrer_utilisateurs",
      sessionFabriquee({ role: Role.technicien }),
    );
    expect(resultat).toBeNull();
  });

  it("rôle avec ● (complet) → le contexte", async () => {
    const resultat = await exigerCapacite(
      "administrer_utilisateurs",
      sessionFabriquee({ role: Role.admin_societe }),
    );
    expect(resultat?.role).toBe(Role.admin_societe);
    expect(resultat?.societeId).toBe(SOCIETE);
  });

  it("rôle avec ○ (restreint) → le contexte AUSSI — le point de conception", async () => {
    // `peut`, pas `peutPleinement` : la porte laisse passer le restreint, la
    // restriction de PORTÉE appartient au dépôt appelé ensuite. Le technicien
    // est restreint sur `consulter_planning`.
    const resultat = await exigerCapacite(
      "consulter_planning",
      sessionFabriquee({ role: Role.technicien }),
    );
    expect(resultat?.role).toBe(Role.technicien);
  });
});
