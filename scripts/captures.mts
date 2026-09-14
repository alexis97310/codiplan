import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createOTP } from "@better-auth/utils/otp";
import { maintenant } from "@/lib/calendar/fuseau";
import { chromium, type Browser, type Page } from "@playwright/test";

import { CHEMIN_EPREUVE } from "./lib/classeur-epreuve";
import { SURFACE_DECRAN } from "./lib/surface-decran";

/**
 * LES CAPTURES D'ÉCRAN, PRISES PAR UN SCRIPT PLUTÔT QU'À LA MAIN.
 *
 * ## Pourquoi ce script existe
 *
 * Les captures du 09/09/2026 ont été prises à la main. **Une prise de vue
 * manuelle ne se rejoue pas** : elle vieillit sans le dire, et la seule chose
 * qui l'ancre est l'empreinte de commit écrite dans le README — que personne ne
 * regarde tant qu'on n'a pas de doute. *C'est la même famille que le §9 du
 * 31/08 : le silence a exactement la forme du succès.*
 *
 * Ici, la prise de vue est **une commande**. L'empreinte du commit est lue dans
 * `git rev-parse HEAD` au moment de la prise, jamais de mémoire ; l'horodatage
 * est lu à l'horloge ; et le README est RÉÉCRIT par le script, si bien qu'il ne
 * peut pas mentir sur ce qu'il décrit.
 *
 * ## Ce qu'il ne fait pas, et qui reste à la main
 *
 * Il ne prépare pas la base ni le compte : cela demande une base jetable, un
 * seed, et un mot de passe choisi. La procédure est dans le README qu'il écrit,
 * et le script REFUSE plutôt que de photographier des pages de connexion à la
 * place des écrans demandés — *une capture d'écran d'un écran de connexion
 * rangée sous le nom « planning » est pire qu'une capture absente.*
 *
 * Usage :
 *   BASE=http://127.0.0.1:3100 COURRIEL=… MOT_DE_PASSE=… \
 *     pnpm exec tsx scripts/captures.mts
 */

const BASE = process.env.BASE ?? "http://127.0.0.1:3000";
const COURRIEL = process.env.COURRIEL ?? "";
const MOT_DE_PASSE = process.env.MOT_DE_PASSE ?? "";
/**
 * Le secret TOTP d'un compte DÉJÀ enrôlé, quand la prise de vue rejoue sur une
 * base qui en porte un. Vide, le script active le second facteur lui-même et
 * lit la clé sur l'écran — *c'est le chemin d'un humain, et c'est celui-là
 * qu'on veut éprouver.*
 */
const SECRET_TOTP = process.env.SECRET_TOTP ?? "";

/**
 * LE COMPTE PORTAIL — une AUTRE identité, et il en faut réellement une.
 *
 * D10 veut les deux tables exclusives : un compte portail n'a **aucune** ligne
 * dans `utilisateur_societe`. Aucun compte interne ne peut donc atteindre
 * `/portail`, et c'est le seul écran de cette prise de vue pour lequel la
 * seconde identité n'est pas un contournement mais la condition.
 */
const COURRIEL_PORTAIL = process.env.COURRIEL_PORTAIL ?? "";
const MOT_DE_PASSE_PORTAIL = process.env.MOT_DE_PASSE_PORTAIL ?? "";

/**
 * La clé retenue lors de l'activation, pour la durée de la prise de vue.
 *
 * *Elle n'est écrite nulle part* : ni fichier, ni README, ni journal — c'est un
 * secret d'un compte, fût-il de démonstration (I9). Le script l'imprime en fin
 * de course pour qu'une prise de vue ULTÉRIEURE puisse la lui repasser par
 * `SECRET_TOTP`, et c'est le seul endroit où elle apparaît.
 */
let cleActivee = "";
const SORTIE = join(process.cwd(), "docs/captures");

/** Les deux largeurs : poste de travail et téléphone. */
const LARGEURS = [
  { nom: "1280", largeur: 1280, hauteur: 900, quoi: "poste de travail" },
  { nom: "390", largeur: 390, hauteur: 844, quoi: "téléphone" },
] as const;

/**
 * UN SEUL THÈME, PARCE QUE LE PRODUIT N'EN A QU'UN (14/09/2026).
 *
 * La prise de vue photographiait chaque écran deux fois, « clair » et
 * « sombre ». *Mesuré le 14/09/2026 par `cmp` sur les 100 images commises : les
 * 50 paires étaient IDENTIQUES, octet pour octet.* Ce n'était pas une panne du
 * viewer — `lib/theme/apparence.ts` dit qu'il n'y a **PAS d'apparence sombre**,
 * *ce seraient des couleurs que personne n'a validées* —, c'était une prise de
 * vue qui basculait un thème inexistant et rangeait le résultat sous deux noms.
 *
 * **Une seconde image qui ne peut pas différer de la première n'est pas une
 * mesure : elle a la forme d'une preuve et n'en porte aucune** — le §9 du 06/09,
 * appliqué non plus à une ligne de rapport mais à un fichier. Elle coûtait en
 * outre la moitié du temps de prise et la moitié du poids du dépôt.
 *
 * Le segment `clair` RESTE dans le nom des fichiers, et c'est délibéré : la
 * consigne est retirée *jusqu'à nouvel ordre*, pas pour toujours. Le retirer
 * renommerait 50 images et couperait leur historique, pour le rétablir le jour
 * où une palette sombre est déclarée. **Réouverture : le jour où
 * `lib/theme/apparence.ts` déclare une apparence sombre** — cette liste reçoit
 * sa seconde entrée, et les paires divergent alors d'elles-mêmes.
 */
const THEMES = [{ nom: "clair", schema: "light" as const }];

type Ecran = {
  /** Le nom du fichier, sans thème ni largeur. */
  readonly nom: string;
  readonly chemin: string;
  readonly quoi: string;
  /** Faut-il être connecté pour l'atteindre ? */
  readonly authentifie: boolean;
  /** Un texte qui doit être présent : le script REFUSE si l'écran n'est pas le bon. */
  readonly temoin: string;
  /** Pourquoi cet écran peut légitimement être refusé, quand c'est structurel. */
  readonly refusConnu?: string;
  /**
   * SOUS QUELLE SESSION CET ÉCRAN EXISTE.
   *
   * **Trois écrans de ce dépôt n'existent PAS sous la session qui sert au
   * reste de la prise de vue**, et pour trois raisons distinctes : l'un
   * DISPARAÎT quand le second facteur est activé, l'autre n'existe QUE
   * pendant le défi, le troisième appartient à une AUTRE identité. Un drapeau
   * booléen « avant enrôlement » ne pouvait plus les porter — chacun a sa
   * propre passe, et elle est NOMMÉE ici plutôt que devinée là-bas.
   *
   * *Le refus du 10/09 disait « il faudrait une seconde identité » — c'était
   * une impossibilité affirmée sans son coût (§9, 08/09). Pour l'enrôlement il
   * n'en faut pas ; pour le portail il en faut une, et c'est écrit.*
   */
  readonly passe?: PasseNommee;
  /**
   * LE CHEMIN SE DÉCOUVRE SUR L'ÉCRAN PRÉCÉDENT, il ne s'écrit pas ici.
   *
   * Le détail d'une intervention porte un identifiant que chaque semis change :
   * un chemin écrit en dur serait juste le jour de sa rédaction et périmé le
   * lendemain — *et il ne rougirait pas, il photographierait une page d'erreur
   * sous le nom de l'écran.* La fonction lit le premier lien réellement rendu
   * par le planning ; sans lien, elle refuse.
   */
  readonly decouvrir?: (page: Page) => Promise<string>;
};

/**
 * Les passes, NOMMÉES. La session ordinaire n'en est pas une : elle est
 * l'absence de passe.
 */
type PasseNommee =
  "avant-enrolement" | "defi-second-facteur" | "portail" | "sans-societe";

const ECRANS: readonly Ecran[] = [
  {
    nom: "accueil",
    chemin: "/",
    quoi: "La page d'accueil.",
    authentifie: false,
    temoin: "CODIPLAN",
  },
  {
    nom: "connexion",
    chemin: "/connexion",
    quoi: "La page de connexion.",
    authentifie: false,
    temoin: "Connexion",
  },
  {
    // **LA SEULE PORTE D'UNE BASE NEUVE** (D65) : le seed n'attribue aucun mot
    // de passe, et cet écran est l'unique endroit où l'on en choisit un. Il
    // rendait 404 jusqu'au 11/09 — *une porte manquante que personne ne voyait,
    // parce qu'aucune capture ne la cherchait.*
    //
    // Le jeton de l'URL est FACTICE, et c'est un choix : la page rend son
    // formulaire dès qu'un `token` non vide est présent, sans le valider, si
    // bien qu'un vrai jeton donnerait exactement la même image — au prix de le
    // consommer avant que la prise de vue en ait besoin. *Ce que l'image
    // montre est le formulaire, jamais la validité d'un jeton.*
    nom: "premier-acces",
    chemin: "/premier-acces?token=jeton-de-demonstration",
    quoi: "Le choix du premier mot de passe — **la seule porte d'une base neuve**. Le jeton de l'URL est factice : l'écran rend son formulaire sans le valider.",
    authentifie: false,
    temoin: "Choisissez votre mot de passe",
  },
  {
    nom: "sante",
    chemin: "/sante",
    quoi: "L'état de l'installation, **sans compte**.",
    authentifie: false,
    temoin: "installation",
  },
  {
    // **L'écran où atterrit un compte à rôle sensible**, et c'est une garantie
    // et non un obstacle : un rôle qui exige un second facteur ne va nulle part
    // avant de l'avoir activé. C'est ce qui fait que `/arrivee` est REFUSÉE
    // ci-dessous plutôt que photographiée — le script le dit au lieu de
    // photographier autre chose sous ce nom.
    nom: "enrolement",
    chemin: "/enrolement",
    quoi: "L'activation du second facteur, où atterrit un rôle sensible avant tout le reste.",
    authentifie: true,
    temoin: "second facteur",
    passe: "avant-enrolement",
    refusConnu:
      "Cet écran se photographie AVANT l'activation du second facteur, dans " +
      "sa propre passe : la session enrôlée qui sert au reste de la prise de " +
      "vue ne le voit plus. S'il est refusé, la cause est donc que LE COMPTE " +
      "PORTE DÉJÀ un second facteur — repartir d'une base fraîchement semée " +
      "(`pnpm db:seed`), la clé d'un enrôlement passé n'étant pas rejouable.",
  },
  {
    nom: "arrivee",
    chemin: "/arrivee",
    quoi: "La page d'arrivée — qui vous êtes, pour quelle société.",
    authentifie: true,
    temoin: "société",
  },
  {
    // **L'ÉTAT D'ARRIVÉE D'UN COMPTE MULTI-SOCIÉTÉ, ET IL N'AVAIT JAMAIS ÉTÉ
    // PHOTOGRAPHIÉ** (13/09/2026). L'écran `arrivee` ci-dessus est pris APRÈS
    // que la prise de vue a cliqué une société : il montre donc une société
    // active et un bouton d'entrée. *L'état qu'un compte habilité sur deux
    // sociétés rencontre en ARRIVANT — aucune active, deux boutons, pas
    // d'entrée — n'était visible nulle part.*
    //
    // Et c'est exactement ce qui a permis à trois documents d'affirmer, deux
    // jours durant, une impasse que le code avait déjà levée : §5.4 de la note
    // de mise en ligne, l'en-tête de `tests/isolation/premier-ecran.test.ts`,
    // et la prose de L2-11. **Une assertion dit qu'une valeur est juste ;
    // seule une image dit qu'un écran a du sens** (§9, 09/09) — et ici
    // l'absence d'image était la cause, pas le symptôme.
    nom: "arrivee-sans-societe",
    chemin: "/arrivee",
    quoi: "L'arrivée d'un compte habilité sur PLUSIEURS sociétés, avant d'en avoir choisi une : le sélecteur, et aucune société active.",
    authentifie: true,
    temoin: "Choisir la société",
    passe: "sans-societe",
    refusConnu:
      "Cette image exige un compte habilité sur AU MOINS DEUX sociétés — sur " +
      "la démonstration, `direction@codima.test`. Avec un compte mono-société, " +
      "la connexion active la seule habilitation (D35) et le sélecteur ne " +
      "s'affiche pas : le refus est alors juste, et il dit que COURRIEL " +
      "désigne le mauvais compte.",
  },
  {
    nom: "planning",
    chemin: "/planning",
    quoi: "Le planning : la charge par technicien, la file d'attente et les interventions posées.",
    authentifie: true,
    temoin: "Planning",
  },
  {
    // ── LA VUE JOUR N'AVAIT JAMAIS ÉTÉ PHOTOGRAPHIÉE (14/09/2026) ───────────
    //
    // `/planning` rend la vue SEMAINE ; la vue JOUR est un autre écran sous le
    // même chemin, et **elle ne montre pas la même population** — ses colonnes
    // viennent du référentiel des techniciens actifs, celles de la semaine des
    // interventions.
    //
    // *C'est là que le défaut du 14/09 vivait* : deux colonnes intitulées
    // « Technicien 01a09565 », faute d'avoir demandé les noms des personnes qui
    // n'avaient aucune intervention ce jour-là. **Aucune image n'aurait pu le
    // montrer** — il n'y en avait pas. Un écran livré et jamais photographié
    // est un écran que personne ne relit.
    nom: "planning-jour",
    chemin: "/planning?vue=jour",
    quoi: "La vue JOUR du planning : une colonne par technicien ACTIF, occupé ou non — c'est l'écran qui montre les trous.",
    authentifie: true,
    temoin: "Planning",
  },
  {
    // LE RAPPORT, et son chemin se DÉCOUVRE : une base semée ne porte aucun
    // lot, et l'identifiant change à chaque exécution.
    nom: "imports-rapport",
    chemin: "/imports",
    decouvrir: rapportDUnImport,
    quoi: "Le rapport de contrôle d'un import : ce qui sera créé, ce qui sera modifié, ce qui est rejeté et pourquoi — AVANT toute écriture (I6).",
    authentifie: true,
    temoin: "Rapport",
    refusConnu:
      "Cet écran n'existe qu'après un téléversement. Le classeur déposé est " +
      "celui que `scripts/fabriquer-classeur-epreuve.mts` fabrique — trois " +
      "raisons sociales INVENTÉES (I9). Un refus ici dit que le téléversement " +
      "n'a pas abouti, jamais que l'écran est cassé.",
  },
  {
    // ── L'ÉCRAN D'IMPORT (L1-11) ────────────────────────────────────────────
    //
    // *La barre le portait, inerte, depuis l'origine* — et elle nommait le
    // mauvais ticket. La première image de cet écran est aussi celle qui
    // montre les QUATRE types qu'on sait contrôler sans savoir les appliquer :
    // ils sont NOMMÉS plutôt que proposés, et c'est une décision qui ne se
    // relit que là.
    //
    // **IL EST PHOTOGRAPHIÉ APRÈS LE RAPPORT**, et l'ordre est une décision :
    // une base fraîchement semée ne porte AUCUN lot, et le journal des
    // chargements se photographierait VIDE — *un tableau de huit colonnes que
    // personne n'aurait jamais vu rendu.* C'est la leçon de R3-10, appliquée
    // à l'ORDRE de la prise plutôt qu'au semis.
    nom: "imports",
    chemin: "/imports",
    quoi: "Les imports Excel : le dépôt d'un classeur, ce qu'on sait appliquer et ce qu'on ne sait que contrôler, et le journal des chargements.",
    authentifie: true,
    temoin: "Imports",
  },
  {
    nom: "intervention-creation",
    chemin: "/planning/nouvelle",
    quoi: "La création d'une intervention depuis le planning.",
    authentifie: true,
    temoin: "intervention",
  },
  {
    // L'écran des CINQ ACTIONS du cycle de vie (D84). Son chemin porte un
    // identifiant : il se découvre sur le planning, il ne s'écrit pas ici.
    nom: "intervention-detail",
    chemin: "/planning",
    decouvrir: premierLienDIntervention,
    quoi: "Le détail d'une intervention, et les actions que son statut autorise.",
    authentifie: true,
    temoin: "Intervention",
    refusConnu:
      "Cet écran n'existe que si le planning porte au moins une intervention. " +
      "Sur une base sans semis de démonstration, le refus est LÉGITIME et dit " +
      "exactement cela — il ne se confond pas avec un écran cassé.",
  },
  {
    // **LE PARC, ET IL N'AVAIT JAMAIS ÉTÉ PHOTOGRAPHIÉ** — R2-21 l'a livré, et
    // aucune image ne le montrait. *L'arbitre du projet lit le dépôt : il
    // n'atteint ni le site authentifié ni un serveur local.* Un écran livré et
    // jamais photographié est un écran qu'il ne peut pas juger.
    nom: "parc",
    chemin: "/parc",
    quoi: "Le parc machines — le résumé compté SUR LES LIGNES RENDUES, jamais par une seconde requête.",
    authentifie: true,
    temoin: "Parc machines clients",
  },
  {
    // **L'ÉCRAN QU'UN TICKET MARQUÉ `LIVRÉ` N'AVAIT PAS** (14/09/2026). L1-01
    // portait la table, la saisie et le dépôt depuis le 08/09, et *zéro route,
    // zéro écran* : c'est le cas qui a fait amender le critère de la file
    // (R3-12). On y arrive par « Sociétés & tarifs », cinquième carte.
    nom: "clients",
    chemin: "/clients",
    quoi: "Le référentiel client — UN SEUL compteur, celui qui nomme un geste (RG-IMP-05, D29).",
    authentifie: true,
    temoin: "Clients",
  },
  {
    nom: "client-creation",
    chemin: "/clients/nouveau",
    quoi: "La création d'une fiche — la société vient de la session, jamais d'une saisie.",
    authentifie: true,
    temoin: "Nouveau client",
  },
  {
    // Son chemin porte un identifiant : il se DÉCOUVRE sur la liste, il ne
    // s'écrit pas ici. *Un chemin en dur serait juste le jour de sa rédaction
    // et photographierait une page d'erreur le lendemain, sans rougir.*
    nom: "client-detail",
    chemin: "/clients",
    decouvrir: premierLienDeClient,
    quoi: "La fiche d'un client — ses lieux, ses dernières interventions, et le bloc Contacts qui NOMME son absence (D88).",
    authentifie: true,
    temoin: "Dernières interventions",
    refusConnu:
      "Cet écran n'existe que si le référentiel porte au moins un client. " +
      "Sur une base sans semis de démonstration, le refus est LÉGITIME et dit " +
      "exactement cela — il ne se confond pas avec un écran cassé.",
  },
  {
    // **UN AUTRE ÉCRAN QUE LA BARRE N'ATTEINT PAS** (D95) : on y arrive par un
    // lien depuis le planning — *un blocage d'agenda n'est pas un paramètre de
    // société, c'est un fait de planning.*
    //
    // Le témoin porte sur le TITRE de l'écran, et il a changé avec l'arbitrage
    // du 14/09 : « Absences » est devenu « Blocages d'agenda », CODIPLAN
    // n'étant pas un outil de gestion des ressources humaines. *Un témoin resté
    // sur l'ancien mot aurait refusé l'écran juste.*
    nom: "absences",
    chemin: "/absences",
    quoi: "Les blocages d'agenda — une personne, une période, et RIEN d'autre (R3-14). Aucun créneau n'est proposé (D106).",
    authentifie: true,
    temoin: "Blocages d'agenda",
  },
  {
    // **L'ÉCRAN QUE LA BARRE N'ATTEINT PAS** (D95, liste close de onze entrées).
    // On y arrive par le LIEU d'une intervention, puis par la fiche du site —
    // et, depuis R3-08, par la page de paramétrage.
    nom: "sites",
    chemin: "/sites",
    quoi: "Les lieux d'intervention, avec leur RATTACHEMENT à côté du temps de trajet (D56).",
    authentifie: true,
    temoin: "Sites",
  },
  {
    // **CELUI QUI A OUVERT R3-08** : il existait depuis R3-03 et AUCUN lien n'y
    // menait. *Alexis avait demandé que les temps de trajet soient
    // paramétrables ; ils l'étaient, et personne ne pouvait y arriver.*
    nom: "parametres-trajets",
    chemin: "/parametres/trajets",
    quoi: "Les temps de trajet par zone — des DÉFAUTS qui se règlent, et la cascade rend son ORIGINE (D107).",
    authentifie: true,
    temoin: "Temps de trajet par zone",
  },
  {
    // LA PORTE que R3-08 a construite : la barre mène ici, et d'ici aux trois
    // écrans de réglage. Sans elle, deux d'entre eux n'avaient aucun chemin.
    nom: "parametres",
    chemin: "/parametres",
    quoi: "La porte des écrans de paramétrage (R3-08) — elle ne lit aucune base et ne compte rien.",
    authentifie: true,
    temoin: "Sociétés & tarifs",
  },
  {
    // **LE REGISTRE DES VGP** (lot 9, D88). Ce qu'une image montre ici et
    // qu'aucune assertion ne dirait : « sans information depuis X » s'affiche
    // À CÔTÉ des lignes renseignées, et les deux ne se ressemblent pas.
    nom: "vgp",
    chemin: "/vgp",
    quoi: "Le registre des vérifications périodiques. CODIPLAN n'affirme JAMAIS la conformité : il dit ce qu'on lui a dit (D88).",
    authentifie: true,
    temoin: "Registre des v\u00e9rifications p\u00e9riodiques",
  },
  {
    // TROIS valeurs sur la famille, jamais une case à cocher : une famille
    // « à déterminer » est visible, et c'est tout l'objet de cet écran.
    nom: "vgp-a-determiner",
    chemin: "/vgp/a-determiner",
    quoi: "Les familles dont l'assujettissement n'a pas été tranché — une case décochée serait indiscernable d'une famille jamais examinée.",
    authentifie: true,
    temoin: "Familles \u00e0 d\u00e9terminer",
  },
  {
    nom: "parametres-agences",
    chemin: "/parametres/agences",
    quoi: "Les horaires d'ouverture, réglés **par agence** — I7, jamais un calendrier global.",
    authentifie: true,
    temoin: "horaires d'ouverture",
  },
  {
    nom: "parametres-forfaits",
    chemin: "/parametres/forfaits",
    quoi: "Le catalogue des forfaits et leur RANG (D86). Il naît vide : les valeurs sont à l'exploitation.",
    authentifie: true,
    temoin: "Forfaits",
  },
  {
    // **LE PREMIER ÉCRAN QU'UN COMPTE PORTAIL PUISSE ATTEINDRE** (D92). La
    // dixième forme de politique a été écrite pour lui ; jusqu'ici, rien ne
    // l'avait montré. Il exige une AUTRE identité — celle-là, la seconde
    // identité est réellement nécessaire, et c'est mesuré plutôt qu'affirmé :
    // un compte portail n'a AUCUNE ligne dans `utilisateur_societe` (D10), donc
    // aucun compte interne ne peut atteindre cet écran.
    nom: "portail",
    chemin: "/portail",
    quoi: "Le portail client, en **consultation seule** — le parc du client, son périmètre de sites, et les emplacements TENUS ET DITS VIDES des documents et des VGP.",
    authentifie: true,
    passe: "portail",
    temoin: "Votre parc",
    refusConnu:
      "Cet écran demande un compte PORTAIL, distinct du compte interne qui " +
      "sert au reste de la prise de vue : `COURRIEL_PORTAIL` et " +
      "`MOT_DE_PASSE_PORTAIL`. Sans eux, le refus dit qu'il manque une " +
      "identité, jamais que l'écran est cassé. ET AUCUN COMPTE PORTAIL NE " +
      "PEUT EN RECEVOIR AUJOURD'HUI (mesuré le 10/09/2026) : le seul " +
      "émetteur d'un lien de premier accès est le geste d'amorçage, qui " +
      "EXIGE une habilitation dans `utilisateur_societe` — et un compte " +
      "portail n'en a aucune, par D10. Refus littéral : « L'identité " +
      "portail@example.test n'est pas habilitée sur la société … ». La " +
      "chaîne d'ENTRÉE du portail est donc murée un cran au-dessus de ce " +
      "que D92 a ouvert : D92 a rendu le rattachement LISIBLE, rien ne " +
      "rend le compte CONNECTABLE. C'est un arbitrage, pas un ticket.",
  },
  {
    // L'écran du DÉFI, qui n'existe qu'entre le mot de passe et la session.
    // Il ne se photographie ni avant l'enrôlement — il n'existe pas encore —,
    // ni sous la session ordinaire — elle l'a déjà franchi.
    nom: "connexion-code",
    chemin: "/connexion/code",
    quoi: "Le défi du second facteur, entre le mot de passe et la session.",
    authentifie: true,
    passe: "defi-second-facteur",
    temoin: "Code à six chiffres",
    refusConnu:
      "Cet écran n'existe QUE pendant un défi : il demande une connexion qui " +
      "s'arrête là, sans saisir le code. Si le compte ne porte pas de second " +
      "facteur, il n'y a pas de défi — et le refus est alors la mesure d'un " +
      "compte non enrôlé, jamais celle d'un écran manquant.",
  },
];

/**
 * LE PREMIER LIEN D'INTERVENTION RÉELLEMENT RENDU PAR LE PLANNING.
 *
 * *Un identifiant écrit en dur dans ce fichier serait juste le jour de sa
 * rédaction, et périmé au semis suivant — sans rougir : il photographierait
 * une page d'erreur sous le nom de l'écran.* On lit donc ce que l'écran
 * précédent propose, comme le ferait quelqu'un qui clique.
 */
/**
 * LE RAPPORT D'IMPORT SE DÉCOUVRE EN TÉLÉVERSANT (L1-11).
 *
 * **Une base fraîchement semée ne porte AUCUN lot** — le semis n'importe rien,
 * et c'est juste : *un lot d'import est un geste, pas une donnée de
 * démonstration.* Le rapport n'a donc aucun chemin à écrire en dur, et il n'en
 * aurait pas de stable : son identifiant change à chaque exécution.
 *
 * La prise de vue fait donc **ce qu'un humain fait** : elle dépose le classeur
 * et suit là où l'écran la mène. Le classeur est celui que
 * `scripts/fabriquer-classeur-epreuve.mts` FABRIQUE — *aucun fichier de données
 * réelles n'entre au dépôt, jamais, et un dépôt rendu public publie aussi son
 * passé* (I9).
 *
 * **Elle REFUSE plutôt que de photographier l'index** : si le téléversement
 * échoue, l'écran reste `/imports` avec un motif, et une image de l'index
 * rangée sous le nom « rapport » serait pire qu'une image absente.
 */
async function rapportDUnImport(page: Page): Promise<string> {
  // **ELLE RÉUTILISE UN LOT S'IL EN EXISTE UN**, et ce n'est pas une économie :
  // la prise de vue photographie CHAQUE écran en quatre variantes, et déposer
  // le classeur à chaque fois laisserait QUATRE lignes identiques au journal
  // des chargements — *une image qui se lit comme un défaut alors qu'elle
  // montre le harnais.* Mesuré : 4 lots pour un seul fichier, à la première
  // exécution.
  const dejaLa = await page
    .locator('a[href^="/imports/"]')
    .evaluateAll((elements) =>
      elements
        .map((element) => element.getAttribute("href") ?? "")
        .filter((href) => /^\/imports\/[0-9a-f-]{36}$/.test(href)),
    );
  if (dejaLa.length > 0) {
    return dejaLa[0];
  }

  await page
    .locator('input[name="classeur"]')
    .setInputFiles(join(process.cwd(), CHEMIN_EPREUVE));
  // **LE BOUTON SE DÉSIGNE PAR SON FORMULAIRE, jamais par son libellé.** Lire
  // le dictionnaire ici ferait de ce script un fichier qui RESTITUE aux yeux du
  // gardien de la surface d'écran — *et il aurait raison de ne pas savoir : ce
  // script PILOTE des écrans, il n'en est pas un.* L'action du formulaire est
  // par ailleurs plus stable qu'un libellé, qui se reformule.
  await page.locator('form[action="/api/imports/controler"] button').click();
  await page.waitForURL(/\/imports\/[0-9a-f-]{36}$/, { timeout: 10_000 });
  const chemin = new URL(page.url()).pathname;
  if (!/^\/imports\/[0-9a-f-]{36}$/.test(chemin)) {
    throw new Error(
      `le téléversement n'a pas mené à un rapport : ${page.url()} — la capture ` +
        "est refusée plutôt que prise sur l'index sous le nom du rapport.",
    );
  }
  return chemin;
}

async function premierLienDIntervention(page: Page): Promise<string> {
  const chemins = await page
    .locator('a[href^="/planning/"]')
    .evaluateAll((elements) =>
      elements
        .map((element) => element.getAttribute("href") ?? "")
        .filter(
          (href) => href !== "/planning/nouvelle" && href !== "/planning",
        ),
    );
  if (chemins.length === 0) {
    throw new Error(
      "le planning ne porte aucun lien d'intervention : il n'y a rien à " +
        "détailler, et la capture est refusée plutôt que prise sur une page " +
        "d'erreur.",
    );
  }
  return chemins[0];
}

/**
 * LE PREMIER LIEN DE FICHE CLIENT rendu par la liste.
 *
 * Même raison que `premierLienDIntervention`, et même refus : *sans lien, on ne
 * photographie pas une page d'erreur sous le nom de l'écran.* Les liens de
 * création sont écartés nommément — `/clients/nouveau` est un écran à lui, déjà
 * photographié, et le prendre pour une fiche rendrait deux fois la même image
 * sous deux noms.
 */
async function premierLienDeClient(page: Page): Promise<string> {
  const chemins = await page
    .locator('a[href^="/clients/"]')
    .evaluateAll((elements) =>
      elements
        .map((element) => element.getAttribute("href") ?? "")
        .filter((href) => href !== "/clients/nouveau" && href !== "/clients"),
    );
  if (chemins.length === 0) {
    throw new Error(
      "la liste ne porte aucun lien de fiche client : il n'y a rien à " +
        "détailler, et la capture est refusée plutôt que prise sur une page " +
        "d'erreur.",
    );
  }
  return chemins[0];
}

function empreinte(): { court: string; long: string } {
  const long = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
  return { court: long.slice(0, 7), long };
}

/**
 * Se connecte, et REFUSE si la connexion n'a pas abouti.
 *
 * *Une session qui échoue en silence ferait photographier six fois la page de
 * connexion sous six noms différents* — un rapport faux, et exactement le
 * genre de faux qu'un lecteur ne peut pas détecter.
 */
/**
 * ACTIVE LE SECOND FACTEUR SI L'ÉCRAN LE RÉCLAME.
 *
 * **Ce n'est pas un contournement de la sécurité, c'est le chemin réel.** Un
 * rôle sensible n'atteint aucun écran avant d'avoir activé son second facteur
 * (D58), et une prise de vue qui n'en tiendrait pas compte photographierait
 * douze fois la page d'enrôlement sous douze noms différents — *c'est ce qui
 * est arrivé le 10/09, et c'est l'image qui l'a montré, pas l'assertion.*
 *
 * La clé est lue SUR L'ÉCRAN, là où un humain la lirait ; le code à six
 * chiffres est calculé avec la même bibliothèque que la vérification.
 */
async function activerSecondFacteur(page: Page): Promise<void> {
  if (!page.url().includes("/enrolement")) {
    return;
  }
  await page.fill('input[name="motDePasse"]', MOT_DE_PASSE);
  await page.click('button[type="submit"]');
  await page.waitForLoadState("networkidle");

  const affichee = (await page.locator("code").first().innerText()).replace(
    /\s+/g,
    "",
  );
  // **L'ÉCRAN MONTRE LA CLÉ EN BASE32**, parce que c'est ce qu'une application
  // d'authentification sait lire ; la vérification, elle, calcule le code sur
  // le secret BRUT. Les deux sont la même chose sous deux graphies, et les
  // confondre rend un code refusé sans que rien ne dise pourquoi — *mesuré :
  // « Ce code n'est pas valide », sur une clé parfaitement juste.*
  const cle = base32VersBrut(affichee);
  if (cle === "") {
    throw new Error(
      "L'écran d'enrôlement n'a pas révélé de clé : la préparation a échoué, " +
        "et aucun code ne peut être calculé.",
    );
  }
  cleActivee = cle;
  await page.fill('input[name="code"]', await codeCourant(cle));
  await page.click('button[type="submit"]');
  await page.waitForLoadState("networkidle");
}

/**
 * ACTIVE UNE SOCIÉTÉ SI LE COMPTE N'EN A PAS.
 *
 * **Un compte habilité sur deux sociétés n'en a aucune d'active à la
 * connexion** — la connexion n'établit que l'identité (D35). Sans ce geste,
 * tout écran cloisonné redirige vers l'arrivée, et la prise de vue
 * photographierait la page d'arrivée sous le nom du planning. *C'est ce qui est
 * arrivé le 10/09, deux fois : d'abord parce que l'écran de choix n'existait
 * pas, ensuite parce que le script ne le CLIQUAIT pas.*
 *
 * Le premier bouton est choisi, et lequel importe peu : ce que la prise de vue
 * doit montrer est un planning garni, et les deux sociétés de démonstration en
 * ont un depuis le 10/09.
 */
async function choisirUneSociete(page: Page): Promise<void> {
  await page.goto(`${BASE}/arrivee`, { waitUntil: "networkidle" });
  const bouton = page
    .locator('form[action="/api/session/societe"] button[type="submit"]')
    .first();
  if ((await bouton.count()) === 0) {
    return;
  }
  await bouton.click();
  await page.waitForLoadState("networkidle");
}

async function codeCourant(secret: string): Promise<string> {
  return createOTP(secret, { digits: 6, period: 30 }).totp();
}

/** La clé affichée est en base32 ; le secret vérifié est ce qu'elle encode. */
function base32VersBrut(base32: string): string {
  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const caractere of base32.replace(/=+$/, "").toUpperCase()) {
    const index = ALPHABET.indexOf(caractere);
    if (index === -1) {
      throw new Error(`Clé affichée illisible : « ${caractere} » hors base32.`);
    }
    bits += index.toString(2).padStart(5, "0");
  }
  let brut = "";
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    brut += String.fromCharCode(Number.parseInt(bits.slice(i, i + 8), 2));
  }
  return brut;
}

async function seConnecter(page: Page, choisir = true): Promise<void> {
  // **DEUX TOURS, ET LE SECOND N'EST PAS UNE PRÉCAUTION.** L'application
  // DÉCONNECTE volontairement après l'activation d'un second facteur — la
  // session d'avant ne vaut plus, ce qui est le bon geste. Un script qui ne
  // ferait qu'un tour conclurait donc à l'échec sur le chemin nominal d'un
  // compte neuf, et photographierait la page de connexion.
  for (let tour = 1; tour <= 2; tour += 1) {
    await page.goto(`${BASE}/connexion`, { waitUntil: "networkidle" });
    // Les champs sont désignés par leur `name`, qui est ce que le formulaire
    // ENVOIE : un libellé se traduit, se reformule, et changerait ce script
    // sans que la fonctionnalité bouge.
    await page.fill('input[name="email"]', COURRIEL);
    await page.fill('input[name="motDePasse"]', MOT_DE_PASSE);
    await page.click('button[type="submit"]');
    await page.waitForLoadState("networkidle");

    // Le défi de second facteur, quand le compte est déjà enrôlé.
    const secret = SECRET_TOTP === "" ? cleActivee : SECRET_TOTP;
    if (page.url().includes("/connexion/code") && secret !== "") {
      await page.fill('input[name="code"]', await codeCourant(secret));
      await page.click('button[type="submit"]');
      await page.waitForLoadState("networkidle");
    }
    await activerSecondFacteur(page);

    if (!page.url().includes("/connexion")) {
      // **LE CHOIX EST UNE OPTION, PAS UNE ÉTAPE** (13/09/2026). La passe
      // « sans-societe » a besoin de l'état EXACT que rencontre un compte
      // multi-société en arrivant, et cliquer le détruirait — c'est le seul
      // état où le sélecteur se lit sans société active.
      if (choisir) {
        await choisirUneSociete(page);
      }
      return;
    }
  }

  const url = page.url();
  throw new Error(
    `La connexion n'a pas abouti : la page est restée sur ${url}. ` +
      (url.includes("/connexion/code")
        ? "Le compte porte DÉJÀ un second facteur et la clé n'est pas connue " +
          "de cette prise de vue : repasser `SECRET_TOTP`, ou repartir d'une " +
          "base fraîchement semée. "
        : "") +
      "Aucune capture authentifiée ne sera prise — mieux vaut aucune image " +
      "qu'une page de connexion rangée sous le nom d'un autre écran.",
  );
}

async function photographier(
  navigateur: Browser,
  ecran: Ecran,
  theme: (typeof THEMES)[number],
  format: (typeof LARGEURS)[number],
  cookies: Awaited<ReturnType<Browser["newContext"]>> | null,
): Promise<void> {
  const contexte =
    cookies ??
    (await navigateur.newContext({
      viewport: { width: format.largeur, height: format.hauteur },
      colorScheme: theme.schema,
      locale: "fr-FR",
    }));
  const page = await contexte.newPage();
  await page.setViewportSize({ width: format.largeur, height: format.hauteur });
  await page.emulateMedia({ colorScheme: theme.schema });
  await page.goto(`${BASE}${ecran.chemin}`, { waitUntil: "networkidle" });

  // LE CHEMIN FINAL SE DÉCOUVRE SUR L'ÉCRAN PRÉCÉDENT, quand l'écran en porte
  // un — voir `decouvrir`. Le refus qui en sort dit qu'il n'y avait rien à
  // atteindre, ce qui n'est pas la même chose qu'un écran cassé.
  if (ecran.decouvrir !== undefined) {
    const chemin = await ecran.decouvrir(page);
    await page.goto(`${BASE}${chemin}`, { waitUntil: "networkidle" });
  }

  // ── LE TÉMOIN SE LIT SUR CE QU'UN HUMAIN VOIT, JAMAIS SUR LE DOM ────────
  //
  // **Mesuré le 10/09/2026, et c'est la capture qui l'a montré.** Avec
  // `textContent("body")`, le témoin « Planning » a été trouvé… dans la charge
  // RSC que Next.js sérialise en fin de page. Les quatre captures du planning
  // ont donc été ACCEPTÉES en montrant l'écran d'enrôlement — *une assertion
  // verte sur une image fausse*, exactement l'espèce que le §9 du 09/09
  // nomme : un défaut invisible à toute assertion et évident sur une image.
  //
  // `innerText` ne rend que le texte RENDU : les `<script>` en sortent.
  const corps = await page.locator("body").innerText();
  if (!corps.toLowerCase().includes(ecran.temoin.toLowerCase())) {
    // **LE REFUS DIT CE QU'IL A VU À LA PLACE.** Un refus qui n'énonce que
    // l'attendu envoie chercher du côté de l'écran, alors que la cause est
    // presque toujours ailleurs — une redirection, une session qui n'a pas
    // pris, un écran renommé. *L'URL atteinte et les premiers mots rendus
    // coûtent une ligne et désignent la cause au lieu de la faire deviner.*
    const vu = corps.replace(/\s+/g, " ").trim().slice(0, 120);
    throw new Error(
      `« ${ecran.nom} » ne porte pas son témoin « ${ecran.temoin} » : ce n'est ` +
        "pas l'écran attendu, et la capture est refusée. " +
        `Atteint : ${page.url()} — vu : « ${vu} »`,
    );
  }

  await page.screenshot({
    path: join(SORTIE, `${ecran.nom}--${theme.nom}--${format.nom}.png`),
    fullPage: true,
  });
  await page.close();
  if (cookies === null) {
    await contexte.close();
  }
}

/**
 * LES PASSES — trois états de session que la session ordinaire ne donne pas.
 *
 * **Ce que le refus du 10/09 disait, et ce que la mesure dit.** Il annonçait
 * qu'un écran d'enrôlement ne pouvait être photographié « qu'avec une seconde
 * identité, jamais enrôlée ». C'était une impossibilité énoncée sans son coût
 * (§9, 08/09) : *il ne faut pas une autre identité, il faut prendre la photo
 * plus tôt.* Un compte devient enrôlé au moment de l'ACTIVATION, jamais à la
 * connexion — se connecter AVANT elle donne les quatre images.
 *
 * Trois passes aujourd'hui, et leurs raisons ne sont pas la même :
 *
 * - **avant-enrôlement** — l'écran DISPARAÎT quand le second facteur est
 *   activé. La passe s'exécute donc avant `seConnecter`, et elle n'active
 *   rien.
 * - **défi de second facteur** — l'écran n'existe QUE pendant le défi, entre
 *   le mot de passe et la session. La passe s'y arrête, et REFUSE si elle est
 *   allée plus loin.
 * - **portail** — l'écran appartient à une AUTRE identité, et c'est le seul
 *   des trois où la seconde identité est réellement nécessaire : un compte
 *   portail n'a aucune ligne dans `utilisateur_societe` (D10), donc aucun
 *   compte interne ne l'atteint. *Ici, l'impossibilité du 10/09 aurait été
 *   vraie — et elle se dit avec son coût : un second jeu d'identifiants.*
 */
type EtatDeSession = Awaited<
  ReturnType<Awaited<ReturnType<Browser["newContext"]>>["storageState"]>
>;

/**
 * LA CONNEXION D'UNE PASSE — une seule, partagée par les quatre images.
 *
 * **Mesuré le 11/09/2026 :** quatre connexions coup sur coup, suivies de
 * celles de `seConnecter`, épuisent la limite de débit que Better Auth pose
 * sur `/sign-in/email` ; les connexions suivantes reçoivent un statut hors
 * 200, `tenterConnexion` les traite pour ce qu'elles sont — un refus —, et
 * **les captures authentifiées tombent sans que rien ne dise pourquoi**. *Un
 * refus de débit et un mot de passe faux sont indiscernables, par construction
 * (D35) : c'est la bonne règle, et c'est elle qui rend l'épuisement invisible.*
 *
 * **Le script, lui, a le droit de savoir ce qu'il a reçu.** Il n'est pas
 * l'appelant que D35 protège : il est l'outil de mesure. Le statut de la
 * réponse d'authentification est donc RETENU et rendu avec le refus — sans
 * quoi une prise de vue épuisée et un mot de passe faux se rapportent de la
 * même façon, et l'on cherche pendant vingt minutes du côté du mot de passe.
 */
async function ouvrirUnePasse(
  navigateur: Browser,
  amener: (page: Page) => Promise<void>,
): Promise<{ etat: EtatDeSession | null; refus: string | null }> {
  const contexte = await navigateur.newContext({ locale: "fr-FR" });
  const statuts: string[] = [];
  try {
    const page = await contexte.newPage();
    page.on("response", (reponse) => {
      const url = reponse.url();
      if (url.includes("/api/auth/") && reponse.status() !== 200) {
        statuts.push(`${reponse.status()} sur ${url.split("/api/auth/")[1]}`);
      }
    });
    await amener(page);
    return { etat: await contexte.storageState(), refus: null };
  } catch (erreur) {
    return {
      etat: null,
      refus:
        String(erreur).slice(0, 400) +
        (statuts.length === 0
          ? ""
          : ` — réponses d'authentification hors 200 : ${statuts.join(", ")}`),
    };
  } finally {
    await contexte.close();
  }
}

/**
 * LES QUATRE IMAGES D'UN ÉCRAN SOUS UNE SESSION DONNÉE.
 *
 * *L'état est ouvert une fois et repassé aux quatre contextes* : douze
 * connexions pour trois écrans, ce serait douze occasions d'échouer là où une
 * seule suffit à établir le fait — et, ici, l'épuisement garanti de la limite
 * de débit.
 */
async function photographierSousEtat(
  navigateur: Browser,
  ecran: Ecran,
  etat: EtatDeSession | null,
  refus: string | null,
  prises: string[],
  manquants: string[],
): Promise<void> {
  for (const theme of THEMES) {
    for (const format of LARGEURS) {
      // **LE NOM PORTE SON EXTENSION**, et ce n'est pas un détail de graphie :
      // c'est la clé sur laquelle la purge décide ce qui survit. Sans elle,
      // une capture réussie sortait de `prises` telle que le disque la nomme,
      // se faisait SUPPRIMER comme obsolète — et le README la listait quand
      // même. *Le défaut n'a jamais mordu parce que les quatre images de cette
      // passe étaient refusées jusqu'au 11/09 : un défaut invisible parce que
      // ce qu'il casse n'existait pas encore (§9, 08/09).*
      const nom = `${ecran.nom}--${theme.nom}--${format.nom}.png`;
      let contexte = null;
      try {
        if (etat === null) {
          throw new Error(`session absente — ${refus ?? "cause inconnue"}`);
        }
        contexte = await navigateur.newContext({
          viewport: { width: format.largeur, height: format.hauteur },
          colorScheme: theme.schema,
          locale: "fr-FR",
          storageState: etat,
        });
        await photographier(navigateur, ecran, theme, format, contexte);
        prises.push(nom);
      } catch (erreur) {
        manquants.push(
          `${nom} : ${String(erreur).slice(0, 400)}` +
            (ecran.refusConnu === undefined ? "" : `\n  ${ecran.refusConnu}`),
        );
      } finally {
        await contexte?.close();
      }
    }
  }
}

/**
 * Une connexion COMPLÈTE, mais SANS choisir de société.
 *
 * *Elle n'omet rien d'autre* : le second facteur s'active, le défi se passe.
 * Ce qui est retenu est le dernier geste, celui qu'un humain fait à l'écran —
 * et c'est précisément l'écran qu'on photographie.
 */
async function connexionSansSociete(page: Page): Promise<void> {
  await seConnecter(page, false);
}

/** Une connexion NUE : ni défi — le compte n'en a pas encore —, ni activation. */
async function connexionNue(page: Page): Promise<void> {
  await page.goto(`${BASE}/connexion`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', COURRIEL);
  await page.fill('input[name="motDePasse"]', MOT_DE_PASSE);
  await page.click('button[type="submit"]');
  await page.waitForLoadState("networkidle");
}

/**
 * UNE CONNEXION QUI S'ARRÊTE AU DÉFI, et qui REFUSE si elle est allée plus loin.
 *
 * *Sans ce refus, un compte non enrôlé donnerait une session ordinaire et
 * l'écran photographié sous le nom du défi serait celui d'après* — la faute
 * exacte que le témoin existe pour arrêter, un cran plus tôt.
 */
async function connexionArreteeAuDefi(page: Page): Promise<void> {
  await page.goto(`${BASE}/connexion`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', COURRIEL);
  await page.fill('input[name="motDePasse"]', MOT_DE_PASSE);
  await page.click('button[type="submit"]');
  await page.waitForLoadState("networkidle");
  if (!page.url().includes("/connexion/code")) {
    throw new Error(
      `la connexion n'a pas rencontré de défi (elle est sur ${page.url()}) : ` +
        "le compte ne porte pas de second facteur à cet instant, et l'écran " +
        "du défi n'existe donc pas.",
    );
  }
}

/** La connexion du compte PORTAIL — une autre identité, et il en faut une (D10). */
async function connexionPortail(page: Page): Promise<void> {
  if (COURRIEL_PORTAIL === "" || MOT_DE_PASSE_PORTAIL === "") {
    throw new Error(
      "aucun COURRIEL_PORTAIL / MOT_DE_PASSE_PORTAIL fourni : un compte " +
        "portail n'a AUCUNE ligne dans `utilisateur_societe` (D10), donc " +
        "aucun compte interne ne peut atteindre cet écran.",
    );
  }
  await page.goto(`${BASE}/connexion`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', COURRIEL_PORTAIL);
  await page.fill('input[name="motDePasse"]', MOT_DE_PASSE_PORTAIL);
  await page.click('button[type="submit"]');
  await page.waitForLoadState("networkidle");
  if (page.url().includes("/connexion")) {
    throw new Error(
      `la connexion du compte portail n'a pas abouti : ${page.url()}`,
    );
  }
}

async function principal(): Promise<number> {
  mkdirSync(SORTIE, { recursive: true });
  const commit = empreinte();
  // L'HEURE SE LIT AVEC SON FUSEAU, jamais celle de l'appareil (L0-08). Une
  // prise de vue horodatée à l'heure locale d'un exécuteur ne se compare à
  // rien — et le gardien de L0-08 le refuse, à juste titre.
  const quand = maintenant("UTC")
    .instant.toISOString()
    .replace("T", " ")
    .slice(0, 16);

  const navigateur = await chromium.launch();
  const prises: string[] = [];
  const manquants: string[] = [];
  const obsoletes: string[] = [];

  // LA SESSION EST OUVERTE UNE FOIS ET RÉUTILISÉE. Se connecter à chaque
  // capture ferait douze connexions pour six écrans, et douze occasions
  // d'échouer là où une seule suffit à établir le fait.
  let etatSession: Awaited<
    ReturnType<Awaited<ReturnType<Browser["newContext"]>>["storageState"]>
  > | null = null;
  let refusSession: string | null = null;

  // AVANT TOUT LE RESTE : les écrans qui n'existent que tant que le second
  // facteur n'est pas activé. `seConnecter` l'active — l'ordre n'est donc pas
  // une commodité, c'est la condition d'existence de ces images.
  if (COURRIEL !== "" && MOT_DE_PASSE !== "") {
    for (const ecran of ECRANS.filter((e) => e.passe === "avant-enrolement")) {
      const { etat, refus } = await ouvrirUnePasse(navigateur, connexionNue);
      await photographierSousEtat(
        navigateur,
        ecran,
        etat,
        refus,
        prises,
        manquants,
      );
    }
  }

  if (COURRIEL !== "" && MOT_DE_PASSE !== "") {
    const contexte = await navigateur.newContext({ locale: "fr-FR" });
    try {
      const page = await contexte.newPage();
      await seConnecter(page);
      etatSession = await contexte.storageState();
    } catch (erreur) {
      refusSession = String(erreur).slice(0, 400);
    } finally {
      await contexte.close();
    }
  } else {
    refusSession = "aucun COURRIEL / MOT_DE_PASSE fourni.";
  }

  // LES DEUX AUTRES PASSES, APRÈS l'enrôlement et non avant. Le défi n'existe
  // que si le compte porte un second facteur — donc après l'activation ; et le
  // portail est une identité que rien n'oblige à ouvrir plus tôt.
  try {
    for (const ecran of ECRANS.filter(
      (e) =>
        e.passe === "defi-second-facteur" ||
        e.passe === "portail" ||
        e.passe === "sans-societe",
    )) {
      const amener =
        ecran.passe === "portail"
          ? connexionPortail
          : ecran.passe === "sans-societe"
            ? connexionSansSociete
            : connexionArreteeAuDefi;
      const { etat, refus } = await ouvrirUnePasse(navigateur, amener);
      await photographierSousEtat(
        navigateur,
        ecran,
        etat,
        refus,
        prises,
        manquants,
      );
    }

    for (const ecran of ECRANS.filter((e) => e.passe === undefined)) {
      for (const theme of THEMES) {
        for (const format of LARGEURS) {
          let contexte = null;
          try {
            if (ecran.authentifie) {
              if (etatSession === null) {
                throw new Error(
                  `session absente — ${refusSession ?? "cause inconnue"}`,
                );
              }
              contexte = await navigateur.newContext({
                viewport: { width: format.largeur, height: format.hauteur },
                colorScheme: theme.schema,
                locale: "fr-FR",
                storageState: etatSession,
              });
            }
            await photographier(navigateur, ecran, theme, format, contexte);
            prises.push(`${ecran.nom}--${theme.nom}--${format.nom}.png`);
          } catch (erreur) {
            manquants.push(
              `${ecran.nom}--${theme.nom}--${format.nom}.png : ${String(erreur).slice(0, 400)}` +
                (ecran.refusConnu === undefined
                  ? ""
                  : `\n  ${ecran.refusConnu}`),
            );
          } finally {
            if (contexte !== null) {
              await contexte.close();
            }
          }
        }
      }
    }
  } finally {
    await navigateur.close();
  }

  // ── CE QUE LE SCRIPT CROIT AVOIR PRIS, CONFRONTÉ À CE QUE LE DISQUE PORTE ──
  //
  // **Deux sens, et le second est celui qu'on oubliait.**
  //
  // *Sur le disque et pas dans la liste* — le répertoire mentirait par
  // accumulation : une image d'un écran supprimé ou renommé survit, le README
  // ne la décrit plus, et elle se relit quand même comme une preuve de ce que
  // l'application affiche. Elle est SUPPRIMÉE.
  //
  // *Dans la liste et pas sur le disque* — le README affirmerait une image qui
  // n'existe pas, ce qui est pire : un lecteur ne peut pas l'ouvrir, et une
  // ligne de tableau ressemble en tout point à une ligne vraie. **Cela s'est
  // produit** : la passe d'avant-enrôlement poussait son nom SANS `.png`, si
  // bien qu'une capture réussie se faisait supprimer comme obsolète tout en
  // restant listée. Le défaut n'a jamais mordu parce que ces quatre images
  // étaient refusées jusqu'au 11/09 — *un défaut invisible parce que ce qu'il
  // casse n'existe pas encore (§9, 08/09).* Il est corrigé à sa source ; ce
  // qui suit est le gardien, et il regarde le DISQUE plutôt que la mémoire du
  // script — *la population se dérive d'une source que le script ne contrôle
  // pas (§9, 10/09).*
  const gardees = new Set(prises);
  const surDisque = new Set(
    readdirSync(SORTIE).filter((fichier) => fichier.endsWith(".png")),
  );
  for (const fichier of surDisque) {
    if (!gardees.has(fichier)) {
      unlinkSync(join(SORTIE, fichier));
      obsoletes.push(fichier);
    }
  }
  const fantomes = prises.filter((fichier) => !surDisque.has(fichier));
  if (fantomes.length > 0) {
    // Elles sortent de `prises` AVANT la rédaction : un README qui les
    // listerait serait faux, et un README faux est plus coûteux qu'une image
    // manquante — c'est la règle que ce script applique partout ailleurs.
    for (const fantome of fantomes) {
      prises.splice(prises.indexOf(fantome), 1);
      manquants.push(
        `${fantome} : le script l'a comptée comme prise et le disque ne la ` +
          "porte pas. La capture est retirée du README plutôt qu'affirmée.",
      );
    }
  }

  writeFileSync(
    join(SORTIE, "README.md"),
    redigerReadme(commit, quand, prises, manquants, obsoletes),
    "utf8",
  );

  process.stdout.write(
    `${prises.length} capture(s) prise(s), ${manquants.length} refusée(s), ` +
      `${obsoletes.length} retirée(s). ` +
      `Commit photographié : ${commit.court}.\n`,
  );
  if (cleActivee !== "") {
    process.stdout.write(
      "Un second facteur a été ACTIVÉ pendant cette prise de vue. Pour rejouer " +
        "sur la MÊME base sans la resemer, repasser cette clé en " +
        "`SECRET_TOTP` — elle n'est écrite dans aucun fichier :\n" +
        `  ${cleActivee}\n`,
    );
  }
  for (const manquant of manquants) {
    process.stdout.write(`  — ${manquant}\n`);
  }
  // Un refus de capture n'est pas un échec du script : c'est une observation,
  // et elle est ÉCRITE dans le README plutôt que perdue dans un journal.
  return 0;
}

/**
 * CE QUI A CHANGÉ DEPUIS LA PRISE, ET COMMENT LE SAVOIR (R1-02).
 *
 * Le README nommait le commit photographié — c'est la règle du §9 du 09/09. Il
 * ne disait pas **comment un lecteur sait qu'aucun écran n'a bougé depuis**, et
 * la commande qui le dit *était tapée à la main, donc pas tapée*. Elle est
 * désormais nommée ici, avec l'empreinte contre laquelle elle compare, et la
 * liste des chemins qu'elle tient pour surface d'écran — que le script ÉCRIT
 * plutôt qu'un auteur ne la recopie.
 */
function sectionSurface(commit: { court: string; long: string }): string[] {
  return [
    "## Comment savoir si un écran a changé depuis cette prise",
    "",
    "**Une commande, et elle rend un ÉTAT — jamais un silence :**",
    "",
    "```bash",
    "pnpm captures:etat",
    "```",
    "",
    `Elle compare \`${commit.court}\` à \`HEAD\` sur les chemins ci-dessous et rend l'un de **trois** verdicts. Le troisième est celui qu'on oublie : dans un clone tronqué (\`--depth\`), l'empreinte photographiée n'existe pas, et *« je ne sais pas » se lirait « rien n'a changé »* — le silence qui a exactement la forme du succès. Elle sort en **1** dans ce cas, et en **0** dès que la question est répondue, quelle que soit la réponse : *un écran qui change entre deux prises est le cours ordinaire du travail, pas une faute, et rougir là-dessus ferait un contrôle qu'on apprend à ne plus lire.*`,
    "",
    "| Chemin | | Pourquoi un changement ici change l'image |",
    "|---|---|---|",
    ...SURFACE_DECRAN.map(
      (p) =>
        `| \`${p.prefixe}\` | ${p.origine === "deduite" ? "déduite" : "déclarée"} | ${p.motif} |`,
    ),
    "",
    "**La moitié « déduite » ne s'écrit nulle part, et c'est ce qui la rend sûre.** Un fichier qui rend du JSX, exporte les `metadata` de Next.js ou interroge l'écran **est** de la surface, par le fait ; un gardien exige que chacun tombe sous l'un de ces chemins (`tests/unit/captures/surface-decran.test.ts`). *Une page écrite demain dans un répertoire que personne n'a prévu fait rougir le jour même* — la liste est une déclaration confrontée à une source qu'elle ne contrôle pas, jamais une énumération tenue à la main.",
    "",
    "**Et ce que cette commande NE dit PAS est écrit plutôt que tu.** Elle répond « aucun fichier de RESTITUTION n'a changé », jamais « les écrans sont identiques » : ce qu'un écran affiche dépend aussi de ce que le métier CALCULE — `lib/interventions/statistiques.ts` décide du taux que le planning montre, et il n'est pas dans cette liste. *La frontière n'est pas « ce qui influence un écran » — ce serait le dépôt entier — mais « ce qui RESTITUE » : ce qui rend, ce qui nomme, ce qui colore.*",
    "",
  ];
}

function redigerReadme(
  commit: { court: string; long: string },
  quand: string,
  prises: readonly string[],
  manquants: readonly string[],
  obsoletes: readonly string[],
): string {
  const lignes = [
    "# Captures d'écran — ce que l'application affiche aujourd'hui",
    "",
    "**Ces images montrent que les écrans s'affichent. Elles ne prouvent pas qu'ils fonctionnent.** Elles sont désormais prises par une COMMANDE — `pnpm exec tsx scripts/captures.mts` — et non à la main : une prise de vue manuelle ne se rejoue pas, et vieillit sans le dire.",
    "",
    "| | |",
    "|---|---|",
    `| **Commit photographié** | \`${commit.long}\` (\`${commit.court}\`) — lu dans \`git rev-parse HEAD\` au moment de la prise, jamais de mémoire |`,
    `| **Date de la prise** | ${quand} UTC — lue à l'horloge, jamais déduite |`,
    "| **Base** | un PostgreSQL 16 local et jetable, rempli par `pnpm db:seed` — aucune donnée réelle (I9) |",
    "| **Compte** | l'identité de démonstration du seed |",
    "",
    "## Comment la rejouer",
    "",
    "**Le script ne prépare ni la base ni le compte** : cela demande une base jetable, un semis, et un mot de passe qui n'existe nulle part tant qu'une personne n'en a pas choisi un. *Le script annonçait cette procédure « dans le README qu'il écrit » — et le README ne la portait pas. Elle y est.*",
    "",
    "```bash",
    "# 1. Une base LOCALE ET JETABLE — jamais la base hébergée (I9).",
    "scripts/postgres-jetable.sh",
    "",
    "# DEUX RÔLES, ET LES CONFONDRE COÛTE UNE HEURE (mesuré le 10/09/2026).",
    "#   le PROPRIÉTAIRE migre et sème ; l'APPLICATIF sert les pages, et c'est",
    "#   la seule forme sous laquelle les politiques de cloisonnement mordent.",
    "PROPRIETAIRE='postgresql://postgres@127.0.0.1:5433/codiplan_test'",
    "APPLICATIF='postgresql://codiplan_app@127.0.0.1:5433/codiplan_test'",
    "export BETTER_AUTH_SECRET='…au moins 32 octets…'",
    "export BETTER_AUTH_URL='http://127.0.0.1:3100'",
    'DATABASE_URL="$PROPRIETAIRE" pnpm db:deploy',
    'DATABASE_URL="$PROPRIETAIRE" pnpm db:seed',
    "",
    "# 2. Le serveur. Serveur et prise de vue tiennent dans UNE SEULE commande.",
    "#    ET ON VÉRIFIE QU'AUCUN SERVEUR N'OCCUPE DÉJÀ LE PORT : un serveur",
    "#    laissé par une commande précédente répond encore aux pages statiques",
    "#    tout en ayant perdu sa base, le nouveau serveur échoue alors sur",
    "#    EADDRINUSE — dans son journal, que personne ne lit —, et la prise de",
    "#    vue photographie le mort. Mesuré le 10/09/2026.",
    'DATABASE_URL="$PROPRIETAIRE" pnpm build',
    'DATABASE_URL="$APPLICATIF" pnpm start -p 3100 &',
    "",
    "# 3. LE MOT DE PASSE N'EXISTE PAS ENCORE. Le semis pose une ligne de",
    "#    `compte` à `mot_de_passe NULL` — l'état exact que l'amorçage laisse —,",
    "#    et la seule porte est le lien de premier accès.",
    "AMORCAGE_PREMIER_COMPTE_CONFIRME=oui pnpm exec tsx \\",
    "  scripts/amorcage-premier-compte.mts --reemettre \\",
    "  --societe <uuid> --email <courriel> --base http://127.0.0.1:3100",
    "#    → suivre l'URL imprimée, choisir un mot de passe. Il n'entre dans",
    "#      aucun fichier du dépôt (I9).",
    "",
    "# 4. La prise de vue.",
    "BASE=http://127.0.0.1:3100 COURRIEL=… MOT_DE_PASSE=… \\",
    "  COURRIEL_PORTAIL=… MOT_DE_PASSE_PORTAIL=… \\",
    "  pnpm exec tsx scripts/captures.mts",
    "```",
    "",
    "**Un `next dev` laissé vivant CORROMPT la prise de vue**, sans rien dire non plus : les deux serveurs partagent `.next`, et celui de développement y réécrit ce que le build de production y avait mis. *Mesuré le 10/09/2026 : `TypeError: a[d] is not a function` et « Could not find files for /_error » sur toutes les pages, le formulaire de connexion jamais rendu, 36 images retirées.* Avant une prise : plus aucun serveur vivant, puis `rm -rf .next && pnpm build`.",
    "",
    "**La sonde qui attend le serveur touche la BASE, jamais seulement le port.** `curl /` réussit sur un serveur dont la base est inatteignable ; `curl /sante | grep installation` échoue. *Une sonde qui ne touche pas ce dont on a besoin valide un serveur qui ne peut pas servir* — et la prise de vue qui suit photographie des pages d'erreur sous le nom des écrans.",
    "",
    "**Si `DATABASE_URL` porte le rôle propriétaire, le serveur de production ne le dit PAS.** `garantirRoleApplicatif` refuse — à bon droit — et ferme le client dans la foulée, pour que le refus soit un vrai refus de se connecter. Le message juste est émis **une fois**, puis noyé sous des dizaines d'`Engine is not yet connected` qui n'ont plus rien à voir avec la cause. *Mesuré le 10/09/2026 : 48 de ces lignes pour un seul refus lisible, et la conclusion qu'on en tire spontanément est que l'hébergeur réclame le moteur Prisma.* En `next dev`, le même refus s'affiche en clair : **quand le serveur de production devient incompréhensible, le relancer en développement coûte deux minutes et nomme la cause.**",
    "",
    "`COURRIEL_PORTAIL` désigne une **seconde identité**, et elle est nécessaire plutôt que commode : un compte portail n'a aucune ligne dans `utilisateur_societe` (D10), donc aucun compte interne n'atteint `/portail`. Sans elle, les quatre images du portail sont refusées et le refus le dit.",
    "",
    ...sectionSurface(commit),
    "## Ce que le script REFUSE de photographier",
    "",
    "Chaque écran porte un **témoin** : un texte qui doit s'y trouver. Si la page ne le porte pas — parce que la connexion a échoué, parce que l'écran a été renommé, parce qu'une redirection a mené ailleurs — **la capture est refusée et l'absence est écrite ici**. *Une capture d'un écran de connexion rangée sous le nom « planning » est pire qu'une capture absente : elle se relit comme une preuve.*",
    "",
  ];

  if (manquants.length > 0) {
    lignes.push(
      "### Refusées à cette prise",
      "",
      ...manquants.map((m) => `- \`${m}\``),
      "",
    );
  } else {
    lignes.push("*Aucun refus à cette prise.*", "");
  }

  if (obsoletes.length > 0) {
    lignes.push(
      "### Retirées à cette prise",
      "",
      "Ces images ne correspondent plus à aucun écran photographié. **Elles sont supprimées plutôt que laissées** : une image que le README ne décrit plus se relit quand même comme une preuve de ce que l'application affiche.",
      "",
      ...obsoletes.map((o) => `- \`${o}\``),
      "",
    );
  }

  lignes.push(
    "## Les images",
    "",
    "Chaque écran est photographié à **1280 px** (poste de travail) et **390 px** (téléphone). Le nom se lit `écran--thème--largeur.png`.",
    "**IL N'Y A PLUS QU'UNE IMAGE PAR ÉCRAN ET PAR LARGEUR, et c'est un RETRAIT, pas une omission.** La prise de vue en faisait deux — « clair » et « sombre » —, et *mesuré le 14/09/2026 par `cmp` sur les 100 images commises : les 50 paires étaient IDENTIQUES, octet pour octet.* `lib/theme/apparence.ts` dit qu'il n'y a **PAS d'apparence sombre** : le viewer basculait un thème qui n'existe pas, et le résultat était rangé sous deux noms. **Une seconde image qui ne peut pas différer de la première a la forme d'une preuve et n'en porte aucune** — le §9 du 06/09, appliqué à un fichier plutôt qu'à une ligne de rapport.",
    "*Le segment `clair` reste dans le nom* : la consigne est retirée **jusqu'à nouvel ordre**, et renommer 50 images couperait leur historique pour le rétablir le jour venu. **Réouverture : le jour où `lib/theme/apparence.ts` déclare une apparence sombre** — `THEMES` reçoit sa seconde entrée, et les paires divergent d'elles-mêmes.",
    "",
    "### Ce que ces images montrent DE L'OUTIL et non de l'application",
    "",
    "**Les champs de date y affichent `mm/dd/yyyy`, et ce n'est PAS ce que l'application affiche.** Le gabarit d'un `<input type=\"date\">` est rendu par le NAVIGATEUR, dans la langue de son interface — pas dans la locale de la page. *Mesuré le 10/09/2026 : sous `locale: \"fr-FR\"`, `navigator.language` vaut bien `fr-FR` et `toLocaleDateString()` rend `14/09/2026` ; le gabarit du champ reste `mm/dd/yyyy`, et `--lang=fr-FR` au lancement n'y change rien* — le Chromium de ce conteneur n'embarque pas ses traductions d'interface. Sur un navigateur réglé en français, ces champs affichent `jj/mm/aaaa`.",
    "",
    "*C'est écrit ici parce qu'une image se relit comme une preuve : sans cette ligne, elle prouverait un défaut qui n'existe pas.* La distinction est celle du registre du 12/09 — **l'outil, ou l'écran** — et elle se tranche par une mesure, jamais à l'œil.",
    "",
    "| Fichier | Ce qu'on y voit |",
    "|---|---|",
  );
  for (const fichier of prises) {
    const nom = fichier.replace(/--.*/, "");
    const ecran = ECRANS.find((e) => e.nom === nom);
    // LE THÈME SE LIT DANS LE NOM, il ne se DEVINE pas. La forme précédente
    // — « clair si le nom le porte, sombre sinon » — était un test binaire sur
    // une liste qui n'a plus qu'une entrée : toute image aurait été dite
    // « clair », y compris une image d'un thème ajouté demain. *Une branche qui
    // ne peut plus être prise ment le jour où elle le redevient.*
    const theme = fichier.split("--")[1] ?? "clair";
    const format = fichier.includes("--1280.")
      ? "poste de travail"
      : "téléphone";
    lignes.push(
      `| \`${fichier}\` | ${ecran?.quoi ?? nom} — thème ${theme}, ${format}. |`,
    );
  }
  lignes.push("");
  return lignes.join("\n");
}

process.exit(await principal());
