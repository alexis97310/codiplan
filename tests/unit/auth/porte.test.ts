import { describe, expect, it } from "vitest";

import { CAPACITES } from "@/lib/auth/habilitations";
import {
  exigerCapacite,
  exigerCapaciteComplete,
  motifDuRefus,
} from "@/lib/auth/porte";
import { Role } from "@/lib/auth/roles";
import { type ContexteSession } from "@/lib/auth/contexte";
import { type SessionServeur } from "@/lib/auth/session";

import { fichiersSource, sansCommentaires } from "../outils/fichiers-source";
import { PORTE_COMPLETE, ROUTE_CAPACITE } from "./route-capacite";

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

/**
 * Quelle PORTE le source appelle réellement — distinct de QUELLE capacité.
 *
 * **R1 (addendum 9DN, relecture 9DX)** — `"les_deux"` existe pour que le test
 * ci-dessous puisse échouer : une route qui appelle `exigerCapaciteComplete(`
 * ET `exigerCapacite(` (un second export, un second verbe HTTP…) n'est PAS
 * une route de porte complète au sens de D153 — elle garde une ouverture, et
 * la détecter exigeait de ne plus retourner tôt sur la première trouvée.
 */
function porteAppelee(
  contenu: string,
): "exigerCapaciteComplete" | "exigerCapacite" | "les_deux" | null {
  const complete = /\bexigerCapaciteComplete\(/.test(contenu);
  const simple = /\bexigerCapacite\(/.test(contenu);
  if (complete && simple) return "les_deux";
  if (complete) return "exigerCapaciteComplete";
  if (simple) return "exigerCapacite";
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
  // 9DU-TP-NAV3-RECHERCHE-RAIL (QE-3, D171) — la recherche GLOBALE du
  // bandeau du bureau, même posture que les quatre routes ci-dessus : une
  // lecture seule, cloisonnée par le contexte, rendue à quiconque a une
  // société active (le bandeau qui l'ouvre, `app/(back-office)/layout.tsx`).
  {
    chemin: "app/api/recherche/route.ts",
    motif:
      "recherche GLOBALE en lecture seule, cloisonnée par le contexte — même posture que les quatre routes de /api/recherche/* ci-dessus. Chaque groupe (clients, sites, machines, interventions) applique son propre périmètre par personne (QT-2, D152) via `lib/navigation/recherche-globale.ts`, jamais une capacité qui manquerait ici.",
  },
  // 9EZ-LOGO-SOCIETE-1 (D87) — lecture SEULE, ouverte à TOUT compte de la
  // société active (c'est elle qui alimente la barre) : `exigerSessionActive`
  // (lib/auth/porte.ts) ne juge qu'une société et un rôle actifs, aucune
  // capacité. Le dépôt et le retrait, eux, exigent `parametrer_societe` et
  // figurent dans ROUTE_CAPACITE.
  {
    chemin: "app/api/societe/logo/route.ts",
    motif:
      "lecture seule du logo de la société active, ouverte à tout compte de cette société — aucune capacité à juger, exactement la posture des routes de /api/recherche/* ci-dessus.",
  },
  // 9I9-MON-COMPTE — change SON PROPRE mot de passe, ouvert à tout compte
  // d'une société active : `exigerSessionActive` (lib/auth/porte.ts) ne juge
  // qu'une société et un rôle actifs, aucune capacité. L'identité qui change
  // réellement vient de la session que Better Auth relit elle-même — jamais
  // d'un paramètre de cette route —, donc aucune capacité de la matrice n'a
  // quoi que ce soit à juger ici.
  {
    chemin: "app/api/session/mon-compte/mot-de-passe/route.ts",
    motif:
      "change le mot de passe du compte connecté, identité prise de la session — même posture que /api/societe/logo ci-dessus : aucune capacité à juger, seulement une société et un rôle actifs.",
  },
  // 9L04-PORTAIL-INVITATION-EN-ATTENTE (D249) — ACCEPTER/REFUSER SON PROPRE
  // rattachement EN ATTENTE, identité prise de la session (jamais d'un
  // paramètre) : MOINS qu'une société active, puisque la réponse précède
  // précisément le choix de société que D249 lui refuse tant qu'elle reste en
  // attente (`lireRole`, `lib/auth/societe-active.ts`). Aucune capacité de la
  // matrice n'a de sens ici — ce n'est pas un acte d'administration, c'est la
  // personne qui répond pour ELLE-MÊME. `accepterRattachementClient` et
  // `refuserRattachementClient` (`lib/auth/lien-d-acces.ts`) filtrent par
  // `utilisateur_id` ET `accepte_le: null` : un identifiant forgé pour la
  // ligne d'autrui, ou déjà traitée, rend le même refus `introuvable` (D50).
  {
    chemin: "app/api/session/rattachements/[id]/accepter/route.ts",
    motif:
      "accepte SON PROPRE rattachement en attente, identité prise de la session — aucune capacité, pas même une société active (D249) : filtré par utilisateur_id dans accepterRattachementClient.",
  },
  {
    chemin: "app/api/session/rattachements/[id]/refuser/route.ts",
    motif:
      "refuse SON PROPRE rattachement en attente, même posture que accepter/route.ts ci-dessus — filtré par utilisateur_id dans refuserRattachementClient.",
  },
  // 9IA (téléphone perdu, décision d'Alexis du 28/10/2026, réponse « A et B »)
  // — aucune capacité de la matrice ne porte cette portée : la décision ne
  // nomme QUE admin_societe (jamais lui-même) et admin_plateforme (sans
  // société active, donc jamais atteint par cette route), ni direction ni
  // aucun autre rôle. `exigerCapacite("administrer_utilisateurs")` aurait
  // laissé passer la direction (D199), que la décision exclut. `exigerSessionActive`
  // ne juge qu'une société et un rôle actifs ; `peutReinitialiserSecondFacteur`
  // (`lib/auth/reinitialisation.ts`) juge la portée elle-même — même doctrine
  // que les routes de portée réduite ci-dessus, appliquée à une matrice
  // dédiée plutôt qu'à la matrice commune.
  {
    chemin: "app/api/equipe/bureau/[id]/reinitialiser-second-facteur/route.ts",
    motif:
      "réinitialise le second facteur d'un compte de bureau — admin_societe (jamais lui-même) ou admin_plateforme, décision du 28/10/2026 : aucune capacité de la matrice commune ne porte cette portée précise (elle exclurait soit la direction, soit admin_plateforme), jugée par peutReinitialiserSecondFacteur plutôt que par la matrice.",
  },
  // 9J10-NOTIFICATIONS-ECRAN — marque lue SA PROPRE notification, ouvert à
  // tout compte d'une société active : `exigerSessionActive`
  // (lib/auth/porte.ts) ne juge qu'une société et un rôle actifs, aucune
  // capacité. C'est `listerNotifications` (9J09, `lib/notifications/
  // depot.ts`) qui a déjà filtré LIGNE PAR LIGNE par la capacité que CHAQUE
  // notification porte — une capacité FIXE ici n'aurait aucun sens à choisir,
  // la ligne visée n'en portant jamais la même d'un appel à l'autre.
  {
    chemin: "app/api/notifications/marquer-lue/route.ts",
    motif:
      "marque lue une notification déjà filtrée par capacité au dépôt (listerNotifications, 9J09) — aucune capacité FIXE à exiger ici, chaque ligne porte la sienne.",
  },
  // 9J03-PORTAIL-CONTACTS (CLI-3) — deux routes du PORTAIL CLIENT (D10, D70),
  // jamais un rôle interne : la matrice de capacités ne juge QUE les rôles
  // internes à une société, et un compte portail n'y figure jamais (D10).
  // Gardées par `contextePortailContact` (app/api/portail/contacts/
  // contexte.ts), qui exige le rôle du portail puis un rattachement désigné
  // et validé en base par `app_poser_perimetre_client` (D70) — même posture
  // que `app/(portail)/portail/page.tsx` en lecture, jamais une seconde
  // matrice de rôles inventée pour l'écriture.
  {
    chemin: "app/api/portail/contacts/creer/route.ts",
    motif:
      "route du portail client (D10, D70) : aucune capacité de la matrice commune ne porte sur ce rôle, gardée par contextePortailContact plutôt que par exigerCapacite — voir app/api/portail/contacts/contexte.ts.",
  },
  {
    chemin: "app/api/portail/contacts/[id]/modifier/route.ts",
    motif:
      "même motif que app/api/portail/contacts/creer/route.ts ci-dessus — route du portail client, gardée par contextePortailContact.",
  },
  // 9J04-PORTAIL-DEMANDES (CLI-4) — même motif que les deux routes de contacts
  // ci-dessus : route du portail client, gardée par `contextePortailDemande`
  // (app/api/portail/demandes/contexte.ts), jamais par exigerCapacite.
  {
    chemin: "app/api/portail/demandes/creer/route.ts",
    motif:
      "route du portail client (D10, D70) : aucune capacité de la matrice commune ne porte sur ce rôle, gardée par contextePortailDemande plutôt que par exigerCapacite — voir app/api/portail/demandes/contexte.ts.",
  },
  // 9J20-PORTAIL-GRILLE-TARIFAIRE (CLI-7) — même motif que les routes du
  // portail ci-dessus : route du portail client, gardée par
  // `contextePortailTarifs` (app/api/portail/tarifs/contexte.ts), jamais par
  // exigerCapacite. Elle ne résout aucun rattachement — le barème ne dépend
  // d'aucun client ni d'aucun site, seulement de la société active (D232).
  {
    chemin: "app/api/portail/tarifs/route.ts",
    motif:
      "route du portail client (D10) : aucune capacité de la matrice commune ne porte sur ce rôle, gardée par contextePortailTarifs plutôt que par exigerCapacite — voir app/api/portail/tarifs/contexte.ts.",
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
    // 71 depuis 9DK-PG-G15A-ABSENCE-ECOURTER — la route neuve
    // `app/api/absences/ecourter/route.ts`.
    // 74 depuis 9DS-TP-MOD1-EXPORTER (D169) — les trois routes neuves des
    // exports `.xlsx` : `app/api/interventions/exporter/route.ts`,
    // `app/api/parc/exporter/route.ts`, `app/api/vgp/exporter/route.ts`.
    // 75 depuis 9EK-TP-UX5-2-CREATIONS-1 — la route neuve
    // `app/api/clients/homonymes/route.ts`.
    // 78 depuis 9ET-COMPTES-BUREAU-1 (D196) — les deux routes neuves
    // `app/api/equipe/bureau/creer/route.ts` et
    // `app/api/equipe/bureau/[id]/envoyer-acces/route.ts`.
    // 80 depuis 9EXA-EQUIPE-TECHNICIENS-MAQUETTE, point 3 (D86) — les deux
    // routes neuves « nouveau lien » : `app/api/equipe/[id]/nouveau-lien/
    // route.ts` et `app/api/equipe/bureau/[id]/nouveau-lien/route.ts`.
    // 82 depuis 9EY-EQUIPE-ALERTE-TOUT-ENVOYER, point 1 — les deux routes
    // neuves `app/api/equipe/envoyer-acces/tous/route.ts` et
    // `app/api/habilitations/attributions/[id]/renouveler/route.ts`.
    // 84 depuis 9EZ-LOGO-SOCIETE-1 (D87) — les deux routes neuves
    // `app/api/parametres/societe/logo/route.ts` et
    // `app/api/parametres/societe/logo/retirer/route.ts`.
    // 85 depuis 9F4H1-HORS-RESEAU-CONSULTATION, point 2 — la route neuve
    // `app/api/terrain/instantane/route.ts`, sous `consulter_planning`.
    // 86 depuis 9H1-RAPPORT-VALIDE-AVANT-CLOTURE — la route neuve
    // `app/api/interventions/[id]/valider-rapport/route.ts`, sous
    // `valider_rapport` (RG-INT-03, D135).
    // 90 depuis 9I6B-LIEN-ACCES-A-COPIER (D170) — les quatre routes neuves
    // « copier le lien » : `app/api/equipe/[id]/copier-lien/route.ts`,
    // `app/api/equipe/[id]/copier-nouveau-lien/route.ts`,
    // `app/api/equipe/bureau/[id]/copier-lien/route.ts` et
    // `app/api/equipe/bureau/[id]/copier-nouveau-lien/route.ts`.
    // 91 depuis 9I7A-MENTIONS-LEGALES-MODIFIABLES — la route neuve
    // `app/api/parametres/societe/mentions-legales/route.ts`.
    // 92 depuis 9I8-AFFICHAGE-DES-MONTANTS — la route neuve
    // `app/api/parametres/societe/afficher-montants/route.ts`.
    // 93 depuis 9I8A1-REPRISE-9I8A — la route neuve
    // `app/api/parametres/tarifs/regle-facturation/route.ts`.
    // 94 depuis 9I8F-STATUT-MACHINE-MODIFIABLE — la route neuve
    // `app/api/machines/[id]/changer-statut/route.ts`.
    // 96 depuis 9J02A-REPRISE-9J02 — les deux routes neuves de l'invitation
    // au portail client, `app/api/clients/[id]/inviter/route.ts` et
    // `app/api/clients/[id]/revoquer-acces/route.ts`.
    // 98 depuis 9J18-SUITE-A-DONNER-ECRAN — les deux routes neuves,
    // `app/api/interventions/suites-a-donner/qualifier/route.ts` et
    // `app/api/interventions/suites-a-donner/[id]/replanifier/route.ts`.
    // 99 depuis 9J19-SUITE-A-DONNER-NOTIFICATIONS — la route neuve
    // `app/api/parametres/societe/delai-relance-suite/route.ts`.
    // 102 depuis 9K05-SUITES-A-DONNER-DEBLOQUEES — les trois routes neuves,
    // `.../[id]/devis-envoye/route.ts`, `.../[id]/accord/route.ts` et
    // `.../[id]/piece-recue/route.ts`.
    // 103 depuis 9K13-TERRAIN-ATTENTE-PIECE — `app/api/terrain/[id]/
    // suspendre/route.ts`.
    // 104 depuis 9K14-PORTAIL-COPIER-NOUVEAU-LIEN (backlog B7) — la route
    // neuve `app/api/clients/[id]/comptes/[utilisateurId]/copier-nouveau-
    // lien/route.ts`.
    // 108 depuis 9K18-CHECKLIST-DOMAINE — `app/api/terrain/[id]/checklist/
    // route.ts` (107 depuis 9K17A-MATERIEL-SOUS-TYPE, ses trois routes de
    // sous-types).
    // 111 depuis 9K19-CHECKLIST-PARAMETRAGE (CK3) — les trois routes
    // neuves de `app/api/parametres/checklists/**` (créer, publier,
    // activité).
    // 113 depuis 9K20-CHECKLIST-DUPLIQUER-DEPART — `.../[id]/dupliquer/
    // route.ts` et `.../gabarit/route.ts`.
    // 114 depuis 9L03C-RETIRER-ACCES-DESACTIVER — `.../equipe/[id]/retirer-acces/
    // route.ts`.
    // 115 depuis 9L04K-REACTIVER-ACCES-INTERNE — son symétrique,
    // `.../equipe/[id]/retablir-acces/route.ts`.
    // 117 depuis 9L04E-TERRAIN-PHOTOS-EPUREES — `.../photos/supprimer/
    // route.ts` et `.../photos/legende/route.ts`.
    // 118 depuis 9L20-DEPLACER-MACHINE — `.../machines/[id]/deplacer/route.ts`.
    // 119 depuis 9L08C-TERRAIN-REPRENDRE-SUSPENSION —
    // `.../terrain/[id]/reprendre/route.ts`.
    expect(Object.keys(ROUTE_CAPACITE).length).toBe(119);
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

  /**
   * R2 (addendum 9DN, relecture 9DX) — REMPLACE un compte écrit à la main
   * (`expect(PORTE_COMPLETE.length).toBe(14)`), que chaque lot qui étend
   * `PORTE_COMPLETE` (9D3 lui ajoute 7 routes) aurait fallu rouvrir pour le
   * corriger — un nombre qui se contente d'ÉCHOUER chaque fois qu'il devient
   * faux n'apprend rien sur CE QUI a changé. Ici, même forme que
   * `CHEMINS_EXISTANTS` pour les `EXEMPTIONS` juste au-dessus : la liste doit
   * suivre le dépôt, jamais l'inverse.
   */
  it("chaque route de PORTE_COMPLETE existe bien parmi les routes analysées (D153)", () => {
    const absentes = PORTE_COMPLETE.filter(
      (chemin) => !CHEMINS_EXISTANTS.has(chemin),
    );
    expect(
      absentes,
      "une route de PORTE_COMPLETE n'existe plus (renommée ou supprimée) : " +
        "la liste doit suivre le dépôt, pas l'inverse.",
    ).toEqual([]);
  });

  /**
   * LE SENS INVERSE (9DW-SOLDE-9DR, O1) : le test ci-dessus ne lit que
   * « liste → route » — chaque entrée de `PORTE_COMPLETE` appelle bien
   * `exigerCapaciteComplete`. Il ne prouve pas l'inverse : qu'une route qui
   * appelle `exigerCapaciteComplete(` soit CONNUE de la liste. Une route
   * neuve qui fermerait le ○ sans y être ajoutée resterait hors de la
   * condition de réouverture de D153 sans qu'aucun gardien ne le dise.
   */
  it("toute route qui appelle exigerCapaciteComplete figure dans PORTE_COMPLETE (D153)", () => {
    const oubliees = ROUTES.filter(
      (r) =>
        /\bexigerCapaciteComplete\(/.test(r.contenu) &&
        !PORTE_COMPLETE.includes(r.chemin),
    ).map((r) => r.chemin);
    expect(
      oubliees,
      "une route appelle exigerCapaciteComplete mais n'est pas dans " +
        "PORTE_COMPLETE : la condition de réouverture de D153 ne la couvre pas.",
    ).toEqual([]);
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

  it("TR-5 (9DK-PG-G15A-ABSENCE-ECOURTER) — le ○ du technicien ouvre `modifier_planning` ici aussi", () => {
    // Depuis que le technicien porte un ○ sur cette capacité pour déclarer SA
    // PROPRE absence, `exigerCapacite("modifier_planning")` le laisse passer
    // — c'est `app/api/absences/declarer/route.ts` qui l'exige, jamais
    // `exigerCapaciteComplete`.
    return exigerCapacite(
      "modifier_planning",
      sessionFabriquee({ role: Role.technicien }),
    ).then((resultat) => {
      expect(resultat?.role).toBe(Role.technicien);
    });
  });
});

describe("D-12 — `exigerCapaciteComplete` ferme le ○ (TR-5, D153)", () => {
  it("le ○ du technicien sur `modifier_planning` ne passe PAS la porte complète", async () => {
    // C'est exactement ce qui protège `app/api/absences/{ecourter,lever}/
    // route.ts` : le technicien peut déclarer sa propre absence (le ○
    // ci-dessus), jamais l'écourter ni la supprimer.
    const resultat = await exigerCapaciteComplete(
      "modifier_planning",
      sessionFabriquee({ role: Role.technicien }),
    );
    expect(resultat).toBeNull();
  });

  it("le ● d'un rôle complet passe la porte complète", async () => {
    const resultat = await exigerCapaciteComplete(
      "modifier_planning",
      sessionFabriquee({ role: Role.admin_societe }),
    );
    expect(resultat?.role).toBe(Role.admin_societe);
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
