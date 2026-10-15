/**
 * LE CATALOGUE DES ÉCRANS DE L'AUDIT (9EWC-AUDIT-VISUEL-ECRAN) — une entrée
 * par écran du `CATALOGUE` de
 * `docs/propositions/ergonomie-2026-09-28/maquette-toutes-pages.html`
 * (repéré `const CATALOGUE = [...]`, ~l.5563).
 *
 * Chaque entrée porte :
 * - `cle` : le nom de fichier, dérivé du chemin de la maquette (stable,
 *   indépendant des identifiants réels que la base de l'épreuve produira) ;
 * - `maquetteHash` : le hash à ouvrir dans la maquette, rôle compris ;
 * - `acces` : quelle identité le site attend — `anonyme`, `bureau`
 *   (`admin_societe` de la scène) ou `terrain` (le technicien de la scène) ;
 * - `route` : soit un chemin FIXE, soit une fonction qui en dérive un depuis
 *   les repères résolus en base (`resolution.ts`), soit `null` — la route
 *   n'existe pas sur le site (`absente`, écrit tel quel au rapport) ;
 * - `note` : ce que la route réelle attend, pour le rapport.
 *
 * Le 4ᵉ argument de `E(...)` est le rôle du SÉLECTEUR DE LA MAQUETTE — un
 * paramètre d'URL `?role=`, jamais une identité de l'application. `Role.adv`
 * et `Role.direction` sont utilisés là où le jeton coïncide avec un rôle réel
 * (le gardien `tests/unit/auth/roles-sans-chaine-libre.test.ts` refuse ces
 * deux mots en chaîne libre) ; `"admin"` et `"resp_sav"` restent des chaînes
 * — ce sont des jetons PROPRES à la maquette, qui ne coïncident avec AUCUNE
 * valeur de `Role` (`admin_societe`, `responsable_sav`).
 */

import { Role } from "@/lib/auth/roles";

export type Acces = "anonyme" | "bureau" | "terrain" | "special";

export type Repere = {
  readonly clientId: string | null;
  readonly siteId: string | null;
  readonly siteIdAutre: string | null;
  readonly agenceId: string;
  readonly machineId: string | null;
  readonly demandeId: string | null;
  readonly interventionAPlanifier: string | null;
  readonly interventionEnCours: string | null;
  readonly interventionTerminee: string | null;
  readonly interventionCloturee: string | null;
  readonly interventionSuspendue: string | null;
  readonly interventionAnnulee: string | null;
  readonly interventionAvecBon: string | null;
  readonly interventionTerrainADemarrer: string | null;
  readonly importControle: string | null;
  readonly importApplique: string | null;
  readonly forfaitId: string | null;
};

export type EcranCatalogue = {
  readonly zone: string;
  readonly libelle: string;
  readonly cle: string;
  readonly maquetteHash: string;
  readonly acces: Acces;
  readonly route: string | null | ((r: Repere) => string | null);
  readonly note?: string;
};

// INCLUT LA REQUÊTE — `#/planning` et `#/planning?vue=jour` sont deux écrans
// DISTINCTS du catalogue, et une clé qui ignorerait la requête les ferait
// écrire au MÊME nom de fichier : la seconde capture écraserait la première
// en silence. *Mesuré en construisant cet outil* : les deux entrées
// « Premier accès » / « Lien d'accès expiré » (même chemin, requêtes
// différentes) partageaient une clé avant ce correctif, et la maquette du
// lien NON expiré avait disparu, écrasée par celle du lien expiré.
function cleDe(hashSansRole: string): string {
  return hashSansRole
    .replace(/^#\//, "")
    .replace(/[/?&=]/g, "-")
    .replace(/-+/g, "-")
    .replace(/-$/, "");
}

/** `#/chemin` + `?role=` ou `&role=` selon qu'une requête existe déjà. */
function avecRole(hash: string, role: string): string {
  return hash + (hash.includes("?") ? "&" : "?") + "role=" + role;
}

// DEUX ÉCRANS DU CATALOGUE PEUVENT VISER LE MÊME CHEMIN SOUS DES RÔLES
// DIFFÉRENTS — « App technicien (rôle de bureau) » et « Ma journée »
// partagent `#/terrain`. La clé dérivée du seul chemin collisionnerait pour
// les deux : ce `Set` détecte la collision à la CONSTRUCTION du catalogue et
// désambiguïse par le rôle plutôt que de laisser une capture en écraser une
// autre en silence.
const CLES_VUES = new Set<string>();
function cleUnique(hash: string, role: string): string {
  const base = cleDe(hash);
  if (!CLES_VUES.has(base)) {
    CLES_VUES.add(base);
    return base;
  }
  const avecSuffixe = `${base}-${role}`;
  CLES_VUES.add(avecSuffixe);
  return avecSuffixe;
}

const E = (
  zone: string,
  libelle: string,
  hash: string,
  role: string,
  acces: Acces,
  route: string | null | ((r: Repere) => string | null),
  note?: string,
): EcranCatalogue => ({
  zone,
  libelle,
  cle: cleUnique(hash, role),
  maquetteHash: avecRole(hash, role),
  acces,
  route,
  note,
});

export const CATALOGUE: readonly EcranCatalogue[] = [
  E("Accès", "Connexion", "#/connexion", Role.adv, "anonyme", "/connexion"),
  E(
    "Accès",
    "Code du second facteur (et code de secours)",
    "#/connexion/code",
    Role.direction,
    "special",
    "/connexion/code",
    "Second passage en connexion d'un compte admin_societe déjà enrôlé (capture dédiée).",
  ),
  E(
    "Accès",
    "Mot de passe oublié",
    "#/mot-de-passe-oublie",
    Role.adv,
    "anonyme",
    "/mot-de-passe-oublie",
  ),
  E(
    "Accès",
    "Activer le second facteur",
    "#/enrolement",
    Role.direction,
    "special",
    "/enrolement",
    "Compte admin_societe dédié, jamais enrôlé avant cette capture.",
  ),
  E(
    "Accès",
    "Premier accès (lien d'accès)",
    "#/premier-acces",
    Role.adv,
    "special",
    "/premier-acces",
    "Jeton de premier accès réémis pour un compte de la scène, non consommé avant capture.",
  ),
  E(
    "Accès",
    "Lien d'accès expiré",
    "#/premier-acces?cas=expire",
    Role.adv,
    "special",
    "/premier-acces",
    "Jeton déjà consommé d'un compte de la scène, rejoué.",
  ),
  E(
    "Accès",
    "Choisir la société",
    "#/arrivee",
    Role.adv,
    "special",
    "/arrivee",
    "Compte habilité sur au moins deux sociétés requis ; la scène n'en écrit qu'une par identité.",
  ),
  E(
    "Exploitation",
    "Tableau de bord (une composition par rôle)",
    "#/tableau-de-bord",
    Role.adv,
    "bureau",
    "/tableau-de-bord",
  ),
  E(
    "Exploitation",
    "Indicateurs du mois",
    "#/indicateurs",
    Role.direction,
    "bureau",
    null,
    "Aucune route /indicateurs sur le site.",
  ),
  E(
    "Exploitation",
    "Planning · semaine",
    "#/planning",
    Role.adv,
    "bureau",
    "/planning",
  ),
  E(
    "Exploitation",
    "Planning · jour (frise)",
    "#/planning?vue=jour",
    Role.adv,
    "bureau",
    "/planning?vue=jour",
  ),
  E("Exploitation", "Demandes", "#/demandes", Role.adv, "bureau", "/demandes"),
  E(
    "Exploitation",
    "Qualifier une demande",
    "#/demandes/d31",
    Role.adv,
    "bureau",
    (r) => (r.demandeId ? `/demandes/${r.demandeId}` : null),
    "Première demande trouvée en base (scène ou semis).",
  ),
  E(
    "Exploitation",
    "Interventions (registre à onglets)",
    "#/interventions",
    Role.adv,
    "bureau",
    "/interventions",
  ),
  E(
    "Exploitation",
    "À facturer",
    "#/interventions/a-facturer",
    Role.adv,
    "bureau",
    "/interventions/a-facturer",
  ),
  E(
    "Exploitation",
    "Nouvelle intervention",
    "#/interventions/nouvelle",
    Role.adv,
    "bureau",
    "/interventions/nouvelle",
  ),
  E(
    "Exploitation",
    "Fiche intervention · à planifier (P1)",
    "#/interventions/i452",
    Role.adv,
    "bureau",
    (r) =>
      r.interventionAPlanifier
        ? `/interventions/${r.interventionAPlanifier}`
        : null,
    "Première intervention `a_planifier` trouvée (scène ou semis).",
  ),
  E(
    "Exploitation",
    "Fiche intervention · en cours",
    "#/interventions/i436",
    Role.adv,
    "bureau",
    (r) =>
      r.interventionEnCours ? `/interventions/${r.interventionEnCours}` : null,
    "Première intervention `en_cours` trouvée (semis).",
  ),
  E(
    "Exploitation",
    "Fiche intervention · rapport à valider",
    "#/interventions/i419",
    Role.adv,
    "bureau",
    (r) =>
      r.interventionTerminee
        ? `/interventions/${r.interventionTerminee}`
        : null,
    "Première intervention `terminee` trouvée (rôle `adv` plutôt que `resp_sav` : la scène n'ouvre pas de second compte resp_sav).",
  ),
  E(
    "Exploitation",
    "Fiche intervention · prête à clôturer",
    "#/interventions/i425",
    Role.adv,
    "bureau",
    (r) =>
      r.interventionTerminee
        ? `/interventions/${r.interventionTerminee}`
        : null,
    "Même repère que « rapport à valider » faute d'un second cas distinct dans le temps imparti.",
  ),
  E(
    "Exploitation",
    "Fiche intervention · suspendue",
    "#/interventions/i421",
    Role.adv,
    "bureau",
    (r) =>
      r.interventionSuspendue
        ? `/interventions/${r.interventionSuspendue}`
        : null,
    "Première intervention `suspendue` trouvée (semis), si le semis en pose.",
  ),
  E(
    "Exploitation",
    "Fiche intervention · reprise de l'archive",
    "#/interventions/h0",
    Role.adv,
    "bureau",
    (r) =>
      r.interventionCloturee
        ? `/interventions/${r.interventionCloturee}`
        : null,
    "Première intervention `cloturee` trouvée (semis), comme approximation de l'archive.",
  ),
  E(
    "Exploitation",
    "Bon d'intervention (client / interne)",
    "#/interventions/i431/bon",
    Role.adv,
    "bureau",
    (r) =>
      r.interventionAvecBon
        ? `/interventions/${r.interventionAvecBon}/bon`
        : null,
  ),
  E("Exploitation", "Absences", "#/absences", Role.adv, "bureau", "/absences"),
  E("Clients & parc", "Clients", "#/clients", Role.adv, "bureau", "/clients"),
  E(
    "Clients & parc",
    "Nouveau client",
    "#/clients/nouveau",
    Role.adv,
    "bureau",
    "/clients/nouveau",
  ),
  E(
    "Clients & parc",
    "Fiche client",
    "#/clients/c14",
    Role.adv,
    "bureau",
    (r) => (r.clientId ? `/clients/${r.clientId}` : null),
  ),
  E("Clients & parc", "Sites", "#/sites", Role.adv, "bureau", "/sites"),
  E(
    "Clients & parc",
    "Nouveau site",
    "#/sites/nouveau?client=c10",
    Role.adv,
    "bureau",
    (r) => (r.clientId ? `/sites/nouveau?client=${r.clientId}` : null),
  ),
  E("Clients & parc", "Fiche site", "#/sites/s11", Role.adv, "bureau", (r) =>
    r.siteId ? `/sites/${r.siteId}` : null,
  ),
  E(
    "Clients & parc",
    "Parc machines (maître-détail)",
    "#/parc",
    Role.adv,
    "bureau",
    "/parc",
  ),
  E(
    "Clients & parc",
    "Nouvelle machine",
    "#/parc/nouvelle?site=s18",
    Role.adv,
    "bureau",
    (r) => (r.siteId ? `/parc/nouvelle?site=${r.siteId}` : null),
  ),
  E("Clients & parc", "Fiche machine", "#/parc/m14", Role.adv, "bureau", (r) =>
    r.machineId ? `/parc/${r.machineId}` : null,
  ),
  E(
    "Clients & parc",
    "Corriger la fiche machine",
    "#/parc/m14/modifier",
    Role.adv,
    "bureau",
    (r) => (r.machineId ? `/parc/${r.machineId}/modifier` : null),
  ),
  E("Clients & parc", "VGP · registre", "#/vgp", Role.adv, "bureau", "/vgp"),
  E(
    "Clients & parc",
    "VGP · réserves",
    "#/vgp/reserves",
    Role.adv,
    "bureau",
    null,
    "Aucune route /vgp/reserves sur le site.",
  ),
  E(
    "Clients & parc",
    "VGP · familles à déterminer (onglet)",
    "#/vgp/a-determiner",
    Role.adv,
    "bureau",
    "/vgp/a-determiner",
  ),
  E(
    "Clients & parc",
    "Enregistrer une vérification reçue",
    "#/vgp/enregistrer/m1",
    Role.adv,
    "bureau",
    (r) => (r.machineId ? `/vgp/enregistrer/${r.machineId}` : null),
  ),
  E(
    "Clients & parc",
    "Scan d'une étiquette",
    "#/scan/QR-7F3A9C",
    Role.adv,
    "bureau",
    null,
    "Aucune route /scan sur le site.",
  ),
  E(
    "Paramètres",
    "Paramètres (hub, carte « Identité »)",
    "#/parametres",
    "admin",
    "bureau",
    "/parametres",
  ),
  E(
    "Paramètres",
    "Agences",
    "#/parametres/agences",
    "admin",
    "bureau",
    "/parametres/agences",
  ),
  E(
    "Paramètres",
    "Fiche agence (horaires, fériés, ponts)",
    "#/parametres/agences/a1",
    "admin",
    "bureau",
    (r) => `/parametres/agences/${r.agenceId}`,
  ),
  E(
    "Paramètres",
    "Nouvelle agence",
    "#/parametres/agences/nouvelle",
    "admin",
    "bureau",
    "/parametres/agences/nouvelle",
  ),
  E(
    "Paramètres",
    "Tarifs (taux et forfaits)",
    "#/parametres/tarifs",
    "admin",
    "bureau",
    // DEPUIS 9EWE-PARAMETRES-TARIFS-PAGE-UNIQUE (décisions n° 97 et n° 98
    // d'Alexis, 13/10/2026) : la route existe réellement, taux horaire et
    // forfaits réunis sur une seule page.
    "/parametres/tarifs",
  ),
  E(
    "Paramètres",
    "Trajets par zone",
    "#/parametres/trajets",
    "admin",
    "bureau",
    "/parametres/trajets",
  ),
  E(
    "Paramètres",
    "Prestations",
    "#/parametres/prestations",
    "admin",
    "bureau",
    "/parametres/prestations",
  ),
  E(
    "Paramètres",
    "Référentiel matériel",
    "#/parametres/materiel",
    "admin",
    "bureau",
    "/parametres/materiel",
  ),
  E(
    "Paramètres",
    "Équipe et accès",
    "#/parametres/equipe",
    "admin",
    "bureau",
    "/parametres/equipe",
  ),
  E(
    "Paramètres",
    "Habilitations",
    "#/parametres/habilitations",
    "admin",
    "bureau",
    "/parametres/habilitations",
  ),
  E(
    "Paramètres",
    "Données à compléter",
    "#/parametres/donnees",
    "admin",
    "bureau",
    "/parametres/donnees",
  ),
  E(
    "Paramètres",
    "Journal d'audit",
    "#/parametres/journal",
    "admin",
    "bureau",
    null,
    "Aucune route /parametres/journal sur le site.",
  ),
  E("Paramètres", "Imports Excel", "#/imports", Role.adv, "bureau", "/imports"),
  E(
    "Paramètres",
    "Rapport d'import (contrôlé)",
    "#/imports/L17",
    Role.adv,
    "bureau",
    (r) => (r.importControle ? `/imports/${r.importControle}` : null),
    "Aucun import n'existe si le semis n'en pose pas.",
  ),
  E(
    "Paramètres",
    "Rapport d'import (appliqué, rejets groupés)",
    "#/imports/L16",
    Role.adv,
    "bureau",
    (r) => (r.importApplique ? `/imports/${r.importApplique}` : null),
    "Aucun import n'existe si le semis n'en pose pas.",
  ),
  E(
    "Paramètres",
    "Mon compte",
    "#/compte",
    Role.adv,
    "bureau",
    null,
    "Aucune route /compte sur le site.",
  ),
  E(
    "Paramètres",
    "App technicien (rôle de bureau)",
    "#/terrain",
    "admin",
    "bureau",
    "/terrain",
    "Capturée sous le rôle bureau (admin_societe) : c'est l'écran que ce rôle voit sur /terrain, distinct de la capture terrain ci-dessous.",
  ),
  E(
    "Paramètres",
    "État de l'installation",
    "#/sante",
    Role.adv,
    "anonyme",
    "/sante",
  ),
  E("Terrain", "Ma journée", "#/terrain", "technicien", "terrain", "/terrain"),
  E(
    "Terrain",
    "Intervention à démarrer",
    "#/terrain/i/i440",
    "technicien",
    "terrain",
    (r) =>
      r.interventionTerrainADemarrer
        ? `/terrain/${r.interventionTerrainADemarrer}`
        : null,
  ),
  E(
    "Terrain",
    "Intervention en cours",
    "#/terrain/i/i436",
    "technicien",
    "terrain",
    (r) => (r.interventionEnCours ? `/terrain/${r.interventionEnCours}` : null),
    "Repère partagé avec la fiche back-office « en cours » : même intervention, deux écrans.",
  ),
  E(
    "Terrain",
    "Rapport",
    "#/terrain/i/i436/rapport",
    "technicien",
    "terrain",
    null,
    "Pas de route dédiée : `/terrain/[id]` est une page unique, le rapport s'atteint par une action dans l'écran, non par une URL directe — non couvert dans le temps imparti.",
  ),
  E(
    "Terrain",
    "Signature et fin",
    "#/terrain/i/i436/signature",
    "technicien",
    "terrain",
    null,
    "Même raison que « Rapport » ci-dessus.",
  ),
  E(
    "Terrain",
    "Scanner un QR",
    "#/terrain/scan",
    "technicien",
    "terrain",
    null,
    "Aucune route /terrain/scan sur le site.",
  ),
  E(
    "Terrain",
    "Fiche machine",
    "#/terrain/machine/m4",
    "technicien",
    "terrain",
    null,
    "Aucune route /terrain/machine sur le site.",
  ),
  E(
    "Terrain",
    "Mes machines",
    "#/terrain/machines",
    "technicien",
    "terrain",
    null,
    "Aucune route /terrain/machines sur le site.",
  ),
  E(
    "Terrain",
    "Machine express (recensement)",
    "#/terrain/machine-express",
    "technicien",
    "terrain",
    null,
    "Aucune route /terrain/machine-express sur le site.",
  ),
  E(
    "Terrain",
    "Profil",
    "#/terrain/profil",
    "technicien",
    "terrain",
    "/terrain/profil",
  ),
  E(
    "Hors V1",
    "Portail client (aperçu)",
    "#/portail",
    Role.adv,
    "bureau",
    null,
    "Hors V1 : écarté de cette prise de vue, un compte portail est une identité séparée (D10) hors du temps imparti.",
  ),
];
