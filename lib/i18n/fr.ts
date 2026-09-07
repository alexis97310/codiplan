/**
 * Dictionnaire français — source unique des chaînes visibles par l'utilisateur.
 *
 * Décision D26 : le français est en dur en V1, mais aucune chaîne visible n'est
 * écrite dans un composant. Le dictionnaire est **plat** : une clé, une chaîne,
 * jamais d'imbrication. Ajouter une langue reviendra à ajouter un fichier.
 *
 * ## LA COUPURE — ce qui passe par ici, et ce qui n'y passe pas (L0-11)
 *
 * Elle se dit une fois, ici, plutôt que de se rejouer à chaque cas. C'est la
 * même famille de coupure que « documentation contre exécution » du gardien de
 * D50 : ce n'est pas le fichier qui décide, c'est la DESTINATION du texte.
 *
 * **Passe par le dictionnaire** — tout ce qu'un humain lit en se servant de
 * l'application : le texte d'un composant, le libellé d'une action, le titre
 * d'une page, le texte d'un attribut que restitue un lecteur d'écran, et le
 * message d'erreur RENDU À L'ÉCRAN. Le refus d'authentification de D35 en est
 * l'exemple : il est vu par un utilisateur, il est donc au dictionnaire.
 *
 * **N'y passe pas** — tout ce qu'un développeur ou une machine lit : le message
 * d'un gardien, celui d'une exception technique, une trace, une erreur de
 * migration, le libellé d'un test, le nom d'un rôle ou d'un statut. Ces
 * chaînes-là ne se traduisent pas : les traduire brouillerait la recherche dans
 * les journaux et ferait dépendre un diagnostic d'une langue d'interface.
 *
 * **Le cas limite, tranché : une exception dont le message finirait à l'écran.**
 * Elle ne se règle pas en traduisant le message de l'exception, mais en ne
 * transportant pas de texte dans une exception — la couche de rendu choisit sa
 * clé. Une chaîne technique qui devient visible est une chaîne qui a changé de
 * destination : c'est une clé de plus ici, jamais une traduction là-bas.
 *
 * Le gardien `tests/unit/i18n/sans-chaine-visible-en-dur.test.ts` tient le
 * premier bord de la coupure ; le second n'a besoin d'aucun gardien, puisqu'il
 * consiste à ne rien faire.
 *
 * ## LE VOCABULAIRE IMPOSÉ
 *
 * « Agence » et « site » sont définis ici, une fois, avec leur distinction —
 * voir `lib/i18n/vocabulaire.ts` pour la notion, et la note de décision du
 * 31/08/2026 pour le raisonnement. D47 a dû corriger le chapitre 10 parce que
 * le mot « site » y désignait des agences ; le dictionnaire rend cette confusion
 * plus difficile en n'offrant qu'un seul endroit où chacun des deux mots
 * s'écrit.
 */
export const fr = {
  "app.nom": "CODIPLAN",
  "app.description":
    "Gestion des plannings d'intervention et du parc machines.",
  "accueil.titre": "CODIPLAN",
  "accueil.accroche":
    "Plannings d'intervention et parc machines — Nouvelle-Calédonie.",
  "accueil.socle": "Socle technique en place. Aucune fonctionnalité métier.",
  "accueil.action": "Consulter la documentation",
  // Thématisation par société (L0-09). Le NOM de la société n'est jamais une
  // chaîne du dictionnaire : c'est une donnée, lue en base. Seuls les libellés
  // qui qualifient le thème vivent ici.
  "theme.societe": "Charte de la société",
  "theme.neutre": "Thème neutre CODIPLAN",
  // Message unique de tous les refus d'authentification (D35). Il ne dit ni si
  // le compte existe, ni si le mot de passe est faux, ni si le compte est
  // habilité quelque part : c'est exactement son objet.
  "auth.refus":
    "Accès refusé. Vérifiez vos identifiants ; si le problème persiste, contactez l'administrateur de votre société.",
  // ── Référentiel client (ticket L1-01) ─────────────────────────────────────
  // Ce que le PRODUIT dit. Ce qu'une SOCIÉTÉ dit est une donnée, lue en base :
  // `societe.libelle_code_externe` remplace « client.code_externe » ci-dessous
  // quand elle l'a renseigné (D29, lib/clients/code-externe.ts). Même coupure
  // que la charte de L0-09 — le nom et les couleurs d'une société ne sont pas
  // des constantes de compilation.
  "client.titre": "Clients",
  "client.raison_sociale": "Raison sociale",
  // Libellé GÉNÉRIQUE, affiché à une société qui n'a pas nommé son ERP. « Code
  // Winpro » est le libellé de CODIMA, pas celui du produit (D29).
  "client.code_externe": "Code externe",
  "client.ridet": "RIDET",
  "client.categorie": "Catégorie",
  "client.adresse_facturation": "Adresse de facturation",
  "client.conditions_reglement": "Conditions de règlement",
  "client.commercial_referent": "Commercial référent",
  "client.actif": "Actif",
  "client.recherche": "Rechercher un client",
  "client.recherche.vide": "Aucun client ne correspond à cette recherche.",
  // Refus rendus à l'écran : ils sont vus par un utilisateur, ils sont donc au
  // dictionnaire. Le dépôt ne transporte qu'une CLÉ (`MotifRefusClient`) — une
  // exception ne porte jamais de texte destiné à un humain.
  "client.refus.code_externe_en_double":
    "Ce code externe est déjà porté par une autre fiche de votre société. Le code identifie un client à l'import : deux fiches ne peuvent pas le partager.",
  "client.refus.client_introuvable": "Cette fiche client est introuvable.",

  // ── Référentiel des sites d'intervention (ticket L1-02) ───────────────────
  //
  // **Aucune de ces entrées n'écrit le mot imposé, et ce n'est pas un choix de
  // style.** « Site » se définit UNE fois, sous « vocabulaire.site », et se
  // compose partout ailleurs depuis `mot("site")` — un gardien refuse qu'il
  // soit écrit ici (D5, D47, L0-11). Les libellés ci-dessous sont donc ceux des
  // CHAMPS, jamais celui de la notion : c'est la couche de rendu qui assemble
  // « Sites » ou « Rechercher un site » à partir du vocabulaire.
  "site.libelle": "Libellé",
  "site.client": "Client",
  "site.adresse": "Adresse",
  "site.commune": "Commune",
  "site.zone_geo": "Zone géographique",
  "site.latitude": "Latitude",
  "site.longitude": "Longitude",
  // Décisives pour les sites miniers : badge, EPI, induction sécurité,
  // autorisation préalable (chapitre 2.9).
  "site.consignes_acces": "Consignes d'accès et de sécurité",
  "site.horaires": "Horaires d'accès",
  // Le temps saisi FAIT FOI ; l'estimation par zone n'est qu'un défaut (D23,
  // RG-PLA-05). Le libellé le dit, pour que personne ne croie à une estimation.
  "site.temps_trajet_min": "Temps de trajet de référence (minutes)",
  "site.actif": "Actif",
  "site.recherche.vide": "Aucun résultat ne correspond à cette recherche.",
  // Les six zones de D23. Leurs libellés sont des NOMS DE LIEUX de
  // Nouvelle-Calédonie : ils vivent au dictionnaire parce qu'un humain les lit,
  // et la valeur stockée reste le code technique (`grand_noumea`), qui ne se
  // traduit pas.
  "site.zone.grand_noumea": "Grand Nouméa",
  "site.zone.sud": "Sud",
  "site.zone.cote_est": "Côte Est",
  "site.zone.cote_ouest": "Côte Ouest",
  "site.zone.nord": "Nord",
  "site.zone.iles": "Îles",
  // Refus rendus à l'écran. Le dépôt ne transporte qu'une CLÉ
  // (`MotifRefusSite`) — une exception ne porte jamais de texte destiné à un
  // humain. « Hors de votre périmètre » ne distingue pas le client inexistant
  // du client d'une autre société : les séparer apprendrait qu'un identifiant
  // existe ailleurs, ce que D50 refuse.
  "site.refus.client_hors_perimetre":
    "Ce client n'existe pas dans votre périmètre.",
  "site.refus.fiche_introuvable": "Cette fiche est introuvable.",

  // ── Vocabulaire imposé (CLAUDE.md §3, arbitrages D5 et D47) ───────────────
  // Les SEULES entrées où les mots « agence » et « site » s'écrivent en toutes
  // lettres. Partout ailleurs dans ce fichier, ils se composent depuis ces
  // clés — un gardien le vérifie. Le préfixe « vocabulaire. » n'est pas une
  // convention d'écriture : c'est lui qui désigne ces entrées au gardien.
  "vocabulaire.agence": "Agence",
  "vocabulaire.agence.pluriel": "Agences",
  "vocabulaire.agence.definition":
    "Établissement CODIMA — Ducos, Koné, Dolbeau. L'intervention en part, et c'est le calendrier de l'agence qui fait foi. Ce n'est jamais un lieu appartenant à un client : celui-là est un site.",
  "vocabulaire.site": "Site",
  "vocabulaire.site.pluriel": "Sites",
  "vocabulaire.site.definition":
    "Lieu d'intervention chez un client. Ses horaires produisent un avertissement, jamais un blocage. Ce n'est jamais un établissement CODIMA : celui-là est une agence.",
} as const;

export type CleTraduction = keyof typeof fr;

/** Retourne la chaîne française associée à une clé du dictionnaire. */
export function t(cle: CleTraduction): string {
  return fr[cle];
}
