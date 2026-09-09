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

  // ── Planning (L2-11, D72, D73, D74) ───────────────────────────────────────
  "planning.titre": "Planning",
  // Le mot « agence » ne s'écrit PAS ici : il se définit une fois dans les
  // entrées `vocabulaire.*` et se compose ailleurs depuis `mot("agence")`
  // (D5, D47). Ces trois phrases disent donc « rattachement », qui est la
  // notion, et laissent le mot à son domicile.
  "planning.accroche":
    "Une colonne par technicien, un pas de quinze minutes. Les heures viennent du calendrier de rattachement — ou de celui du technicien, quand il en a un.",
  "planning.jour_precedent": "Jour précédent",
  "planning.jour_suivant": "Jour suivant",
  "planning.aujourdhui": "Aujourd'hui",
  "planning.colonne_heures": "Heure",
  "planning.calendrier_propre": "horaires propres",
  "planning.ferme": "Fermé ce jour",
  "planning.ferme.aide":
    "Le calendrier de ce technicien n'ouvre aucune plage ce jour-là. Ouvrir une plage se fait sur son calendrier de rattachement, ou sur le sien.",
  "planning.vide.titre": "Aucun technicien à planifier",
  "planning.vide.invitation":
    "Rattachez un technicien pour ouvrir sa colonne. Sans rattachement, il n'a ni heures ni majoration.",
  "planning.aucun_bloc.titre": "Journée libre",
  "planning.aucun_bloc.invitation":
    "Aucune intervention n'est posée sur cette journée. Qualifiez une demande pour en poser une.",
  "planning.deborde": "déborde des heures d'ouverture",
  "planning.legende": "Légende",
  "planning.legende.facture": "Facturée au temps passé",
  "planning.legende.forfait": "Forfait",
  "planning.legende.trajet": "Trajet — non facturé",
  "planning.legende.interne": "Travail interne, non facturable",
  "planning.legende.refus": "Affectation refusée",
  "planning.non_facture": "non facturé",
  "planning.refus.absente": "absente",
  "planning.refus.expiree": "expirée",
  "planning.refus.prefixe": "Affectation refusée",
  "planning.refus.remede":
    "Attribuez l'habilitation au technicien, ou affectez quelqu'un d'autre.",
  "planning.avertissement": "Habilitation non bloquante manquante",
  // ── Navigation (L2-10) ────────────────────────────────────────────────────
  "navigation.titre": "Écrans",
  "navigation.planning": "Planning",
  "navigation.clients": "Clients et parc",
  "navigation.techniciens": "Techniciens",
  "navigation.retour": "Retour à l'arrivée",
  "theme.societe": "Charte de la société",
  "theme.neutre": "Thème neutre CODIPLAN",
  // Message unique de tous les refus d'authentification (D35). Il ne dit ni si
  // le compte existe, ni si le mot de passe est faux, ni si le compte est
  // habilité quelque part : c'est exactement son objet.
  "auth.refus":
    "Accès refusé. Vérifiez vos identifiants ; si le problème persiste, contactez l'administrateur de votre société.",
  // ── Le premier écran (ticket L1-02f) ──────────────────────────────────────
  // Sobre assumé : ce qu'un humain lit pour entrer, et rien de plus. La charte
  // de la société vient du thème (L0-09) ; aucune couleur ne s'écrit ici.
  "connexion.titre": "Connexion",
  "connexion.accroche": "Identifiez-vous pour accéder à votre société.",
  "connexion.email": "Adresse électronique",
  "connexion.mot_de_passe": "Mot de passe",
  "connexion.valider": "Se connecter",
  "connexion.code": "Code à six chiffres",
  "connexion.code.accroche":
    "Saisissez le code affiché par votre application d'authentification.",
  "connexion.code.valider": "Valider le code",
  "connexion.apres_enrolement":
    "Votre second facteur est actif. Reconnectez-vous en présentant votre code : la session qui porte vos droits est celle qui a présenté le facteur.",

  // Enrôlement du second facteur — la seule transition en libre-service (D58).
  "enrolement.titre": "Activer votre second facteur",
  "enrolement.accroche":
    "Votre rôle exige un second facteur d'authentification. Cette étape est obligatoire et ne se fait qu'une fois.",
  "enrolement.definitif":
    "Un second facteur s'active ; il ne se retire pas. Seul un administrateur de la plateforme peut le révoquer, sur demande.",
  "enrolement.mot_de_passe": "Confirmez votre mot de passe pour révéler la clé",
  "enrolement.reveler": "Révéler la clé",
  "enrolement.cle": "Clé à saisir dans votre application d'authentification",
  "enrolement.cle.aide":
    "Ajoutez cette clé à votre application d'authentification, puis saisissez le code qu'elle affiche.",
  "enrolement.codes_secours": "Codes de secours",
  "enrolement.codes_secours.aide":
    "Notez-les maintenant : ils ne seront plus affichés. Chacun ne sert qu'une fois, si vous perdez votre application.",
  "enrolement.code": "Code affiché par votre application",
  "enrolement.confirmer": "Confirmer l'activation",
  "enrolement.code_invalide":
    "Ce code n'est pas valide. Vérifiez l'heure de votre appareil, puis réessayez avec le code affiché à l'instant.",

  // Page d'arrivée — qui vous êtes, pour quelle société, et rien d'autre.
  "arrivee.titre": "Vous êtes connecté",
  "arrivee.compte": "Compte",
  "arrivee.email": "Adresse électronique",
  "arrivee.societe": "Société active",
  "arrivee.role": "Rôle",
  "arrivee.sans_societe":
    "Aucune société active. Le choix d'une société parmi plusieurs arrivera avec le back-office ; si vous n'êtes habilité nulle part, contactez l'administrateur de votre société.",
  "arrivee.deconnexion": "Se déconnecter",

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
  // Le rattachement (D56) — l'établissement CODIMA dont le site dépend.
  //
  // **La valeur n'écrit pas le mot imposé, et c'est la règle de L0-11 qui
  // l'exige** : « agence » se définit une fois, sous `vocabulaire.agence`, et
  // se compose ailleurs depuis `mot("agence")`. Un libellé complet se rend donc
  // `${mot("agence")} — ${t("site.rattachement")}`, jamais en écrivant la
  // notion ici. Le gardien l'a refusé sur la première rédaction, à raison.
  "site.rattachement": "Rattachement",
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
  // Et il dit D'OÙ L'ON PART (D56) : un nombre dont la signification dépend
  // d'une autre colonne ne voyage jamais seul, pas même à l'écran. Le mot
  // imposé n'y est pas écrit — voir « site.rattachement » ci-dessus.
  "site.temps_trajet_min": "Temps de trajet depuis le rattachement (minutes)",
  // D74 : c'est une donnée de PLANIFICATION. L'aide le dit à celui qui saisit,
  // pour que personne ne croie renseigner un temps facturable.
  "site.temps_trajet_min.aide":
    "Sert au calcul de charge et aux tournées, jamais à la facturation : le déplacement se facture par forfait de zone. Laisser vide pour utiliser l'estimation par zone géographique.",
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
  "site.refus.agence_hors_societe":
    "Ce rattachement n'existe pas dans votre société.",
  // Le refus de D56, rendu à l'écran. Il dit la marche à suivre, comme celui de
  // la base — et il ne nomme ni l'ancien rattachement ni le nouveau : un refus a
  // le droit d'être lisible, jamais d'être informatif (D50).
  "site.refus.trajet_a_revoir":
    "Le temps de trajet est mesuré depuis le rattachement. En changer sans revoir ce temps laisserait une valeur qui ne veut plus rien dire : saisissez le nouveau temps, ou videz le champ pour revenir à l'estimation par zone.",

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
  // ── Le TAUX D'OCCUPATION (D76) — le nom, et sa formule à côté du nom ──────
  // Tout le temps passé en intervention compte, même non facturé — garantie,
  // geste commercial, reprise, recensement. C'est une OCCUPATION, jamais un
  // rendement : le mot « productivité » ferait décider sur un chiffre qui ne
  // mesure pas ce qu'il laisse croire, et un gardien refuse qu'il entre ici.
  "vocabulaire.taux_occupation": "Taux d'occupation",
  "vocabulaire.taux_occupation.formule":
    "heures d'intervention ÷ heures travaillées",
  "vocabulaire.taux_occupation.definition":
    "Part du temps travaillé passée en intervention, sur la période. Tout le temps d'intervention compte, facturé ou non — garantie, geste commercial, reprise, recensement. Ce n'est pas un rendement : rien n'y dit ce qui a été facturé.",

  // ── LES ANOMALIES D'IMPORT (L1-08, D31) ───────────────────────────────
  //
  // `lib/excel/format.ts` ne rend que des CODES ; les libellés sont ici, parce
  // que le rapport de contrôle est lu par un humain (I6, RG-IMP-01). Chaque
  // libellé dit ce qui bloque ET la marche à suivre : un refus a le droit
  // d'être lisible, jamais d'être informatif sur ce que son destinataire n'a
  // pas le droit de lire (D50) — ici il ne parle que du fichier apporté.
  "import.anomalie.marqueur_absent":
    "Ce fichier n'est pas un modèle CODIPLAN : sa première cellule ne porte pas de marqueur de format. Téléchargez le modèle correspondant au type d'import et recommencez la saisie dedans.",
  "import.anomalie.marqueur_illisible":
    "Le marqueur de format de ce fichier est abîmé. La première cellule doit contenir le marqueur du modèle, inchangé — retéléchargez le modèle et recopiez-y vos lignes.",
  "import.anomalie.marqueur_autre_type":
    "Ce fichier est un modèle CODIPLAN, mais pas celui de cet import. Vérifiez le type d'import choisi, ou téléchargez le modèle correspondant.",
  "import.anomalie.marqueur_version_anterieure":
    "Ce fichier suit une version antérieure du modèle. Téléchargez la version en cours et recopiez-y vos lignes : les colonnes ont changé depuis.",
  "import.anomalie.marqueur_version_posterieure":
    "Ce fichier suit une version du modèle plus récente que celle que cette application sait lire. Il n'est pas lu plutôt que d'être lu de travers.",
  "import.anomalie.entete_en_double":
    "Deux colonnes portent le même en-tête. Renommez ou supprimez la colonne en trop : sans cela, l'une des deux serait ignorée sans qu'on sache laquelle.",
  "import.anomalie.colonne_obligatoire_absente":
    "Une colonne obligatoire manque au fichier. Vérifiez que la ligne d'en-têtes du modèle n'a pas été modifiée.",
  // LA PAIRE, DITE EN UNE PHRASE. Une colonne obligatoire manque, et un en-tête
  // du fichier lui ressemble : les signaler séparément laissait le lecteur
  // rapprocher lui-même deux lignes du rapport. L'appariement reste EXACT — la
  // ressemblance explique, elle ne choisit pas.
  "import.anomalie.colonne_obligatoire_absente_ressemblance":
    "Une colonne obligatoire manque, et une colonne du fichier lui ressemble sans être identique. Corrigez son en-tête pour qu'il soit exactement celui du modèle : l'orthographe, les accents et la casse comptent.",
  "import.anomalie.date_format":
    "Cette date n'est pas au format attendu. Le seul format accepté est JJ/MM/AAAA — par exemple 03/04/2026.",
  "import.anomalie.date_hors_plage": "Cette date n'existe pas au calendrier.",
  "import.anomalie.date_avec_heure":
    "Cette cellule porte une heure en plus de la date. Mettez la colonne au format date seule.",
  "import.anomalie.nombre_format":
    "Ce nombre n'est pas au format attendu. Utilisez la virgule comme séparateur décimal, sans séparateur de milliers.",
  "import.anomalie.nombre_separateur_milliers":
    "Ce nombre contient un séparateur de milliers. Écrivez-le sans espace : 1234,56 et non 1 234,56.",
  "import.anomalie.nombre_point_decimal":
    "Ce nombre utilise le point comme séparateur décimal. Utilisez la virgule : 1234,56 et non 1234.56.",
  "import.anomalie.cellule_vide": "Cette cellule est vide.",
  "import.avertissement.colonne_inconnue":
    "Cette colonne ne fait pas partie du modèle : elle est ignorée, et n'empêche pas l'import.",
} as const;

export type CleTraduction = keyof typeof fr;

/** Retourne la chaîne française associée à une clé du dictionnaire. */
export function t(cle: CleTraduction): string {
  return fr[cle];
}

/**
 * Une chaîne venue de L'EXTÉRIEUR désigne-t-elle une clé du dictionnaire ?
 *
 * Le premier écran reporte ses refus d'une route vers une page par un paramètre
 * d'URL (L1-02f). Ce paramètre est une CLÉ, jamais un texte : sans ce filtre,
 * n'importe qui ferait écrire n'importe quoi à la page en forgeant un lien.
 * Une chaîne inconnue n'affiche rien du tout.
 */
export function estCleTraduction(valeur: string): valeur is CleTraduction {
  return Object.hasOwn(fr, valeur);
}
