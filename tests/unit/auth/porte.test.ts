import { describe, expect, it } from "vitest";

import { CAPACITES, type Capacite } from "@/lib/auth/habilitations";
import { exigerCapacite, motifDuRefus } from "@/lib/auth/porte";
import { Role } from "@/lib/auth/roles";
import { type ContexteSession } from "@/lib/auth/contexte";
import { type SessionServeur } from "@/lib/auth/session";

import { fichiersSource, sansCommentaires } from "../outils/fichiers-source";

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
  // D153 (03/10/2026, TP-S3) — une exigence porte sur UN SITE, au même titre
  // que `gerer_client_site` : ce n'est plus une habilitation d'utilisateur.
  "app/api/habilitations/exigences/creer/route.ts": "gerer_client_site",
  "app/api/habilitations/exigences/[id]/retirer/route.ts": "gerer_client_site",
  "app/api/techniciens/creer/route.ts": "administrer_utilisateurs",
  "app/api/techniciens/[id]/modifier/route.ts": "administrer_utilisateurs",
  // D162 (04/10/2026, 9DJ-TP-ACC1-DONNER-ACCES, QT-1) — donner l'accès à un
  // technicien est un geste sur les UTILISATEURS de la société, même capacité
  // que créer ou modifier une fiche d'Équipe.
  "app/api/equipe/[id]/envoyer-acces/route.ts": "administrer_utilisateurs",
  // « Créer / modifier une machine ».
  "app/api/machines/creer/route.ts": "gerer_machine",
  "app/api/machines/[id]/modifier/route.ts": "gerer_machine",
  // « Créer / modifier un client ou un site » (D130).
  "app/api/clients/creer/route.ts": "gerer_client_site",
  "app/api/clients/[id]/modifier/route.ts": "gerer_client_site",
  "app/api/sites/creer/route.ts": "gerer_client_site",
  "app/api/sites/[id]/modifier/route.ts": "gerer_client_site",
  // Un interlocuteur est un attribut du client, pas un objet à part
  // (CONTACTS-1) : même capacité que les quatre routes ci-dessus.
  "app/api/contacts/creer/route.ts": "gerer_client_site",
  "app/api/contacts/[id]/modifier/route.ts": "gerer_client_site",
  "app/api/contacts/[id]/activite/route.ts": "gerer_client_site",
  // « Créer une demande ».
  "app/api/interventions/creer/route.ts": "creer_demande",
  // D151 (03/10/2026, décision du 03/10 point 3) — les QUATRE ACTIONS d'une
  // demande relèvent de « Qualifier / affecter » (CDC §5.2), jamais de la
  // création : REVIENT sur le choix d'origine de DEMANDES-1 (`creer_demande`,
  // « qualifier une demande, c'est décider qu'on va intervenir »).
  "app/api/demandes/[id]/accuser/route.ts": "qualifier_affecter",
  "app/api/demandes/[id]/qualifier/route.ts": "qualifier_affecter",
  "app/api/demandes/[id]/transformer/route.ts": "qualifier_affecter",
  "app/api/demandes/[id]/clore/route.ts": "qualifier_affecter",
  // « Qualifier / affecter ». Rattacher une machine après coup (chantier
  // INT-MACHINE 2.2, 20/09/2026) qualifie l'intervention au même titre
  // qu'affecter un technicien — arbitrage de ce lot, voir la PR.
  "app/api/interventions/[id]/affecter/route.ts": "qualifier_affecter",
  "app/api/interventions/[id]/machine/route.ts": "qualifier_affecter",
  // « Modifier le planning » — une absence déplace du planning au même titre
  // qu'un déplacement d'intervention.
  "app/api/interventions/[id]/deplacer/route.ts": "modifier_planning",
  // « TRANSMETTRE » (QG-5, D141, 9CO-PG-G14A-TRANSMETTRE) — MÊME capacité que
  // « Déplacer » : c'est elle qui planifie, et transmettre est la suite du
  // même geste (Planifiée → Affectée).
  "app/api/interventions/[id]/transmettre/route.ts": "modifier_planning",
  // TRANSMETTRE EN GROUPE (QG-5, D141, 9CP-PG-G14B-TRANSMETTRE-GROUPE) — MÊME
  // capacité que la transmission unitaire ci-dessus : « Transmettre demain »
  // et « Transmettre toutes les planifiées prêtes » restent le même geste,
  // posé sur plusieurs lignes à la fois.
  "app/api/interventions/transmettre/route.ts": "modifier_planning",
  // Le verdict d'une pose, en LECTURE SEULE (PG-B1) — même capacité que
  // « Déplacer » : qui peut déplacer peut lire le verdict qu'il obtiendrait.
  "app/api/interventions/[id]/verdict-pose/route.ts": "modifier_planning",
  // LE RÉSUMÉ DU TIROIR, EN LECTURE SEULE (PG-C5-TIROIR) — la même capacité
  // que la page `/planning` elle-même : tout rôle qui voit le planning peut
  // lire le tiroir d'une de ses cartes, y compris `TEC` en périmètre
  // restreint.
  "app/api/interventions/[id]/resume/route.ts": "consulter_planning",
  "app/api/absences/declarer/route.ts": "modifier_planning",
  "app/api/absences/lever/route.ts": "modifier_planning",
  // La note interne (50-INTERVENTIONS-2) — même capacité que « Déplacer » /
  // « Planifier » sur cette même fiche : aucune ne compte le rôle terrain
  // (`TEC`), à la différence de `consulter_planning` qui l'accorde en
  // « restreint ». La réutiliser évite d'ouvrir, par une requête forgée, une
  // écriture que le technicien ne voit jamais à l'écran.
  "app/api/interventions/[id]/note-interne/route.ts": "modifier_planning",
  // « Importer / exporter en masse ».
  "app/api/imports/controler/route.ts": "importer_exporter",
  "app/api/imports/[id]/appliquer/route.ts": "importer_exporter",
  "app/api/imports/[id]/annuler/route.ts": "importer_exporter",
  "app/api/imports/[id]/rejets/route.ts": "importer_exporter",
  // « Paramétrer une société » — les treize routes de taux, forfaits,
  // matériel et prestations (D153, TP-S3) : elles appellent désormais
  // `exigerCapaciteComplete`, le ○ de la direction (PA-02) n'y donnant plus
  // que la lecture. Agences, plages, pas et trajets ont leur propre capacité,
  // juste après.
  "app/api/parametres/taux-horaire/creer/route.ts": "parametrer_societe",
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
  // D153 (03/10/2026, TP-S3, choix du pilote) — plages, pas et agences
  // relèvent d'« Administrer les agences », jamais de « Paramétrer une
  // société » : ADMS seul, la direction n'y garde plus même le ○.
  "app/api/parametres/plages/ajouter/route.ts": "administrer_agences",
  "app/api/parametres/plages/[id]/modifier/route.ts": "administrer_agences",
  "app/api/parametres/plages/[id]/supprimer/route.ts": "administrer_agences",
  "app/api/parametres/agences/creer/route.ts": "administrer_agences",
  "app/api/parametres/agences/[id]/modifier/route.ts": "administrer_agences",
  "app/api/parametres/pas-creneau/route.ts": "administrer_agences",
  // D153 (03/10/2026, TP-S3, décision PA-25/D107) — nouvelle capacité
  // `regler_trajets` (ADMS + ADV, direction en lecture seule) : voir
  // `lib/auth/habilitations.ts`.
  "app/api/parametres/trajet-zone/route.ts": "regler_trajets",
  // « Saisir un rapport ».
  "app/api/terrain/[id]/compteur/route.ts": "saisir_rapport",
  // Le rapport de terrain (ticket 17-BON-2) : commentaire, suite à donner,
  // prestations réalisées, photos, signature — même capacité que le
  // compteur, même porte.
  "app/api/terrain/[id]/rapport/route.ts": "saisir_rapport",
  "app/api/terrain/[id]/prestations/route.ts": "saisir_rapport",
  "app/api/terrain/[id]/photos/route.ts": "saisir_rapport",
  "app/api/terrain/[id]/signature/route.ts": "saisir_rapport",
  // Terminer (9DE-TP-CY1) — même capacité, même porte.
  "app/api/terrain/[id]/terminer/route.ts": "saisir_rapport",
  // Les octets d'un document (BON-2) : une LECTURE, protégée par la même
  // capacité que le bon lui-même — pas une capacité neuve pour un octet
  // qu'une lecture cloisonnée protège déjà.
  "app/api/documents/[id]/octets/route.ts": "consulter_planning",
  // D131 (23/09/2026, DROITS-1) — les cinq routes qui ÉCRIVAIENT sans aucune
  // capacité exigée (mesure du 23/09, ticket DROITS-1) : n'importe quel
  // compte de la société, technicien compris, pouvait clôturer, annuler,
  // suspendre, reprendre ou enregistrer une VGP sur l'intervention ou la
  // machine d'un collègue. Le ○ du technicien passe la porte ; le dépôt
  // appelé ensuite juge le PÉRIMÈTRE (SES interventions affectées) — la
  // porte ne le juge jamais (voir `lib/auth/porte.ts`).
  "app/api/interventions/[id]/cloturer/route.ts": "cloturer_intervention",
  "app/api/interventions/[id]/annuler/route.ts": "annuler_intervention",
  "app/api/interventions/[id]/suspendre/route.ts":
    "suspendre_reprendre_intervention",
  "app/api/interventions/[id]/reprendre/route.ts":
    "suspendre_reprendre_intervention",
  "app/api/vgp/enregistrer/[id]/route.ts": "enregistrer_vgp",
};

/**
 * LES ROUTES QUI DOIVENT FERMER LE ○ — `exigerCapaciteComplete`, JAMAIS
 * `exigerCapacite` SIMPLE (D153, TP-S3, condition de réouverture ~:5545 de
 * `docs/arbitrages.md`). `capaciteAppelee` ci-dessus reconnaît les deux
 * portes sans distinguer LAQUELLE est appelée : cette liste, et le test qui
 * la lit, est ce qui rend la condition de réouverture vérifiable. Les treize
 * routes de taux, forfaits, matériel et prestations, plus `trajet-zone`
 * (A1, 9DX-RETOUCHES-11 — PA-25 est la même lecture seule que PA-02).
 */
const PORTE_COMPLETE: readonly string[] = [
  "app/api/parametres/taux-horaire/creer/route.ts",
  "app/api/parametres/forfaits/creer/route.ts",
  "app/api/parametres/forfaits/[id]/activite/route.ts",
  "app/api/parametres/forfaits/[id]/modifier/route.ts",
  "app/api/parametres/materiel/familles/creer/route.ts",
  "app/api/parametres/materiel/familles/[id]/activite/route.ts",
  "app/api/parametres/materiel/familles/[id]/modifier/route.ts",
  "app/api/parametres/materiel/modeles/creer/route.ts",
  "app/api/parametres/materiel/modeles/[id]/activite/route.ts",
  "app/api/parametres/materiel/modeles/[id]/modifier/route.ts",
  "app/api/parametres/prestations/creer/route.ts",
  "app/api/parametres/prestations/[id]/activite/route.ts",
  "app/api/parametres/prestations/[id]/modifier/route.ts",
  "app/api/parametres/trajet-zone/route.ts",
];

/** Quelle PORTE le source appelle réellement — distinct de QUELLE capacité. */
function porteAppelee(
  contenu: string,
): "exigerCapaciteComplete" | "exigerCapacite" | null {
  if (/\bexigerCapaciteComplete\(/.test(contenu))
    return "exigerCapaciteComplete";
  if (/\bexigerCapacite\(/.test(contenu)) return "exigerCapacite";
  return null;
}

// ── LES ROUTES EXEMPTÉES, NOMMÉES AVEC LEUR MOTIF ───────────────────────────

type Exemption = { readonly chemin: string; readonly motif: string };

const EXEMPTIONS: readonly Exemption[] = [
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
    chemin: "app/api/session/code-secours/route.ts",
    motif:
      "établit la session par un code de secours — précède tout rôle, même geste que /api/session/code",
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
  // SELECTEURS-1 (24/09/2026) — quatre routes de LECTURE SEULE, cloisonnées
  // par le contexte (`avecContexteApplicatif`), qui peuplent un sélecteur
  // sur des écrans (`/sites/nouveau`, `/interventions/nouvelle`,
  // `/parc/nouvelle`) qui n'exigent eux-mêmes aucune capacité au-delà d'une
  // société active — même posture que ces écrans, jamais une capacité
  // neuve pour une lecture qu'ils affichaient déjà en clair.
  {
    chemin: "app/api/recherche/clients/route.ts",
    motif:
      "recherche en lecture seule, cloisonnée par le contexte — même posture que /sites/nouveau, /interventions/nouvelle, /parc/nouvelle, qui n'exigent aucune capacité au-delà d'une société active. Depuis QT-2 (D152), ce n'est plus qu'un cloisonnement de société : un technicien restreint sur consulter_parc_complet ne cherche que SON périmètre (perimetreClientDuTechnicien) — une restriction de PÉRIMÈTRE, jamais une capacité qui manquerait ici.",
  },
  {
    chemin: "app/api/recherche/sites/route.ts",
    motif:
      "recherche en lecture seule, cloisonnée par le contexte — même posture que les écrans qui l'appellent. Depuis QT-2 (D152), même périmètre par personne que /api/recherche/clients, composé via `{ client: restriction }`.",
  },
  {
    chemin: "app/api/recherche/modeles/route.ts",
    motif:
      "recherche en lecture seule, cloisonnée par le contexte — même posture que les écrans qui l'appellent. Un modèle de matériel n'appartient à aucun client ni site : QT-2 (D152) ne lui ajoute aucun périmètre par personne.",
  },
  {
    chemin: "app/api/recherche/site/[id]/route.ts",
    motif:
      "lecture des machines/contacts d'UN site, cloisonnée par le contexte — même posture que les écrans qui l'appellent. Depuis QT-2 (D152), un technicien restreint pour qui le client du site est hors périmètre reçoit le même refus qu'un site inexistant (D22, D35).",
  },
];

/** Chaque route mutante d'`app/api/`, chemin relatif à la racine. */
const ROUTES = fichiersSource(["app/api"])
  .filter((f) => f.chemin.endsWith("/route.ts"))
  .map((f) => ({ ...f, contenu: sansCommentaires(f.contenu) }));

const CHEMINS_EXISTANTS = new Set(ROUTES.map((r) => r.chemin));

/**
 * La capacité que le SOURCE d'une route appelle réellement, ou `null`.
 *
 * Reconnaît `exigerCapacite` ET `exigerCapaciteComplete` (TP-S3, D153) : les
 * deux portes gardent une capacité de la même matrice, et ce gardien ne juge
 * jamais LAQUELLE des deux est appelée — seulement QUELLE capacité. Une porte
 * neuve qui garderait une capacité sans que cette regex la reconnaisse
 * rendrait le gardien aveugle à cette route (elle se lirait « sans capacité,
 * sans exemption » et ferait rougir le mauvais test).
 */
function capaciteAppelee(contenu: string): string | null {
  const trouve = /\bexigerCapacite(?:Complete)?\(\s*"([a-z_]+)"/.exec(contenu);
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
    // 68 depuis 9CP-PG-G14B-TRANSMETTRE-GROUPE — la route neuve
    // `app/api/interventions/transmettre/route.ts`, sous `modifier_planning`.
    // 69 depuis 9DE-TP-CY1 — la route neuve
    // `app/api/terrain/[id]/terminer/route.ts`.
    // 70 depuis 9DJ-TP-ACC1-DONNER-ACCES (D162) — la route neuve
    // `app/api/equipe/[id]/envoyer-acces/route.ts`, sous `administrer_utilisateurs`.
    expect(Object.keys(ROUTE_CAPACITE).length).toBe(70);
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

  it("le gardien reconnaît aussi la porte complète (TP-S3, D153)", () => {
    expect(
      capaciteAppelee(
        'const c = await exigerCapaciteComplete("parametrer_societe");',
      ),
    ).toBe("parametrer_societe");
  });

  it("les routes de PORTE_COMPLETE appellent exigerCapaciteComplete, jamais exigerCapacite simple (D153)", () => {
    const revenues = PORTE_COMPLETE.filter((chemin) => {
      const route = ROUTES.find((r) => r.chemin === chemin);
      return (
        route === undefined ||
        porteAppelee(route.contenu) !== "exigerCapaciteComplete"
      );
    });
    expect(
      revenues,
      "une route de PORTE_COMPLETE n'appelle plus exigerCapaciteComplete : " +
        "le ○ y réécrirait de nouveau (PA-02 ou PA-25 se rouvre).",
    ).toEqual([]);
  });

  it("le compte des routes à porte complète est celui annoncé (D153 + A1 de 9DX-RETOUCHES-11)", () => {
    expect(PORTE_COMPLETE.length).toBe(14);
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

// ── `motifDuRefus` — décision d'Alexis du 29/09/2026 ────────────────────────

describe("D-12 — `motifDuRefus`, nommer sans juger", () => {
  it("session absente → « auth.refus », le même refus qu'une connexion", async () => {
    const resultat = await motifDuRefus(async () => null);
    expect(resultat).toBe("auth.refus");
  });

  it("société ou rôle absents → « auth.refus »", async () => {
    const resultat = await motifDuRefus(
      sessionFabriquee({ societeId: null, role: null }),
    );
    expect(resultat).toBe("auth.refus");
  });

  it("session complète (rôle présent) → « auth.refus_droit »", async () => {
    // Même si le rôle n'a en réalité aucune capacité pour le geste tenté :
    // `motifDuRefus` ne le sait pas, et ne le juge pas — elle ne fait que
    // distinguer « pas de session » de « une session, mais refusée ailleurs ».
    const resultat = await motifDuRefus(
      sessionFabriquee({ role: Role.technicien }),
    );
    expect(resultat).toBe("auth.refus_droit");
  });
});
