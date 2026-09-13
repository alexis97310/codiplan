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

  // L'ENTRÉE — le lien qui manquait, et sans lequel un écran n'a pas d'appelant.
  "arrivee.entrer.portail": "Voir votre parc",
  "arrivee.entrer.planning": "Ouvrir le planning",

  // Registre des VGP — CODIPLAN n'affirme jamais la conformité (lot 9, D88).
  // Il enregistre ce qu'un organisme agréé a écrit, et ne calcule que des dates.
  "vgp.periodicite_requise":
    "Déclarer ce matériel soumis exige une périodicité : sans elle, personne ne sait quand la prochaine visite est due.",
  "vgp.reference_requise":
    "Indiquez le texte qui fonde cette périodicité. Sans lui, c'est un chiffre que personne ne pourra défendre.",
  "vgp.motif_requis":
    "Une exception ne se pose jamais sans sa raison : écrivez le motif, pour que quelqu'un puisse la rejuger.",
  "vgp.motif_orphelin":
    "Ce motif n'explique aucune exception. Posez l'exception, ou retirez le motif.",
  "vgp.a_determiner":
    "À déterminer — personne n'a encore examiné si ce matériel est soumis.",
  "vgp.hors_registre": "Hors registre",
  "vgp.sans_information": "Sans information",
  "vgp.information_recue": "Dernière information reçue",

  // Portail client — CONSULTATION SEULE (L2-12, D92).
  "portail.titre": "Votre parc",
  "portail.sous_titre":
    "Ce que CODIMA suit pour vous. Cette page est en consultation seule.",
  // LE VOCABULAIRE IMPOSÉ NE S'ÉCRIT PAS ICI (L0-11) : la notion se nomme par
  // `mot("site")`, et ces libellés portent tout SAUF le mot. Une clé
  // « Vos sites » aurait recopié dans le dictionnaire ce dont `vocabulaire.ts`
  // est la seule maison.
  "portail.vos": "Vos",
  "portail.machines": "Vos machines",
  // ── LES SIX ÉTATS D'UNE MACHINE (R2-21) ─────────────────────────────────
  //
  // *Un état de machine est lu par un PLANIFICATEUR, pas par une machine* : il
  // passe donc au dictionnaire, contrairement à un nom de rôle. Les trois
  // premiers libellés sont ceux de la maquette, qui fait foi ; les trois autres
  // n'y figurent pas et sont écrits au plus simple.
  "statut_machine.en_service": "En service",
  "statut_machine.en_panne": "En panne",
  "statut_machine.arretee": "Arrêtée",
  "statut_machine.remplacee": "Remplacée",
  "statut_machine.ferraillee": "Ferraillée",
  "statut_machine.fusionnee": "Fusionnée",
  "portail.machine.serie": "Numéro de série",
  "portail.machine.localisation": "Emplacement",
  "portail.machine.statut": "État",
  "portail.machine.mise_en_service": "Mise en service",
  "portail.sans_machine":
    "Aucune machine ne figure à votre parc pour le périmètre qui vous est ouvert.",
  "portail.sans_lieu":
    "Aucun lieu d'intervention ne vous est ouvert. Signalez-le à votre interlocuteur CODIMA.",
  "portail.perimetre":
    "Vous ne voyez que les lieux sur lesquels votre compte est habilité.",
  "portail.client": "Client",
  "portail.documents": "Documents",
  "portail.documents.a_venir":
    "Les documents de cette machine ne sont pas encore consultables ici.",
  "portail.vgp": "Contrôle réglementaire (VGP)",
  "portail.vgp.sans_information":
    "Sans information — CODIPLAN n'enregistre pas encore les contrôles de cette machine. Ce n'est ni « à jour », ni « en retard ».",
  "portail.reserve": "Cet écran est réservé aux comptes de portail client.",

  // ── LE BANDEAU ET LES CHIFFRES DU PORTAIL (R2-07, D95) ───────────────────
  //
  // La maquette porte QUATRE indicateurs ; le produit n'en sait mesurer que
  // DEUX, et les deux autres ne sont pas remplis d'un zéro. *Un zéro affiché là
  // où il n'y a rien à afficher se lit comme une mesure* (doctrine §3).
  "portail.bandeau.espace": "Votre espace client",
  "portail.chiffre.machines": "Vos machines",
  "portail.chiffre.machines_detail": "recensées à ce jour",
  "portail.chiffre.lieux": "Vos lieux",
  "portail.chiffre.lieux_detail": "dans votre périmètre",
  "portail.chiffre.sans_mesure": "—",
  "portail.chiffre.arret": "Machine à l'arrêt",
  "portail.chiffre.arret_detail":
    "Sans information : l'état d'une intervention en cours n'est pas encore lisible ici.",
  "portail.chiffre.visite": "Prochaine visite",
  "portail.chiffre.visite_detail":
    "Sans information : le planning n'est pas encore lisible ici.",
  "portail.interventions": "Vos interventions",
  // Les deux phrases ci-dessous nomment un MOT IMPOSÉ, et il ne s'écrit pas
  // ici : « agence » se définit une fois sous `vocabulaire.*` et se compose
  // depuis `mot(notion)` (D5, D47). Le dictionnaire ne porte donc que ce qui
  // l'entoure — c'est la forme déjà en vigueur sur l'écran de paramétrage.
  "portail.interventions.a_venir_avant":
    "Sans information : l'historique de vos interventions et leurs rapports ne sont pas encore lisibles ici. Votre",
  "portail.interventions.a_venir_apres": "vous les transmet.",
  "portail.demande": "Demander une intervention",
  "portail.demande.a_venir_avant":
    "Ce formulaire n'est pas ouvert : appelez votre",
  "portail.demande.a_venir_apres":
    ", elle enregistre votre demande et vous en accuse réception.",

  // Premier accès — l'écran où l'on CHOISIT son mot de passe (D65).
  // L'amorçage redirigeait ici depuis le 09/09 ; l'écran n'existait pas, et la
  // seule porte d'entrée d'une base neuve rendait 404.
  "premier_acces.titre": "Choisissez votre mot de passe",
  "premier_acces.accroche":
    "Ce lien ne sert qu'une fois. Le mot de passe que vous choisissez ici est le vôtre : personne d'autre ne le connaît, et il ne peut plus être réémis par ce chemin.",
  "premier_acces.mot_de_passe": "Nouveau mot de passe",
  "premier_acces.confirmation": "Confirmez le mot de passe",
  "premier_acces.valider": "Enregistrer et se connecter",
  "premier_acces.sans_jeton":
    "Ce lien de premier accès est incomplet. Demandez-en un nouveau à la personne qui vous l'a transmis.",
  "premier_acces.refuse":
    "Ce lien n'est plus valide, ou le mot de passe n'a pas été accepté. Demandez un nouveau lien à la personne qui vous l'a transmis.",
  "premier_acces.discordance":
    "Les deux mots de passe saisis ne sont pas identiques.",
  "premier_acces.trop_court":
    "Le mot de passe doit compter au moins huit caractères.",
  "premier_acces.abouti":
    "Votre mot de passe est enregistré. Connectez-vous avec.",

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
  // R2-04 — l'accroche que la forme de back-office réclame. *Ce que l'écran
  // AFFICHE ne change pas d'un mot* : cette ligne ne dit rien de plus que le
  // titre, elle le situe.
  "arrivee.accroche":
    "Votre compte, la société sur laquelle vous travaillez, et par où entrer.",
  "arrivee.compte": "Compte",
  "arrivee.email": "Adresse électronique",
  "arrivee.societe": "Société active",
  "arrivee.role": "Rôle",
  // **CE TEXTE A ÉTÉ CORRIGÉ le 10/09/2026** : il annonçait que « le choix
  // d'une société parmi plusieurs arrivera avec le back-office », ce qui est
  // devenu faux le jour où le choix a été écrit. Il ne s'affiche désormais que
  // dans le seul cas qui reste : aucune habilitation du tout.
  "arrivee.sans_societe":
    "Aucune société active, et aucune habilitation sur ce compte. Contactez l'administrateur de votre société.",
  "arrivee.deconnexion": "Se déconnecter",
  // ── LE CHOIX D'UNE SOCIÉTÉ (D61, D67 — écran écrit le 10/09/2026) ────────
  //
  // Il manquait, et son absence était un MUR : un compte habilité sur deux
  // sociétés n'en activait aucune, donc n'atteignait aucun écran cloisonné.
  // Les deux politiques qui le rendent possible existaient depuis deux jours.
  "arrivee.choix.titre": "Choisir la société sur laquelle travailler",
  "arrivee.choix.aide":
    "Vous êtes habilité sur plusieurs sociétés. Une seule est active à la fois, et tout ce que vous verrez ensuite lui appartient.",
  "arrivee.choix.activer": "Travailler sur cette société",
  "arrivee.choix.active": "Société active",
  // Une société dont le nom n'est pas revenu est affichée QUAND MÊME, avec son
  // identifiant : taire la ligne ferait disparaître une habilitation réelle,
  // et le compte ne comprendrait pas pourquoi il ne peut pas y aller.
  "arrivee.choix.sans_nom": "Société sans nom lisible",

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
  // ── L'ÉCRAN (L3-16) ───────────────────────────────────────────────────────
  // Comme partout, le mot imposé ne s'écrit PAS ici : le titre de l'écran se
  // compose depuis `mot("site.pluriel")`, et le libellé de colonne du
  // rattachement depuis `mot("agence")`.
  "sites.sous_titre":
    "Les lieux d'intervention de vos clients, leur rattachement et leur temps de trajet.",
  "sites.recherche": "Libellé ou commune",
  "sites.rechercher": "Rechercher",
  "sites.creer": "Nouveau lieu",
  "sites.inactif": "Inactif",
  "sites.borne": "Les 100 premiers résultats sont affichés.",
  // Le libellé COURT de la colonne. Le libellé complet — celui qui dit d'où
  // l'on part — vit dans « site.temps_trajet_min », et la fiche l'emploie.
  // *Une colonne ne peut pas porter une phrase ; la fiche, si.*
  "sites.colonne_trajet": "Trajet (min)",
  "sites.action.modifier": "Enregistrer",
  "sites.action.creer": "Créer",
  "sites.retour": "← Tous les lieux",
  "sites.cree": "Le lieu a été créé.",
  "sites.modifie": "Les modifications ont été enregistrées.",
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
  // Le refus de SAISIE, distinct de ceux du dépôt (L3-16). *« Saisie
  // invalide » pour tout serait vrai et inutile* — c'est la faute que L3-01b a
  // corrigée sur le déplacement d'intervention, et le refus de D56 est nommé à
  // part pour cette raison.
  "site.refus.saisie":
    "Une valeur saisie n'est pas acceptable. Vérifiez les champs numériques et les longueurs.",
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

  // ── Le planning et les interventions (lot 2, D84) ────────────────────────
  "planning.titre": "Planning des interventions",
  "planning.sous_titre":
    "Ce qui est posé, ce qui attend d'être posé, et ce qui a été fait.",
  "planning.file_attente": "À planifier",
  "planning.vide": "Aucune intervention sur cette période.",
  "planning.creer": "Créer une intervention",
  "planning.retour": "Retour au planning",
  // La flèche fait partie du LIBELLÉ lu à voix haute : elle est ici, comme
  // tout ce qu'un humain lit (L0-11), et non écrite en dur dans le composant.
  "planning.retour_fleche": "← Retour au planning",
  "planning.periode": "Période affichée",

  // ── LES STATISTIQUES PAR TECHNICIEN (10/09/2026) ─────────────────────────
  //
  // **JAMAIS LE POURCENTAGE SEUL**, et c'est une demande d'exploitation avant
  // d'être une préférence d'affichage : « 82 % » ne veut rien dire sans ses
  // deux termes — 82 % de quoi, sur quelle période, calculé comment ? La
  // formule est donc une clé à part, affichée à côté du taux, et un gardien
  // refuse que l'écran montre l'un sans l'autre.
  "statistiques.titre": "Charge par technicien",
  "statistiques.sous_titre":
    "Sur la période affichée, et par établissement : c'est le calendrier de l'établissement qui donne les heures ouvrables.",
  "statistiques.technicien": "Technicien",
  "statistiques.non_affectees": "Interventions non affectées",
  // Le SINGULIER est une clé à part : « 1 interventions » est une faute que
  // personne ne relit deux fois, et qu'aucune assertion n'attrape — c'est
  // l'image du planning qui l'a montrée.
  "statistiques.nombre": "interventions",
  "statistiques.nombre_un": "intervention",
  "statistiques.heures_engagees": "engagées",
  "statistiques.heures_ouvrables": "ouvrables",
  "statistiques.taux": "Taux d'occupation",
  // « 0 % » se lit « n'a rien fait ». Quand du temps a été engagé et que le
  // taux s'arrondit à zéro, l'écran cesse d'affirmer un faux et dit sa borne.
  "statistiques.taux_infime": "moins de 1\u00a0%",
  // La FORMULE, écrite en toutes lettres. Elle est ce qui rend le pourcentage
  // interprétable, et elle ne se déduit pas de « 82 % ».
  // Le SIGNE POUR CENT est du texte qu'un humain lit : il vient d'ici comme le
  // reste (L0-11), avec l'espace insécable que le français exige devant lui.
  // ── LE TAUX COMPACT DE LA COLONNE « TECHNICIEN » (D111) ──────────────────
  //
  // Il est BREF parce qu'il est SANS AMBIGUÏTÉ : un technicien n'a qu'une
  // agence, donc jamais deux taux. Le panneau de charge, lui, porte toujours
  // les deux termes et la formule — D56 n'y bouge pas.
  "statistiques.taux_compact_sans_calendrier": "taux inconnu",
  "statistiques.taux_compact_sans_calendrier.aide":
    "Aucun calendrier n'est r\u00e9gl\u00e9 pour son \u00e9tablissement : le taux n'a pas de d\u00e9nominateur. Ce n'est pas z\u00e9ro pour cent.",
  "statistiques.pourcent": "\u00a0%",
  // LE SÉPARATEUR N'APPARTIENT À AUCUN ÉCRAN — il s'appelait
  // `statistiques.separateur`, et la fiche d'intervention en a eu besoin le
  // jour où elle a affiché « CACES — bloquante » (L3-02). *Une clé nommée
  // d'après son premier appelant devient fausse au second*, et la pente
  // suivante est d'en écrire une deuxième qui dit la même chose.
  "ponctuation.separateur": " — ",
  // ── LE TRAJET ENTRE DANS LA FORMULE (L3-05a, D107, RG-PLA-05) ───────────
  //
  // La formule nommait DEUX termes quand le numérateur en porte désormais deux
  // lui-même. *Une formule qui n'énumère pas ce qu'elle additionne est une
  // formule fausse*, et c'est le pire endroit pour l'être : elle est là pour
  // rendre le pourcentage vérifiable.
  "statistiques.formule":
    "(heures engagées + trajet) ÷ heures ouvrables du calendrier de l'établissement",
  "statistiques.heures_trajet": "de trajet",
  // « Aucun trajet » et « je ne sais pas » ne se corrigent pas au même endroit :
  // le premier est une journée sans déplacement, le second une zone sans
  // estimation (`iles`, D107) ou un lieu sans zone. Le second se DIT.
  "statistiques.journees_sans_trajet":
    "journées dont le trajet est inconnu — elles comptent pour zéro minute de trajet",
  "statistiques.journees_sans_trajet_une":
    "journée dont le trajet est inconnu — elle compte pour zéro minute de trajet",
  // L'ÉCRAN L'ÉCRIT, il ne l'approxime pas (D107). La colonne ne porte que des
  // durées depuis l'établissement, et soustraire deux distances à un point
  // commun n'est pas une distance.
  "statistiques.trajet_lecture":
    "Le trajet compté est l'aller vers le premier lieu de la journée et le retour depuis le dernier. Le temps d'un lieu à un autre n'est pas connu, et il n'est pas compté.",
  "statistiques.sans_calendrier":
    "Pas de taux : cet établissement n'a pas de calendrier, et les heures ouvrables sont donc inconnues. Ce n'est pas zéro pour cent.",
  "statistiques.sans_duree":
    "sans durée saisie — elles comptent dans le nombre, et pour zéro minute dans le taux",
  "statistiques.sans_duree_un":
    "sans durée saisie — elle compte dans le nombre, et pour zéro minute dans le taux",

  "intervention.titre": "Intervention",
  "intervention.reference": "Référence",
  "intervention.client": "Client",
  "intervention.machine": "Machine",
  // ── Les notions IMPOSÉES ne s'écrivent pas ici ───────────────────────────
  //
  // « agence » et « site » se définissent une seule fois, dans les entrées
  // `vocabulaire.*` (D5, D47, L0-11). Le code nomme la NOTION — `mot("site")`,
  // `mot("agence")` — et jamais le mot ; les clés ci-dessous portent donc ce
  // qui les entoure, et le composant compose.
  "intervention.deduit_du_lieu":
    "Déduit du lieu d'intervention — cela ne se saisit pas.",
  "intervention.refus.lieu_inconnu":
    "Ce lieu n'existe pas pour ce client, ou il n'est pas dans votre périmètre.",
  "intervention.refus.lieu_sans_rattachement":
    "Ce lieu n'est rattaché à aucun établissement. Le rattachement de l'intervention en est déduit : renseignez-le d'abord.",
  // RG-PLA-06 (L3-04). **Le motif ne nomme ni la personne ni la période**, et
  // ce n'est pas de la pudeur : un refus est un canal d'information soumis au
  // cloisonnement comme une requête (D50). Qui planifie voit l'absence sur
  // l'écran des absences, où la politique décide ; le refus dit ce qui bloque
  // et la marche à suivre, il ne renseigne pas.
  "absence.refus.inconnue":
    "Cette absence n'existe pas, ou elle n'est pas dans votre périmètre.",
  "absence.refus.deja_tranchee":
    "Cette absence a déjà été validée ou refusée. Une décision ne se reprend pas : les interventions déplanifiées ne retrouveraient pas leur créneau.",
  "intervention.refus.absence":
    "Ce technicien est indisponible à cette date. Le créneau est refusé.",
  "intervention.refus.habilitation":
    "Ce technicien ne détient pas les habilitations exigées ici. L'affectation est refusée.",
  // RG-PLA-04, sa moitié BLOQUANTE et sa moitié qui AVERTIT (L3-02, D9, D73).
  //
  // *Le code de l'habilitation n'est pas dans ces phrases, et c'est voulu* : il
  // est une donnée de société, il se LIT en base à côté du technicien affiché,
  // et il ne traverse jamais une URL — un texte recopié depuis un paramètre est
  // un canal d'écriture ouvert à qui forge un lien (L1-02f, D50). Ces libellés
  // sont les invariants de la phrase ; la donnée s'y accole à l'écran.
  "intervention.habilitations.exigees": "Habilitations exigées par ce lieu",
  "intervention.habilitations.bloquante": "bloquante",
  "intervention.habilitations.absente": "absente",
  "intervention.habilitations.expiree_le": "expirée le",
  "intervention.habilitations.satisfaites":
    "Ce technicien détient toutes les habilitations exigées ici.",
  "intervention.avertissement.habilitation":
    "Ce technicien ne détient pas toutes les exigences NON bloquantes de ce lieu. L'affectation est acceptée ; le détail est sur la fiche.",
  "intervention.type": "Nature",
  "intervention.priorite": "Priorité",
  "intervention.statut": "Statut",
  "intervention.date": "Date planifiée",
  "intervention.creneau": "Créneau",
  "intervention.technicien": "Technicien",
  "intervention.aucun_technicien": "Aucun technicien affecté",
  "intervention.duree_estimee": "Durée estimée",
  "intervention.mode_valorisation": "Mode de valorisation",
  "intervention.forfait_deplacement": "Forfait de déplacement",
  "intervention.sans_numero":
    "Le numéro est attribué par le serveur à la première synchronisation.",

  "intervention.action.affecter": "Affecter un technicien",
  "intervention.action.deplacer": "Déplacer",
  "intervention.action.cloturer": "Clôturer",
  "intervention.action.annuler": "Annuler l'intervention",
  "intervention.action.creer": "Créer",

  "intervention.cloture.temps_reel": "Temps réellement passé (minutes)",
  "intervention.cloture.arrondi": "Arrondi au quart d'heure supérieur",
  "intervention.cloture.plancher": "Plancher d'une heure appliqué",
  "intervention.cloture.facture": "Temps facturé",
  "intervention.cloture.taux": "Taux horaire en vigueur à cette date",
  "intervention.cloture.main_doeuvre": "Main-d'œuvre",
  "intervention.cloture.forfait_deplacement": "Forfait de déplacement",
  "intervention.cloture.total": "Total hors taxes",
  // UN TOTAL QU'ON NE SAIT PAS CALCULER SE DIT (L2-09a). *Zéro se lit
  // « gratuit »*, et une absence d'information ne s'affiche jamais comme une
  // réponse négative — c'est vrai d'un montant plus que de tout le reste.
  "intervention.cloture.total_inconnu": "Sans information",
  "intervention.cloture.total_motif": "Ce qui manque",
  // ── LA MAJORATION HORS OUVERTURE (L2-09b, D12, D108) ──────────────────────
  // Quatre motifs, et ils ne se corrigent pas au même endroit : un créneau qui
  // manque n'est pas un calendrier d'agence qui manque.
  "intervention.majoration.creneau_absent":
    "Aucun créneau n'est posé : la majoration hors ouverture se lit sur le créneau, et non sur le temps passé.",
  "intervention.majoration.main_doeuvre_absente":
    "Aucune main-d'œuvre n'est facturée : la majoration hors ouverture ne porte que sur elle.",
  "intervention.majoration.technicien_absent":
    "Aucun technicien rattaché à un établissement : la majoration hors ouverture se lit sur les horaires de son établissement.",
  "intervention.majoration.calendrier_absent":
    "L'établissement du technicien n'a pas d'horaires d'ouverture : sans eux, on ne peut pas dire ce qui tombe hors ouverture.",
  "intervention.total.forfait_de_prestation_absent":
    "Le forfait de prestation de cette intervention n'est pas encore choisi : le catalogue ne le propose pas. Le total ne peut pas être calculé tant qu'il manque.",
  "intervention.total.main_doeuvre_absente":
    "Le temps réellement passé n'est pas saisi : la main-d'œuvre ne peut pas être calculée.",
  "intervention.total.devises_incompatibles":
    "Le forfait et la main-d'œuvre ne sont pas dans la même monnaie. Aucun total n'est calculé : une conversion ici fausserait le montant.",
  "intervention.cloture.explication":
    "Le temps est arrondi au quart d'heure supérieur, puis relevé à une heure minimum. Les deux s'appliquent une seule fois, sur l'intervention entière.",

  "intervention.annulation.motif": "Motif de l'annulation",
  "intervention.annulation.obligatoire":
    "Le motif est obligatoire. Une annulation n'efface rien : elle se justifie.",

  // ── LES REFUS À LA POSE (R2-19) — chacun NOMME son motif ────────────────
  //
  // *Un bloc qui revient à sa place sans explication apprend à ne plus faire
  // confiance à l'écran* (exploitation, 11/09/2026). Ces quatre messages disent
  // ce qui bloque et la marche à suivre ; aucun ne COMPTE ni ne NOMME ce que son
  // destinataire n'a pas le droit de lire (D50).
  "intervention.deplacement.heure":
    "Heure de début (laisser vide pour une journée sans heure)",
  "intervention.deplacement.duree": "Durée en minutes",
  "intervention.deplacement.explication":
    "Même effet que le glisser-déposer du planning, et mêmes refus. L'heure se donne dans l'heure locale du lieu d'intervention.",
  "intervention.refus.jour_ferme":
    "Le calendrier qui décide pour cette intervention n'ouvre pas ce jour-là. La ligne du planning montre l'union des calendriers du technicien : c'est un repère, pas un droit de poser.",
  "intervention.refus.hors_ouverture":
    "Cette heure est en dehors des horaires d'ouverture du calendrier qui décide pour cette intervention.",
  "intervention.refus.duree_invalide":
    "Une intervention dure au moins un créneau. Tirez la poignée sous le début du bloc, jamais au-dessus.",
  "intervention.refus.chevauchement":
    "Ce technicien a déjà une intervention sur ce créneau. Deux interventions au même moment ne se posent pas.",
  "intervention.refus.agence_sans_calendrier":
    "Aucun calendrier ne décide pour cette intervention : aucune pose n'est possible tant que les horaires ne sont pas réglés.",
  "intervention.refus.inconnue":
    "Cette intervention n'existe pas, ou elle n'est pas dans votre périmètre.",
  "intervention.refus.annulee_figee":
    "Cette intervention est annulée : elle ne se modifie plus. Une annulation n'efface rien et ne se défait pas.",
  "intervention.refus.cloturee_figee":
    "Cette intervention est clôturée : elle ne se modifie plus sans trace. Seule son annulation reste possible.",
  "intervention.refus.deja_cloturee": "Cette intervention est déjà clôturée.",
  "intervention.refus.deja_annulee": "Cette intervention est déjà annulée.",
  "intervention.refus.temps_manquant":
    "Saisissez le temps réellement passé avant de clôturer. C'est lui qui détermine ce qui est facturé.",
  // ── LA SUSPENSION ET LA FILE « EN ATTENTE DE PIÈCE » (L2-10, RG-INT-06) ──
  "intervention.suspension.titre": "Suspendre l'intervention",
  "intervention.suspension.motif": "Motif de la suspension",
  "intervention.suspension.motif_aide":
    "Obligatoire. Une intervention arrêtée sans qu'on sache pourquoi est une intervention perdue : celui qui la retrouvera dans trois semaines n'aura personne à qui demander.",
  "intervention.suspension.piece": "Référence de la pièce attendue",
  "intervention.suspension.date_dispo": "Disponibilité prévue",
  "intervention.suspension.piece_aide":
    "Pour une attente de pièce seulement, et les deux vont ensemble : une référence sans date de disponibilité fait une file d'attente qu'on ne sait pas trier.",
  "intervention.suspension.depuis": "Suspendue depuis",
  "intervention.suspension.horizon_depasse":
    "La date de disponibilité annoncée est passée.",
  "intervention.action.suspendre": "Suspendre",
  "intervention.action.reprendre": "Reprendre",
  "intervention.refus.deja_suspendue":
    "Cette intervention est déjà suspendue. Sa date de suspension ne se réécrit pas : c'est elle qui mesure depuis combien de temps elle attend.",
  "intervention.refus.pas_suspendue":
    "Cette intervention n'est pas suspendue : il n'y a rien à reprendre.",
  "intervention.refus.motif_manquant":
    "Le motif est obligatoire. Une suspension sans motif laisse une intervention arrêtée sans que personne sache pourquoi.",
  "intervention.refus.taux_absent":
    "Aucun taux horaire n'est en vigueur à cette date. Renseignez le tarif avant de clôturer : facturer à zéro serait pire que refuser.",

  // ── LA DEMANDE D'INTERVENTION (L2-06) ───────────────────────────────────
  //
  // Le point d'entrée du flux. Les refus nomment ce qui bloque et la marche à
  // suivre ; aucun ne COMPTE ni ne NOMME ce que son destinataire n'a pas le
  // droit de lire (D50) — « introuvable » couvre la demande qui n'existe pas et
  // celle qui est hors périmètre, et les distinguer ferait un oracle.
  "demande.titre": "Demandes",
  "demande.source": "Origine",
  "demande.urgence": "Urgence",
  "demande.description": "Symptôme décrit",
  "demande.machine_arretee": "Machine à l'arrêt",
  "demande.date_souhaitee": "Date souhaitée",
  "demande.contact": "Interlocuteur",
  "demande.sans_numero":
    "Le numéro est attribué par le serveur à la première synchronisation.",

  "demande.accuse.titre": "Accusé de réception",
  "demande.accuse.repondu_dans_le_standard": "Répondu dans les temps",
  "demande.accuse.repondu_hors_standard": "Répondu au-delà du standard",
  "demande.accuse.sans_reponse": "Sans réponse pour l'instant",
  "demande.accuse.sans_reponse_depasse": "Sans réponse, standard dépassé",
  "demande.accuse.explication":
    "Le délai se compte en heures ouvrées de l'établissement dont dépend le lieu d'intervention : une demande déposée le dimanche soir démarre son compteur à l'ouverture du lundi.",

  "demande.action.accuser": "Accuser réception",
  "demande.action.qualifier": "Qualifier",
  "demande.action.transformer": "Transformer en intervention",
  "demande.action.clore": "Clore sans suite",

  "demande.cloture.motif": "Motif de la clôture",
  "demande.cloture.explication":
    "Une demande close sans intervention garde son motif : c'est ce qui mesure le service rendu sans déplacement.",

  "demande.refus.introuvable":
    "Cette demande n'existe pas, ou elle n'est pas dans votre périmètre.",
  "demande.refus.lieu_inconnu":
    "Ce lieu n'existe pas pour ce client, ou il n'est pas dans votre périmètre.",
  "demande.refus.lieu_sans_rattachement":
    "Ce lieu n'est rattaché à aucun établissement. Le délai d'accusé de réception se compte sur ses heures ouvrées : renseignez le rattachement d'abord.",
  "demande.refus.agence_sans_calendrier":
    "Les horaires de l'établissement dont dépend ce lieu ne sont pas réglés. Sans eux, le délai de réponse n'a pas de point de départ.",
  "demande.refus.deja_qualifiee": "Cette demande est déjà qualifiée.",
  "demande.refus.deja_accusee":
    "La réception de cette demande a déjà été accusée. L'horodatage ne se réécrit pas : c'est lui qui mesure le délai de réponse.",
  "demande.refus.transformer_sans_qualifier":
    "Qualifiez la demande avant de la transformer : c'est la qualification qui décide de la nature, de la durée et de l'affectation.",
  "demande.refus.deja_transformee":
    "Cette demande est devenue une intervention : elle ne change plus. C'est l'intervention qui se poursuit ou s'annule.",
  "demande.refus.deja_close":
    "Cette demande est close sans suite et ne se rouvre pas. Son motif mesure le service rendu à distance ; déposez une nouvelle demande.",

  "demande.source.appel": "Appel téléphonique",
  "demande.source.portail": "Portail client",
  "demande.source.email": "Courriel",
  "demande.source.echeance_contrat": "Échéance contractuelle",
  "demande.source.seuil_compteur": "Seuil de compteur",
  "demande.source.detection_technicien": "Détection par un technicien",

  "demande.statut.nouvelle": "Nouvelle",
  "demande.statut.qualifiee": "Qualifiée",
  "demande.statut.transformee": "Transformée",
  "demande.statut.close_sans_suite": "Close sans suite",

  "demande.motif.resolue_telephone": "Résolue par téléphone",
  "demande.motif.hors_perimetre": "Hors périmètre",
  "demande.motif.refus_client": "Refus du client",
  "demande.motif.doublon": "Doublon",

  "statut.a_planifier": "À planifier",
  "statut.planifiee": "Planifiée",
  "statut.affectee": "Affectée",
  "statut.en_cours": "En cours",
  "statut.suspendue": "Suspendue",
  "statut.terminee": "Terminée",
  "statut.cloturee": "Clôturée",
  "statut.annulee": "Annulée",

  "type_intervention.preventif_contrat": "Préventif sous contrat",
  "type_intervention.preventif_hors_contrat": "Préventif hors contrat",
  "type_intervention.curatif": "Curatif",
  "type_intervention.installation": "Installation",
  "type_intervention.garantie": "Garantie",
  "type_intervention.controle_reglementaire": "Contrôle réglementaire",
  "type_intervention.expertise": "Expertise",
  "type_intervention.reprise": "Reprise",
  "type_intervention.recensement": "Recensement",

  "priorite.p1": "P1 — critique",
  "priorite.p2": "P2 — haute",
  "priorite.p3": "P3 — normale",
  "priorite.p4": "P4 — basse",

  "mode_valorisation.forfait": "Forfait",
  "mode_valorisation.temps_passe": "Temps passé",
  "mode_valorisation.forfait_plus_heures": "Forfait plus heures",

  // ── Les zones géographiques (D23) et le catalogue de forfaits (D86) ───────
  //
  // Les six zones sont closes dans `lib/sites/zones.ts` ; ce sont leurs
  // LIBELLÉS qui vivent ici, parce qu'un humain les lit à l'écran.
  "zone.grand_noumea": "Grand Nouméa",
  "zone.sud": "Sud",
  "zone.cote_est": "Côte Est",
  "zone.cote_ouest": "Côte Ouest",
  "zone.nord": "Nord",
  "zone.iles": "Îles",

  "type_forfait.deplacement": "Déplacement",
  "type_forfait.mise_en_service": "Mise en service",
  "type_forfait.controle": "Contrôle",
  "type_forfait.prestation": "Prestation",

  // ── L'ÉCRITURE DU CATALOGUE (R2-20) ─────────────────────────────────────
  //
  // Le catalogue naissait vide PAR DÉCISION, et il le restait : aucun chemin
  // ne permettait d'y mettre une ligne autrement qu'en SQL.
  "forfaits.creer": "Ajouter un forfait",
  "forfaits.modifier": "Modifier",
  "forfaits.enregistrer": "Enregistrer",
  "forfaits.retour": "‹ Retour au catalogue",
  "forfaits.champ.code": "Code",
  "forfaits.champ.libelle": "Libellé",
  "forfaits.champ.type": "Type",
  "forfaits.champ.rang": "Rang",
  "forfaits.champ.montant": "Montant, en unités mineures",
  "forfaits.champ.cumulable": "Cumulable avec le temps passé",
  "forfaits.champ.actif": "Actif",
  "forfaits.champ.zone": "Zone géographique",
  "forfaits.champ.zone_aucune": "Toutes les zones",
  "forfaits.actions": "Actions",
  "forfaits.activer": "Activer",
  "forfaits.desactiver": "Désactiver",
  // Un forfait ne se SUPPRIME pas : une intervention le désigne, et une facture
  // émise sous un forfait disparu ne s'explique plus.
  "forfaits.desactiver_explication":
    "Un forfait ne se supprime pas : il se désactive. Une intervention peut le désigner, et une facture émise sous un forfait disparu ne s'expliquerait plus.",
  "forfaits.refus.rang_pris":
    "Ce rang est déjà pris pour ce type de forfait. Le rang décide de la priorité entre forfaits du même type ; il ne se compare qu'entre pairs, et deux forfaits ne peuvent pas partager le même.",
  "forfaits.refus.code_pris":
    "Ce code est déjà utilisé dans le catalogue. Le code est la clé du forfait : il identifie la ligne, y compris dans un import.",
  "forfaits.refus.doublon":
    "Le catalogue refuse ce forfait comme doublon, sans que la base ait dit lequel du code ou du rang était déjà pris. Vérifier les deux.",
  "forfaits.refus.famille_hors_societe":
    "Cette famille de matériel n'appartient pas à votre société.",
  "forfaits.refus.devise_inconnue":
    "La devise de cette société n'est pas connue du référentiel.",
  "forfaits.refus.introuvable":
    "Ce forfait est introuvable dans votre catalogue.",
  "forfaits.refus.condition_non_retirable":
    "Une condition posée ne se retire pas par une modification : désactiver ce forfait et en créer un autre sans cette condition.",
  "forfaits.refus.saisie":
    "La saisie est refusée : vérifier le code, le libellé, le rang (entier positif) et le montant (entier, en unités mineures).",
  "forfaits.refus.sans_devise":
    "Cette société ne porte aucune devise : un forfait ne peut pas être créé tant qu'elle n'en a pas.",
  "forfaits.titre": "Forfaits applicables",
  "forfaits.sous_titre":
    "Pour une zone donnée, quels forfaits s'appliquent et dans quel ordre.",
  "forfaits.zone": "Zone géographique",
  "forfaits.voir": "Voir",
  "forfaits.vide":
    "Le catalogue est vide. Aucun forfait ne se facture tant qu'aucun n'est saisi.",
  "forfaits.rang": "Rang",
  "forfaits.code": "Forfait",
  "forfaits.montant": "Montant",
  "forfaits.conditions": "Conditions",
  "forfaits.verdict": "Pour cette zone",
  "forfaits.sans_condition": "Aucune — s'applique partout",
  "forfaits.condition_famille": "Une famille de matériel",
  "forfaits.retenu": "Retenu",
  "forfaits.applicable_apres":
    "Applicable, mais un rang plus petit passe avant",
  "forfaits.ecarte": "Écarté — ses conditions ne sont pas remplies",
  "forfaits.inactif": "Inactif",
  "forfaits.explication_rang":
    "Le plus petit rang l'emporte. Deux forfaits de même nature ne peuvent pas partager un rang : la base le refuse, pour que deux interventions identiques ne se facturent jamais différemment selon l'ordre où les forfaits ont été saisis.",

  // ── Le paramétrage d'ouverture (lot 2, I7) ────────────────────────────────
  //
  // « Agence » et « site » ne s'écrivent pas ici : le code nomme la notion.
  "parametres.titre": "Réglage des horaires d'ouverture",
  "parametres.sous_titre":
    "Les jours travaillés, les horaires et le pas des créneaux. Chaque établissement a les siens : rien n'est écrit dans l'application.",
  "parametres.calendrier": "Calendrier",
  "parametres.jours": "Jours travaillés",
  "parametres.horaires": "Horaires",
  "parametres.pas": "Pas des créneaux (minutes)",
  "parametres.pas_enregistrer": "Enregistrer le pas",
  "parametres.creneaux_exemple": "Créneaux proposés un jour ouvré",
  "parametres.sans_calendrier":
    "Aucun calendrier n'est rattaché : aucun créneau ne peut être proposé.",
  "parametres.exception_technicien": "Exception par technicien",
  "parametres.exception_explication":
    "Un technicien peut recevoir un autre calendrier de la société — un temps partiel, une alternance, un renfort du matin. C'est un rattachement, jamais une copie d'horaires : les horaires changent à un seul endroit.",
  "parametres.exception_aucune": "Aucune exception enregistrée.",
  // ── LES COLONNES DU TABLEAU DENSE (R2-05) ────────────────────────────────
  //
  // La maquette range ce contenu en TABLEAU, pas en cartes. Les libellés
  // portent tout SAUF les notions imposées : le composant compose le titre de
  // la colonne d'établissement depuis `mot("agence")`.
  // ── L'ÉCRAN « PARC MACHINES » (R2-21) ───────────────────────────────────
  "parc.titre": "Parc machines clients",
  "parc.sous_titre":
    "Ce que CODIMA suit, chez qui, et ce qu'il reste à compléter.",
  "parc.colonne_reference": "Référence",
  "parc.colonne_modele": "Modèle",
  "parc.colonne_serie": "N° de série",
  "parc.colonne_lieu": "Client / lieu",
  "parc.colonne_mise_en_service": "Mise en service",
  "parc.colonne_statut": "Statut",
  "parc.famille": "Famille",
  "parc.vide": "Aucune machine n'est enregistrée pour cette société.",
  "parc.total": "machines",
  // LE SINGULIER EST UNE CLÉ, jamais un « s » retranché : « 1 fiches à
  // compléter » a été lu SUR UNE IMAGE le 13/09/2026, et aucune assertion ne
  // pouvait le dire — le cas n'existe que sur un parc qui porte exactement une
  // fiche incomplète.
  "parc.total_un": "machine",
  "parc.incompletes": "fiches à compléter",
  "parc.incompletes_un": "fiche à compléter",
  "parc.a_completer": "À compléter",
  "parc.non_synchronisee": "non synchronisée",
  // ── LE REGISTRE DES VGP (L9-02, L9-03 ; D88) ────────────────────────────
  //
  // AUCUN LIBELLÉ NE DIT « CONFORME » NI « NON CONFORME », et ce n'est pas une
  // omission : *CODIPLAN n'affirme jamais la conformité* — il enregistre ce
  // qu'un organisme agréé a écrit. « Sans information » est une VALEUR à part
  // entière, distincte des deux autres, et jamais un blanc : *un registre à
  // moitié rempli ressemble à un registre complet.*
  "vgp.titre": "Registre des v\u00e9rifications p\u00e9riodiques",
  "vgp.sous_titre":
    "Ce qu'on nous a dit, et quand on nous l'a dit. CODIPLAN n'affirme jamais la conformit\u00e9 : les v\u00e9rifications sont command\u00e9es par les clients, et leur r\u00e9sultat n'arrive ici que si on nous le transmet.",
  "vgp.retour": "\u2039 Retour au parc",
  "vgp.lien_depuis_parc": "Registre des v\u00e9rifications p\u00e9riodiques",
  "vgp.colonne_machine": "Machine",
  "vgp.colonne_lieu": "Client / lieu",
  "vgp.colonne_famille": "Famille",
  "vgp.colonne_regime": "R\u00e9gime",
  "vgp.colonne_information": "Derni\u00e8re information",
  "vgp.vide":
    "Aucune machine n'est enregistr\u00e9e pour cette soci\u00e9t\u00e9.",
  "vgp.borne":
    "Les premi\u00e8res fiches du parc. La recherche et le filtre par \u00e9ch\u00e9ance viennent avec la campagne dat\u00e9e (L9-08).",
  // LES QUATRE RÉGIMES — les trois valeurs de D88, plus l'origine qui les cite.
  "vgp.regime.soumis": "Soumis",
  "vgp.regime.non_soumis": "Non soumis",
  "vgp.regime.a_determiner": "\u00c0 d\u00e9terminer",
  "vgp.regime.verifie": "V\u00e9rifi\u00e9 non soumis",
  "vgp.origine.famille": "d\u00e9clar\u00e9 \u00e0 la famille",
  "vgp.origine.machine": "exception sur cette machine",
  "vgp.periodicite.modele": "rythme pr\u00e9cis\u00e9 au mod\u00e8le",
  "vgp.periodicite.famille": "rythme d\u00e9clar\u00e9 \u00e0 la famille",
  "vgp.periodicite.aucune": "aucun rythme d\u00e9clar\u00e9",
  // LES TROIS ÉTATS D'INFORMATION, et le troisième est celui qui compte.
  "vgp.information.hors_registre": "Hors registre",
  "vgp.information.sans_information": "Sans information",
  "vgp.information.recue": "Information reçue",
  "vgp.information.depuis_inconnu":
    "sans information, et sans date de mise en service pour dire depuis quand",
  // L'ÉCHÉANCE DÉDUITE (R3-11) — une DATE, jamais un verdict. « Dépassée »
  // dit qu'une date déclarée est passée ; il ne dit ni « non conforme », ni
  // « en règle » — CODIPLAN n'affirme jamais la conformité (D88).
  "vgp.colonne_echeance": "Échéance déduite",
  "vgp.echeance.declaree": "Prochaine échéance",
  "vgp.echeance.depassee": "Échéance dépassée",
  "vgp.echeance.jours": "jours",
  "vgp.echeance.sans_rythme":
    "aucun rythme déclaré : rien à déduire de cette information",
  // ~~« Aucune information d'organisme n'est enregistrable aujourd'hui […]
  // toutes les machines soumises sont donc sans information »~~ — **CETTE
  // PHRASE ÉTAIT DEVENUE FAUSSE**, et l'écran la démentait dans la même
  // fenêtre : D114 a posé `vgp_verification` le 12/09/2026, et deux lignes
  // affichaient « Information reçue » juste en dessous. *Mesuré le 13/09/2026
  // SUR UNE IMAGE, par aucune assertion* — un texte qui vieillit ne rougit
  // pas. Ce qui la remplace dit ce qui reste vrai, et le restera : le silence
  // du registre est une information, jamais un « à jour ».
  "vgp.information.ce_que_le_silence_dit":
    "Une machine dont personne ne nous a rien dit est « sans information » : le registre rapporte ce qu'on lui a transmis, et rien d'autre. La date de la vérification décide de l'échéance — pas celle de la saisie.",
  // LA MOITIÉ DÉTECTIVE (L9-03) — sans elle, la troisième valeur ne sert à rien.
  "vgp.indetermines.titre": "Familles \u00e0 d\u00e9terminer",
  "vgp.indetermines.sous_titre":
    "Une famille na\u00eet \u00ab \u00e0 d\u00e9terminer \u00bb : une case d\u00e9coch\u00e9e serait indiscernable d'une famille que personne n'a examin\u00e9e, et un pont \u00e9l\u00e9vateur sortirait du registre en silence.",
  "vgp.indetermines.lien": "familles restent \u00e0 d\u00e9terminer",
  // LE SINGULIER EST UNE CLÉ — « 1 familles restent à déterminer » a été lu
  // sur une image le 13/09/2026, comme « 1 fiches à compléter » du parc : le
  // cas n'existe que sur un parc qui en porte EXACTEMENT une.
  "vgp.indetermines.lien_une": "famille reste \u00e0 d\u00e9terminer",
  "vgp.indetermines.aucune":
    "Toutes les familles ont \u00e9t\u00e9 examin\u00e9es. Une famille cr\u00e9\u00e9e demain reviendra dans cette liste.",
  "vgp.indetermines.retour": "\u2039 Retour au registre",
  "vgp.indetermines.colonne_famille": "Famille",
  "vgp.indetermines.colonne_machines":
    "Machines en attente de la d\u00e9cision",
  // ── LA FICHE D'UNE MACHINE ET SES DOCUMENTS (L8-02) ──────────────────────
  //
  // L'ORIGINE D'UN DOCUMENT EST AFFICHÉE, et ce n'est pas un ornement : *un
  // document de modèle se corrige une fois pour toutes, un document de machine
  // n'existe que là.* Un écran qui les mêlerait ferait supprimer une notice de
  // gamme en croyant nettoyer un exemplaire.
  "machine.retour": "\u2039 Retour au parc",
  "machine.documents.titre": "Documents",
  "machine.documents.sous_titre":
    "Ceux de cette machine, et ceux de son mod\u00e8le \u2014 la m\u00eame ligne sert tous les exemplaires.",
  "machine.documents.colonne_libelle": "Document",
  "machine.documents.colonne_origine": "Port\u00e9 par",
  "machine.documents.colonne_classe": "Visibilit\u00e9",
  "machine.documents.colonne_fichier": "Fichier",
  "machine.documents.origine.modele": "Le mod\u00e8le",
  "machine.documents.origine.machine": "Cette machine",
  "machine.documents.classe.client": "Client",
  "machine.documents.classe.interne": "Interne",
  "machine.documents.vide":
    "Aucun document n'est rattach\u00e9 \u00e0 cette machine ni \u00e0 son mod\u00e8le.",
  "machine.documents.sans_octets":
    "Les fiches sont en base ; les octets attendent le stockage d'objets, qui n'a pas encore d'appelant (L8-05).",
  "parc.borne":
    "Les premières fiches du parc, les incomplètes d'abord. La recherche et l'export viennent avec les écrans de lot 2.",
  "parametres.colonne_pas": "Pas",
  "parametres.colonne_creneaux": "Créneaux",
  "parametres.colonne_exceptions": "Exceptions",
  "parametres.aucune_agence":
    "Aucun établissement n'est enregistré pour cette société.",
  "parametres.sans_calendrier_court": "Aucun calendrier",
  "parametres.refus_pas":
    "Le pas des créneaux se règle en minutes entières, entre 1 et 480.",

  // ── LA PAGE QUI DONNE UNE PORTE AUX ÉCRANS DE PARAMÉTRAGE (R3-05) ────────
  //
  // La barre de D95 est une LISTE CLOSE de onze entrées — une douzième la
  // ferait rougir, à raison. « Sociétés & tarifs » menait directement aux
  // horaires, et les deux autres écrans de réglage n'avaient AUCUNE porte.
  // L'entrée mène désormais à une page qui les rassemble : la barre ne bouge
  // pas, et le paramétrage cesse d'être un écran unique qui en cache deux.
  "parametres.index_titre": "Sociétés & tarifs",
  "parametres.index_sous_titre":
    "Les réglages de la société : ce qui décide des créneaux qu'on propose, du temps qu'on compte pour s'y rendre et de ce qu'on facture.",
  "parametres.index_horaires_titre": "Horaires d'ouverture",
  "parametres.index_horaires_resume":
    "Les jours travaillés, les horaires et le pas des créneaux, établissement par établissement. C'est ce calendrier qui décide de ce que le planning propose et de ce qu'il refuse.",
  "parametres.index_trajets_titre": "Temps de trajet par zone",
  "parametres.index_trajets_resume":
    "Le temps de route depuis l'établissement, par zone géographique. Des valeurs de référence s'appliquent tant que la société n'a rien réglé — un réglage retiré rend la main à la référence, jamais à zéro.",
  "parametres.index_forfaits_titre": "Forfaits applicables",
  "parametres.index_forfaits_resume":
    "Le catalogue des forfaits et leur ordre de priorité. Un forfait s'ajoute toujours aux heures ; il ne les remplace pas.",
  // Le libellé se COMPOSE depuis `mot("site")` : le mot imposé se définit une
  // fois, sous `vocabulaire.*`, et ne se recopie nulle part (D5, D47).
  "parametres.index_sites_suffixe": "d'intervention",
  "parametres.index_sites_resume":
    "Les lieux où l'on intervient, chez les clients. Leur rattachement décide du temps de trajet estimé et du calendrier de référence.",
  "parametres.index_ouvrir": "Ouvrir",

  // ── LES TEMPS DE TRAJET PAR ZONE (R3-03, D107, RG-PLA-05) ────────────────
  //
  // Les six durées de l'estimation par zone n'étaient écrites nulle part avant
  // D107. Ce sont des DÉFAUTS modifiables, jamais des constantes : une société
  // les corrige depuis cet écran, et sa correction vit en base. Les valeurs de
  // référence, elles, sont dans `lib/sites/trajet-zone.ts` — ce fichier ne
  // porte que ce qu'un humain lit.
  "trajets.titre": "Temps de trajet par zone",
  "trajets.sous_titre":
    "Trajet aller depuis l'établissement dont dépend le lieu d'intervention. Une durée saisie sur sa fiche fait toujours foi ; celles-ci ne servent qu'en son absence.",
  "trajets.colonne_zone": "Zone",
  "trajets.colonne_defaut": "Valeur de référence",
  "trajets.colonne_reglee": "Réglage de la société",
  "trajets.colonne_applique": "Ce qui s'applique",
  "trajets.colonne_action": "Régler",
  "trajets.minutes": "minutes",
  "trajets.non_reglee": "Non réglée",
  "trajets.origine_societe": "réglage de la société",
  "trajets.origine_defaut": "valeur de référence",
  "trajets.enregistrer": "Enregistrer",
  "trajets.retirer": "Revenir à la référence",
  // D107, mot pour mot. Ce n'est pas une valeur qui manque : c'est une valeur
  // qui n'existe pas à la maille de la zone — Lifou, Bélep et Ouvéa n'ont ni
  // le même vol ni la même fréquence.
  "trajets.sans_estimation_iles":
    "Déplacement par avion — estimation impossible, à saisir par intervention.",
  "trajets.refus":
    "Un temps de trajet se règle en minutes entières, entre 1 et 1440, et seulement sur une zone qui admet une estimation.",
  // Ce que cet écran affirme et ce qu'il n'affirme pas — écrit à l'écran plutôt
  // que dans le code, parce que c'est celui qui règle qui doit le lire.
  "trajets.explication_cascade":
    "Trois niveaux, du plus fort au plus faible : la durée saisie sur la fiche du lieu d'intervention, puis le réglage de la société ci-dessus, puis la valeur de référence. Retirer un réglage rend la main à la référence — il n'écrit jamais zéro.",
  "trajets.explication_planification":
    "Donnée de planification, et rien d'autre : elle entre dans la charge et les tournées, jamais dans les heures facturées. Le déplacement se facture par un forfait de zone.",
  "trajets.explication_inter_sites":
    "Ces durées partent toutes de l'établissement. Le trajet d'un lieu d'intervention à un autre n'est pas connu, et il n'est pas compté.",

  // ── LA BARRE DE NAVIGATION — les onze entrées de la maquette (D95) ───────
  //
  // Onze, et dans cet ordre : c'est la barre que la maquette porte, et elle
  // fait foi sur la disposition. Les entrées dont l'écran n'existe pas encore
  // sont rendues INERTES plutôt qu'absentes — la barre dit ce que le produit
  // contient, jamais ce que vous avez le droit d'ouvrir (voir
  // `lib/navigation/entrees.ts`).
  "nav.libelle": "Navigation principale",
  // Le nom du produit est coupé en deux parce que la maquette le peint en deux
  // couleurs. Le couper dans le composant aurait été écrire du texte dans une
  // balise, ce que L0-11 refuse.
  "nav.marque_debut": "CODI",
  "nav.marque_fin": "PLAN",
  "nav.marque_metier": "SAV",
  "nav.a_venir": "Écran à venir",
  "nav.tableau_de_bord": "Tableau de bord",
  "nav.planning": "Planning",
  "nav.interventions": "Interventions",
  "nav.parc_machines": "Parc machines",
  "nav.contrats": "Contrats",
  "nav.app_technicien": "App technicien",
  "nav.portail_client": "Portail client",
  // D97 — l'entrée de la barre DU PORTAIL. Distincte de « Portail client »,
  // qui est l'entrée du back-office vers ce même espace : ce n'est pas le même
  // lecteur, donc ce n'est pas le même mot.
  "nav.portail_parc": "Votre parc",
  "nav.imports_excel": "Imports Excel",
  "nav.societes_tarifs": "Sociétés & tarifs",
  "nav.console_editeur": "Console éditeur",

  // ── LA GRILLE DU PLANNING (D95) ──────────────────────────────────────────
  "planning.colonne_technicien": "Technicien",
  "planning.semaine": "Semaine",
  "planning.du": "du",
  "planning.au": "au",
  "planning.semaine_avant": "← Semaine précédente",
  "planning.semaine_apres": "Semaine suivante →",
  "planning.semaine_vide": "Aucune intervention posée sur cette semaine.",
  "planning.file_vide": "Rien n'attend d'être posé.",
  // La légende de la maquette, six entrées, dans son ordre. Elle NOMME des
  // familles de couleur, pas des statuts un à un : huit statuts, cinq
  // familles, et c'est la maquette qui groupe (voir `lib/theme/statuts.ts`).
  // ── LES DEUX VUES DU PLANNING (11/09/2026) ───────────────────────────────
  "planning.vue_semaine": "Semaine",
  "planning.vue_jour": "Jour",
  "planning.jour_avant": "← Jour précédent",
  "planning.jour_apres": "Jour suivant →",
  "planning.colonne_heure": "Heure",
  "planning.jour_vide": "Aucune intervention posée ce jour-là.",
  "planning.creneaux_libres": "créneaux libres",
  "planning.pas": "pas de",
  "planning.jour_occupe": "Occupé",
  "planning.jour_libre": "Libre",
  "planning.jour_hors_ouverture": "Hors ouverture",
  // CE QUE LA VUE JOUR NE PEUT PAS DESSINER, ET QU'ELLE DIT (12/09/2026).
  // *Une intervention qui ne peut pas être dessinée doit être DITE, jamais
  // effacée* : trois disparitions silencieuses vivaient dans cet écran, et un
  // planning qui perd une ligne fait poser quelqu'un sur un créneau déjà pris.
  "planning.jour_hors_grille": "Non placées sur la grille",
  "planning.jour_hors_grille_aide":
    "Elles sont bien de ce jour ; l'axe des heures ne peut pas les montrer.",
  "planning.jour_hors_grille_sans_creneau": "sans heure saisie",
  "planning.jour_hors_grille_hors_axe": "hors des heures d'ouverture",
  "planning.legende.planifiee": "Planifiée",
  "planning.legende.en_cours": "En cours / P1",
  "planning.legende.terminee": "Terminée",
  "planning.legende.suspendue": "Suspendue / absence",
  "planning.legende.interne": "Atelier / interne",
  "planning.legende.ferme": "Jour non ouvert",

  // Les jours abrégés — l'en-tête d'une colonne de la grille, « Lun 17 ».
  "jour.court.1": "Lun",
  "jour.court.2": "Mar",
  "jour.court.3": "Mer",
  "jour.court.4": "Jeu",
  "jour.court.5": "Ven",
  "jour.court.6": "Sam",
  "jour.court.7": "Dim",

  "jour.1": "lundi",
  "jour.2": "mardi",
  "jour.3": "mercredi",
  "jour.4": "jeudi",
  "jour.5": "vendredi",
  "jour.6": "samedi",
  "jour.7": "dimanche",

  // ── La page de santé, sans compte (mise en ligne) ─────────────────────────
  "sante.titre": "État de l'installation",
  "sante.sous_titre":
    "Quatre questions, quatre réponses. Cette page ne demande aucun compte et ne montre jamais d'adresse, de nom de base ni d'identifiant.",
  "sante.base": "La base de données répond",
  "sante.role": "Le rôle de connexion est le bon",
  "sante.role_explication":
    "L'application doit se connecter avec un rôle non propriétaire, faute de quoi le cloisonnement entre sociétés ne s'applique pas.",
  "sante.migrations": "Les migrations sont à jour",
  "sante.migration_manquante": "Migration non appliquée",
  "sante.societes": "Sociétés enregistrées",
  "sante.comptes": "Comptes enregistrés",
  "sante.oui": "oui",
  "sante.non": "non",
  "sante.inconnu": "inconnu",
  "sante.non_lisible": "non lisible d’ici",
  "sante.tout_va_bien": "L'installation répond et paraît complète.",
  "sante.quelque_chose_cloche":
    "Quelque chose ne va pas : les lignes marquées « non » ci-dessous disent quoi.",
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
