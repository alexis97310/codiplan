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
  // LE GABARIT DU TITRE D'ONGLET (VISUEL-1, 23/09/2026) — `%s` est le
  // marqueur que Next.js remplace par le titre de CHAQUE écran
  // (`app/layout.tsx`, `metadata.title.template`). Une chaîne entière plutôt
  // que « — » seul : la ponctuation autour du gabarit est un texte lu à
  // l'écran (l'onglet du navigateur) comme n'importe quel autre.
  "app.gabarit_titre": "%s — CODIPLAN",
  // LE GLYPHE DE LA LOUPE (N-12) — `components/ui/barre-de-filtres.tsx`,
  // partagé par `/parc` et `/clients`. Décoratif (`aria-hidden`), mais un
  // caractère RENDU à l'écran reste un texte que L0-11 fait passer par ici :
  // le gardien des chaînes visibles ne sait pas distinguer un glyphe d'un
  // mot, et n'a pas à le savoir (même raison que `parc.symbole_machine`).
  "recherche.loupe": "⌕",
  // LE SÉLECTEUR DE RECHERCHE SERVEUR (SELECTEURS-1, 24/09/2026) —
  // `components/ui/selecteur-recherche.tsx`, partagé par les sélecteurs de
  // client, de site et de modèle sur `/sites/nouveau`, `/interventions/nouvelle`
  // et `/parc/nouvelle`. Deux clés génériques plutôt qu'une par domaine : le
  // texte ne varie pas d'un sélecteur à l'autre, seul le libellé du CHAMP le
  // distingue (`t("site.client")`, `mot("site")`, `t("machine.champ.modele")`).
  "selecteur.aucun_resultat": "Aucun résultat.",
  "selecteur.voir_plus": "Voir plus",
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
  // ── L'ÉCRAN « CHARTE DE LA SOCIÉTÉ » (N-02, 16/09/2026) ──────────────────
  //
  // Ce que la barre affichait en permanence pour répondre à une question
  // qu'on ne pose qu'une fois, à la mise en service — devenu un écran de
  // paramétrage, sous « Sociétés & tarifs ».
  "parametres.societe_titre": "Charte de la société",
  "parametres.societe_sous_titre":
    "L'identité affichée de la société active — un diagnostic pour l'instant, un réglage avec la console éditeur.",
  "parametres.societe_diagnostic_aide":
    "Distingue une société qui a choisi ses propres couleurs d'une société qui n'en a pas : la seconde reçoit le thème neutre de CODIPLAN.",
  // LE RÉGLAGE N'EST PAS ENCORE ICI, ET L'ÉCRAN LE DIT PLUTÔT QUE DE LAISSER
  // CROIRE LE CONTRAIRE : changer de couleur reviendra à la console éditeur
  // (lot 7), qui donnera à la société le formulaire que cet écran se contente
  // aujourd'hui de LIRE.
  "parametres.societe_reglage_a_venir":
    "Les couleurs se règlent depuis la console éditeur, à venir au lot 7. Cet écran affiche l'état, il ne le modifie pas encore.",
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
  "arrivee.entrer.terrain": "Ouvrir ma journée",

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
  // ── LE CHOIX D'UNE SOCIÉTÉ (D61, D67 — écran écrit le 10/09/2026) ────────
  //
  // Il manquait, et son absence était un MUR : un compte habilité sur deux
  // sociétés n'en activait aucune, donc n'atteignait aucun écran cloisonné.
  // Les deux politiques qui le rendent possible existaient depuis deux jours.
  "arrivee.choix.titre": "Choisir la société sur laquelle travailler",
  "arrivee.choix.aide":
    "Vous êtes habilité sur plusieurs sociétés. Une seule est active à la fois, et tout ce que vous verrez ensuite lui appartient.",
  // D-04 (2/4) — LA CLÉ CI-DESSUS S'AFFICHAIT POUR UNE SEULE SOCIÉTÉ AUSSI.
  // *Mesuré : la section se rend dès `societes.length > 0`
  // (`app/(back-office)/arrivee/page.tsx`), quelle que soit l'issue — et
  // `tests/isolation/premier-ecran.test.ts` le confirmait déjà en prose sans
  // que personne n'en tire la conséquence sur CE texte. Une clé de plus,
  // jamais une interpolation : `t()` ne prend aucun paramètre (§5, L0-11).*
  "arrivee.choix.aide_une":
    "Cette société est associée à votre compte. Tout ce que vous verrez ensuite lui appartient.",
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
  "client.refus.saisie":
    "La saisie a \u00e9t\u00e9 refus\u00e9e\u00a0: la raison sociale est obligatoire.",

  // ── L'ÉCRAN CLIENT (14/09/2026) ───────────────────────────────────────────
  //
  // La LISTE se rejoint depuis « Sociétés & tarifs », et c'est de là que part
  // la création ; la FICHE se rejoint aussi depuis les colonnes « Client » du
  // parc et des sites. *Neuf fois sur dix on arrive à un client en partant
  // d'une machine ou d'un lieu qu'on regardait déjà — mais on ne peut pas créer
  // un client depuis une machine qui n'existe pas encore.*
  "clients.sous_titre":
    "Le r\u00e9f\u00e9rentiel des clients de la soci\u00e9t\u00e9\u00a0: identit\u00e9, code de rapprochement \u00e0 l'import, et lieux d'intervention.",
  "clients.creer": "Nouveau client",
  "clients.rechercher": "Rechercher",
  // LE FILTRE D'ÉTAT — un <select>, jamais plus une case à cocher (N-08,
  // 18/09/2026). Mesuré sur `clients()` de
  // `docs/maquette/codiplan-maquette-complete.html` : « Tous les clients /
  // Actifs / À compléter ». Le troisième état de la maquette ferme sur une
  // notion que le chapitre 10 ne porte pas ; le nôtre ferme sur `inactifs`,
  // qui EXISTE déjà (`client.actif`) plutôt que de rester une case qu'on ne
  // peut que masquer. **Bloc contigu pour ce ticket, comme l'exige le §5.**
  "clients.filtre.libelle": "Filtrer par état",
  "clients.filtre.tous": "Tous les clients",
  "clients.filtre.actifs": "Actifs",
  "clients.filtre.inactifs": "Inactifs",
  // LISTES-1 (23/09/2026) — même contrat que « sites.filtre_equipement ».
  "clients.filtre_equipement": "Afficher aussi les clients sans équipement",
  "clients.inactif": "inactive",
  "clients.retour": "\u2190 Tous les clients",
  // LE SEUL COMPTEUR, et il nomme un geste. Les trois autres qu'une maquette
  // montrerait — total, actifs, inactifs — se lisent dans le tableau, et *un
  // compteur qu'on regarde sans jamais agir dessus apprend à ne plus lire les
  // compteurs* (§9, 11/09).
  "clients.sans_code_titre": "Sans",
  "clients.sans_code_aide":
    "Ces fiches n'ont pas de code de rapprochement\u00a0: un import ne saura pas les reconna\u00eetre et les recr\u00e9era. Le compteur porte sur toute la recherche, et non sur les seules lignes affich\u00e9es.",
  // L'AIDE DU CHAMP N'EST PAS L'AIDE DU COMPTEUR (constaté À L'IMAGE le
  // 14/09/2026). Le formulaire de création reprenait `clients.sans_code_aide`,
  // qui se termine par « Le compteur porte sur toute la recherche » — une
  // phrase vraie de la LISTE et dépourvue de sens sous un champ de saisie.
  // *Une clé réemployée hors de sa destination est du texte juste au mauvais
  // endroit, et rien ne rougit* : les deux disent la même règle, et seule
  // l'image montre que l'une d'elles parle d'un écran qu'on ne regarde pas.
  "clients.code_externe.aide":
    "La cl\u00e9 par laquelle un import reconna\u00eet cette fiche. Sans elle, un import ne saura pas la rapprocher et cr\u00e9era un doublon. Elle est unique dans votre soci\u00e9t\u00e9, et peut rester vide.",
  "clients.sans_code_aucune":
    "Toutes les fiches de cette recherche portent un code de rapprochement.",
  // LA CARTE CLIENT (D123, N-08) — *elle dit où l'on intervient chez ce
  // client, et c'est la question qu'on se pose en ouvrant la liste.*
  // PASTILLES-1 (23/09/2026) : le libellé « lieu »/« lieux » de ce compteur
  // est devenu « site »/« sites » (demande d'Alexis) — un MOT IMPOSÉ (§3,
  // D5/D47, `tests/unit/i18n/vocabulaire-impose.test.ts`), qui ne s'écrit
  // qu'une fois sous `vocabulaire.site` : `compteurSites` le compose
  // désormais par `motDansUnePhrase("site", …)`, ces deux clés ont disparu.
  // LISTES-1 (23/09/2026) — même notion, au mot près, que « sites.equipements_un ».
  "clients.equipements_un": "équipement",
  "clients.equipements_plusieurs": "équipements",
  // LA FICHE
  "clients.fiche.identite": "Identit\u00e9",
  "clients.fiche.sites": "Lieux d'intervention",
  "clients.fiche.sites_vide":
    "Aucun lieu d'intervention n'est enregistr\u00e9 pour ce client.",
  "clients.fiche.interventions": "Historique des interventions",
  "clients.fiche.interventions_vide":
    "Aucune intervention n'est enregistr\u00e9e pour ce client.",
  // LE BLOC « CONTACTS » (CONTACTS-1) — la fiche montre tous les
  // interlocuteurs du client, qu'ils soient du client (`site_id` nul) ou d'un
  // de ses sites. Le formulaire de création vit dans ce même bloc.
  "clients.fiche.contacts": "Contacts",
  "clients.fiche.contacts_vide":
    "Aucun interlocuteur n'est enregistr\u00e9 pour ce client.",
  "clients.action.creer": "Cr\u00e9er la fiche",
  "clients.action.modifier": "Enregistrer",
  "clients.cree": "La fiche client est cr\u00e9\u00e9e.",
  "clients.modifie": "La fiche client est enregistr\u00e9e.",
  // L'ÉTAT SE CHOISIT, IL NE SE DÉCOCHE PAS — et c'est une décision.
  //
  // Une case à cocher décochée est ABSENTE du formulaire, et le schéma de
  // modification lit une absence comme « ne touche pas à cette colonne » : la
  // désactivation n'aurait jamais eu lieu, **et l'écran aurait dit que si**.
  // *Un succès qui ne fait pas ce qu'on lui a demandé est pire qu'un refus*
  // (R2-20). Deux valeurs explicites ferment ce chemin.
  "clients.etat": "\u00c9tat de la fiche",
  "clients.etat.actif": "Active",
  "clients.etat.inactif":
    "Inactive — conserv\u00e9e, mais retir\u00e9e des listes courantes",
  "clients.etat.aide":
    "Une fiche ne se supprime pas depuis cet \u00e9cran\u00a0: ce qui la r\u00e9f\u00e9rence la retient, et la voie ordinaire est de la rendre inactive.",
  "clients.nouveau.titre": "Nouveau client",
  "clients.nouveau.sous_titre":
    "La soci\u00e9t\u00e9 vient de la session et n'est jamais une saisie. L'adresse de facturation n'est pas demand\u00e9e ici\u00a0: sa forme n'est fix\u00e9e nulle part, et une adresse cal\u00e9donienne n'a pas celle d'une adresse m\u00e9tropolitaine.",

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
  // CONTRAT-SITE-1 — la case du formulaire de modification. Le vrai module
  // Contrats reste reporté (arbitrage du 23/09/2026) : cette case ne porte
  // aucune date, aucune référence, aucun montant.
  "site.sous_contrat": "Sous contrat de maintenance",
  "site.recherche.vide": "Aucun résultat ne correspond à cette recherche.",
  // ── L'ÉCRAN (L3-16) ───────────────────────────────────────────────────────
  // Comme partout, le mot imposé ne s'écrit PAS ici : le titre de l'écran se
  // compose depuis `mot("site.pluriel")`, et le libellé de colonne du
  // rattachement depuis `mot("agence")`.
  "sites.sous_titre":
    "Les lieux d'intervention de vos clients, leur rattachement et leur temps de trajet.",
  "sites.recherche": "Libellé, commune ou client",
  "sites.rechercher": "Rechercher",
  "sites.creer": "Nouveau lieu",
  "sites.inactif": "Inactif",
  // Le libellé COURT de la colonne. Le libellé complet — celui qui dit d'où
  // l'on part — vit dans « site.temps_trajet_min », et la fiche l'emploie.
  // *Une colonne ne peut pas porter une phrase ; la fiche, si.*
  "sites.colonne_trajet": "Trajet (min)",
  // LISTES-1 : la valeur affichée n'est PAS celle saisie sur le site — c'est
  // le défaut par zone (`lib/sites/trajet-zone.ts`). Le libellé le dit, pour
  // que personne ne croie lire une mesure.
  "sites.colonne_trajet_estimation": "Trajet estimé (min)",
  "sites.equipements_un": "équipement",
  "sites.equipements_plusieurs": "équipements",
  // LA PASTILLE VERTE « habilitation requise » (PASTILLES-1, ajout d'Alexis le
  // 23/09 au soir) — ZÉRO ligne de `SiteHabilitationRequise` n'affiche aucune
  // pastille ; ces deux clés ne servent qu'à partir de un.
  "sites.habilitations_un": "habilitation",
  "sites.habilitations_plusieurs": "habilitations",
  "sites.filtre_equipement": "Afficher aussi les lieux sans équipement",
  // CONTRAT-SITE-1 — la case du filtre de `/sites`, et le libellé de la
  // pastille jaune (ton orange, PASTILLES-1) qui l'accompagne sur la carte.
  "sites.filtre_contrat": "Sous contrat uniquement",
  "sites.contrat": "Contrat",
  "sites.action.modifier": "Enregistrer",
  // LA FICHE D'UN LIEU MONTRE SES DERNIÈRES INTERVENTIONS (HISTORIQUE-SITE-1).
  //
  // *« Qu'est-ce qu'on a déjà fait à cet endroit ? »* se demande avant de
  // planifier ; la fiche était muette. La borne est ÉCRITE à côté du tableau
  // — préfixe, nombre composé par l'écran, suffixe — plutôt que de laisser
  // croire qu'il montre tout ; et un lieu sans aucune intervention DIT son
  // absence, comme « habilitations.site.aucune » juste au-dessus (D88).
  "sites.fiche.interventions": "Derni\u00e8res interventions",
  "sites.fiche.interventions_borne_prefixe": "Au plus",
  "sites.fiche.interventions_borne_suffixe":
    "interventions, la plus r\u00e9cente en t\u00eate ; celles qui restent \u00e0 planifier en bas.",
  "sites.fiche.interventions_vide":
    "Aucune intervention n'est enregistr\u00e9e pour ce lieu.",
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
  // AJOUTÉ le 22/09/2026 (REPRISE-HISTORIQUE) — mesuré en production : un
  // marqueur d'un type qu'AUCUN gabarit ne publiait recevait la phrase
  // ci-dessus, et « vérifiez le type d'import choisi » envoyait chercher une
  // case qui n'existe pas (D31 : le marqueur décide). Celle-ci dit l'autre
  // chose — rien à corriger, ce type n'est pas encore importable — et l'écran
  // fait suivre le type annoncé, en chasse fixe, après le séparateur.
  "import.anomalie.marqueur_type_inconnu":
    "Ce fichier est un modèle CODIPLAN, mais cette version de l'application ne sait pas encore importer le type qu'il annonce. Il n'y a rien à corriger dans le fichier ni dans le choix d'un type : il n'est pas encore pris en charge. Type annoncé par le marqueur",
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

  // ── L'ÉCRAN D'IMPORT (L1-11 ; I6, RG-IMP-01 à 05, D31, D54) ─────────────
  //
  // La maquette gouverne la DISPOSITION de cet écran (D95) ; elle ne gouverne
  // pas ses PHRASES quand une décision de rang 1 les a réécrites. Deux cas,
  // nommés ici parce que c'est ici qu'ils se lisent :
  //
  //   — « Annulable pendant 24 h » : **D54 a SUPPRIMÉ cette fenêtre.** Le
  //     critère ligne à ligne mesure directement ce que la borne approchait, et
  //     il traite mieux le cas des imports qui se recouvrent. *Une
  //     approximation conservée à côté de sa mesure n'ajoute pas de sécurité :
  //     elle en retire.* Le libellé dit donc la vraie règle.
  //   — « Inchangés » : **notre rapport ne compte pas cette catégorie.** Il
  //     compte créations, modifications, rejets, gabarits et lignes vides
  //     (L1-08d), et les décomptes sont DÉRIVÉS des lignes retenues. *Afficher
  //     un « inchangés » qu'aucune mesure ne produit serait un chiffre inventé
  //     au milieu de chiffres mesurés* (§9, 06/09).
  "imports.titre": "Imports Excel",
  "imports.sous_titre":
    "Les échanges avec les outils du client passent par des fichiers Excel contrôlés — jamais par une base ouverte.",
  "imports.regle": "Aucun import n'est appliqué sans validation.",
  "imports.regle_detail":
    "Le fichier est d'abord contrôlé ligne à ligne et le résultat vous est présenté ; rien n'est écrit tant que vous n'avez pas validé. Un lot appliqué reste annulable : ce qui est sans danger est restauré, ce qui ne l'est pas est refusé avec son motif.",
  "imports.nouveau_titre": "Nouvel import — Clients",
  // D-02 (19/09/2026) : ce titre nommait un type — « Clients » — qu'AUCUN
  // sélecteur de cet écran ne choisit ; c'est le marqueur en cellule A1 du
  // fichier qui en décide, et `imports.fichier_aide`, juste en dessous, le dit
  // déjà correctement. Nouvelle clé plutôt que réécriture de la précédente
  // (consigne de lot : ne pas réécrire une clé existante de ce dictionnaire) —
  // `imports.nouveau_titre` reste donc ci-dessus, intacte et désormais inutilisée.
  "imports.nouveau_titre_generique": "Nouvel import",
  "imports.fichier": "Classeur à contrôler",
  "imports.fichier_aide":
    "Un fichier .xlsx bâti sur le modèle CODIPLAN. La première cellule porte le marqueur du modèle : c'est lui qui dit de quel import il s'agit.",
  "imports.controler": "Contrôler le fichier",
  "imports.modele_indisponible": "Télécharger le modèle Excel",
  // CORRIGÉ le 16/09/2026 : la dépendance d'écriture manquante a été le motif
  // jusqu'à l'adoption de `write-excel-file` (RG-IMP-03, voir le fichier des
  // rejets) — la répéter ici mentirait désormais. Ce qui reste dû est de
  // produire les sept modèles eux-mêmes, pas la dépendance qu'ils
  // demandaient.
  //
  // RÉÉCRIT le 23/09/2026 (VISUEL-1) : la phrase nommait un ticket interne
  // (« L1-09 ») sans aucune valeur pour la personne qui la lit à l'écran —
  // fuite mesurée en production. Le motif utile pour un exploitant est qu'il
  // n'y a rien à faire de son côté, et que ce n'est pas oublié.
  "imports.modele_indisponible_motif":
    "Le modèle à télécharger n'est pas encore disponible pour ce type d'import.",

  // LES TYPES, ET CE QU'ON PEUT EN FAIRE AUJOURD'HUI. *Un écran qui accepterait
  // un fichier de contacts en montrerait le rapport et ne saurait rien en
  // faire* : la seule fonction d'application qui existe est celle des clients.
  // Les quatre autres sont NOMMÉS plutôt que proposés — comme une entrée de
  // barre inerte, que D95 distingue expressément d'une entrée absente.
  "imports.disponibles_titre": "Imports disponibles",
  "imports.disponibles_aide":
    "Un type est utilisable de bout en bout quand il sait à la fois contrôler un fichier et l'appliquer. Les autres savent déjà contrôler.",
  "imports.type.clients": "Clients",
  "imports.type.clients_detail":
    "Clé de rapprochement : le code externe, à défaut la raison sociale.",
  "imports.type.contacts": "Contacts",
  "imports.type.contacts_detail": "Complément du référentiel client.",
  // **PAS DE LIBELLÉ ICI POUR CE TYPE, ET C'EST LA RÈGLE** : « site » est un
  // MOT IMPOSÉ (D5, D47), il se définit une fois sous `vocabulaire.*` et se
  // compose ailleurs depuis `mot("site")`. *Le gardien a rougi sur la première
  // rédaction, à raison.* La clé portée par la liste des types est celle du
  // RESTE du libellé — ici il n'y en a pas, et le titre est le mot seul.
  "imports.type.sites_detail":
    "Lieux d'intervention, rattachés à un client et à un établissement.",
  "imports.type.modeles": "Modèles de matériel",
  "imports.type.modeles_detail": "Référentiel technique — marque et référence.",
  "imports.type.prestations": "Prestations",
  "imports.type.prestations_detail":
    "Catalogue des durées standard, sans aucun montant.",
  "imports.type.familles": "Familles de matériel",
  // Le détail nomme les DEUX moitiés, parce que la seconde est ce qui distingue
  // ce gabarit de tous les autres : il déclare une obligation réglementaire.
  "imports.type.familles_detail":
    "Racine du parc — et c'est ici que se déclare l'assujettissement aux vérifications réglementaires. Sans déclaration, la famille naît « à déterminer ».",
  "imports.type.equipements": "Équipements",
  // *Le mot imposé n'est PAS écrit ici* : le gardien du vocabulaire a rougi sur
  // la première rédaction, à raison (D5, D47). La notion se dit par sa
  // définition — « le lieu où elle est installée » —, jamais par le mot.
  "imports.type.equipements_detail":
    "Les machines elles-mêmes. Chacune désigne son modèle, son client et le lieu où elle est installée ; sans numéro de série lisible, la fiche entre à compléter.",
  // L'ARCHIVE SAV (REPRISE-HISTORIQUE, D127). Le détail dit les trois faits
  // de l'arbitrage — close, sans temps, sans machine créée — parce que c'est
  // ce qu'un lecteur doit savoir AVANT de déposer 1 996 lignes.
  "imports.type.historique": "Historique des interventions",
  "imports.type.historique_detail":
    "Archive des interventions déjà faites, une ligne par document. Chacune naît clôturée, sans temps ni file d'attente ; le n° de série rattache à une machine existante, jamais n'en crée.",
  // LES VÉRIFICATIONS RÉGLEMENTAIRES ET LEURS OBSERVATIONS (VGP-IMPORT). Le
  // premier détail dit ce qu'un lecteur doit savoir AVANT de déposer 333 PV :
  // la clé est le rang — un second dépôt recharge tout —, un PV sans machine
  // attend au lieu d'être refusé, et l'origine vient du fichier (D114). Le
  // second dit l'ORDRE et l'arbitrage 1 : aucune demande n'est créée.
  "imports.type.vgp": "Vérifications périodiques (VGP)",
  "imports.type.vgp_detail":
    "Les procès-verbaux des organismes agréés, un par machine contrôlée. Chaque ligne est une vérification distincte : un second dépôt du même fichier la rechargerait — annulez le lot précédent avant. Sans machine identifiée, le PV est retenu en attente de rattachement, jamais refusé ni inventé. La colonne « Origine » porte un des quatre codes : rapport_organisme, rapport_transmis_client, vignette_constatee, declaration_client.",
  "imports.type.vgp_observations": "Observations des vérifications (réserves)",
  "imports.type.vgp_observations_detail":
    "Les réserves relevées par l'organisme, chacune sous son procès-verbal. Importez et appliquez d'abord les vérifications : une référence de rapport inconnue est refusée. Aucune demande n'est créée — une observation importée est consultable, rien de plus.",
  "imports.type.complet": "Contrôle et application",
  "imports.type.controle_seul": "Contrôle seulement",
  "imports.type.controle_seul_motif":
    "Le rapport se produit ; l'écriture en base n'est pas encore construite pour ce type.",

  "imports.journal_titre": "Journal des chargements",
  "imports.journal_aide":
    "Les derniers lots contrôlés, du plus récent au plus ancien.",
  "imports.journal_vide": "Aucun fichier n'a encore été contrôlé.",
  "imports.colonne_fichier": "Fichier",
  "imports.colonne_type": "Type",
  "imports.colonne_date": "Contrôlé le",
  "imports.colonne_auteur": "Par",
  // LES DEUX ABSENCES D'UN NOM, ET ELLES NE DISENT PAS LA MÊME CHOSE.
  // *« La politique refuse » est légitime et le reste ; « je n'ai pas
  // demandé » est une anomalie et se lit comme telle* (14/09/2026). Les clés
  // du planning ne sont PAS réutilisées : leurs libellés disent « Technicien »,
  // et l'auteur d'un import n'en est pas un. *Une clé nommée d'après son
  // premier appelant devient fausse au second* — ici c'est le LIBELLÉ qui
  // l'aurait été.
  "imports.auteur_non_communique": "Nom non communiqué",
  "imports.auteur_non_demande": "Anomalie : nom non demandé",
  "imports.colonne_statut": "Statut",
  "imports.statut.controle": "Contrôlé",
  "imports.statut.applique": "Appliqué",
  "imports.statut.annule": "Annulé",

  "imports.lot_titre": "Rapport de contrôle",
  "imports.lot_retour": "← Retour aux imports",
  "imports.lot_introuvable":
    "Ce lot n'existe pas, ou il n'appartient pas à la société active.",
  "imports.resultat_titre": "Résultat du contrôle",
  "imports.creations": "Nouveaux",
  "imports.creations_detail": "seront créés",
  "imports.modifications": "Modifiés",
  "imports.modifications_detail": "seront mis à jour",
  // AJOUTÉ le 16/09/2026 (point 1 de la session du dépassement de délai) :
  // voir le docblock de `lignesDeResultat`. Zéro tant que le lot reste
  // `controle` — c'est l'application, et elle seule, qui le mesure.
  "imports.inchangees": "Inchangés",
  "imports.inchangees_detail": "portent déjà ces valeurs : rien n'a été écrit",
  "imports.rejets": "Rejets",
  "imports.rejets_detail": "ne seront pas écrits",
  "imports.gabarits": "Lignes de gabarit",
  "imports.gabarits_detail": "exemples du modèle, ignorés",
  "imports.vides": "Lignes vides",
  "imports.vides_detail": "ignorées",
  "imports.lignes_titre": "Lignes rejetées",
  "imports.lignes_aucun_rejet":
    "Aucune ligne rejetée : tout ce que le fichier porte peut être écrit.",
  "imports.colonne_ligne": "Ligne",
  "imports.colonne_cle": "Clé de rapprochement",
  "imports.colonne_motif": "Motif",
  "imports.cle_absente": "aucune",
  "imports.appliquer": "Appliquer l'import",
  "imports.appliquer_aide":
    "Écrit en base exactement les lignes montrées ci-dessus, et rien d'autre.",
  "imports.annuler": "Annuler ce lot",
  "imports.annuler_aide":
    "Défait ce qui peut l'être. Une fiche modifiée ou référencée depuis est refusée avec son motif, et rien n'est supprimé en cascade.",
  // ACTIF depuis le 16/09/2026 (RG-IMP-03, `write-excel-file`) : voir le
  // docblock de `app/(back-office)/imports/[id]/page.tsx`.
  "imports.telecharger_rejets": "Télécharger les rejets",

  // LA DURÉE DE L'APPLICATION (MESURE-1, 23/09/2026) — un fait mesuré, jamais
  // `appliqueLe - controleLe` (voir `app/(back-office)/imports/presentation.ts`).
  // Un lot qui reste `controle` n'a rien à mesurer : l'absence est NOMMÉE,
  // jamais un zéro qui se lirait comme « instantané ».
  "imports.duree_application_titre": "Durée de l'application",
  "imports.duree_application_absente":
    "non mesurée — ce lot n'a pas encore été appliqué",

  // **CE N'EST PAS UN REFUS, C'EST UN ÉTAT** (R6-01) : le fichier est correct,
  // le rapport est juste, et il n'y a rien à corriger. *Le dire comme une
  // erreur enverrait l'auteur du classeur chercher ce qu'il a mal rempli.*
  "imports.type_sans_application":
    "Ce type de fichier se contrôle mais ne s'écrit pas encore : le rapport ci-dessus dit ce qui serait fait, et aucune fiche ne sera créée. Il n'y a rien à corriger dans le fichier.",

  "imports.applique": "Le lot a été appliqué.",
  "imports.annule": "Le lot a été annulé, et tout a été défait.",
  "imports.annule_partiel":
    "Le lot a été annulé. Une partie n'a pas pu être défaite : les fiches concernées ont été modifiées ou sont référencées depuis, et elles ont été laissées intactes.",

  // LES MOTIFS DE REJET D'UNE LIGNE. Ce sont les codes que `lib/imports/modeles.ts`
  // et `lib/excel/controle.ts` rendent — deux causes distinctes, et elles ne se
  // corrigent pas au même endroit : l'une dans le FICHIER, l'autre dans le PARC.
  "imports.motif.saisie_refusee":
    "Cette ligne ne passe pas la saisie : une valeur manque ou n'est pas au format attendu. La correction est dans le fichier.",
  "imports.motif.parent_introuvable":
    "La fiche que cette ligne désigne n'existe pas dans le parc. La correction est dans le parc, ou dans la colonne qui le nomme.",
  "imports.motif.cle_ambigue":
    "Plusieurs fiches du parc portent la même clé : cette ligne ne désigne rien de sûr. La correction est dans le parc — c'est ce doublon qu'il faut lever.",
  // LES TROIS PARENTS D'UN ÉQUIPEMENT, NOMMÉS SÉPARÉMENT. Un « parent
  // introuvable » sur une ligne qui en désigne trois envoie chercher dans trois
  // référentiels — et chacun de ces trois-là dit où regarder.
  "imports.motif.client_introuvable":
    "Aucun client ne répond à cette colonne : ni ce code externe, ni cette raison sociale. La correction est dans le fichier des clients, ou dans la cellule qui le nomme.",
  "imports.motif.site_introuvable":
    "Le client est reconnu, mais aucun de ses lieux d'intervention ne porte ce libellé. La correction est dans le fichier qui les décrit, ou dans la cellule qui le nomme.",
  "imports.motif.modele_introuvable":
    "Aucun modèle ne porte cette marque et cette référence. La correction est dans le fichier des modèles — et ceux-ci exigent eux-mêmes une famille.",
  // AJOUTÉ le 16/09/2026 : la famille est le parent des modèles et des
  // prestations, et le motif générique ne le disait pas (point 2 de la
  // session du 16/09/2026).
  "imports.motif.famille_introuvable":
    "Aucune famille ne porte ce code. La correction est dans le fichier des familles, ou dans la cellule qui le nomme.",
  // AJOUTÉ le 16/09/2026 (point 4b) : deux lignes du MÊME fichier désignent la
  // même fiche — jamais le parc, qui ne les connaît encore ni l'une ni
  // l'autre. La correction n'est donc pas au même endroit que « cle_ambigue ».
  "imports.motif.doublon_fichier":
    "Une autre ligne de ce même fichier désigne la même fiche : deux entrées ne peuvent pas être écrites pour une seule. La correction est dans le fichier — c'est ce doublon qu'il faut lever, avant même de consulter le parc.",
  // LES MOTIFS PROPRES À L'HISTORIQUE (REPRISE-HISTORIQUE). Chacun dit où
  // corriger — et le premier dit qu'il n'y a rien à corriger.
  "imports.motif.document_deja_repris":
    "Ce document a déjà été repris par un lot précédent : l'intervention existe, close, et un fait passé ne se réécrit pas. Il n'y a rien à corriger. Pour la reprendre autrement, annulez le lot qui l'a écrite.",
  // *Le mot imposé n'est PAS écrit ici* (D5, D47) : la colonne se désigne par
  // ce qu'elle porte — le lieu —, jamais par son en-tête.
  "imports.motif.site_indetermine":
    "Le client est reconnu, mais la ligne ne nomme aucun lieu et ce client en a plusieurs — ou aucun. La ligne ne peut pas dire où l'intervention a eu lieu : nommez le lieu dans la colonne qui le porte.",
  "imports.motif.montant_illisible":
    "Le montant doit être un nombre entier de francs, sans décimale ni séparateur de milliers — par exemple 12500. Laissez la cellule vide si le montant n'est pas connu.",
  "imports.motif.montant_devise":
    "La colonne des montants est en XPF, et cette société ne tient pas ses comptes en XPF : un montant ne se convertit jamais à l'import. Laissez la cellule vide, ou importez sans montant.",
  // L'ATTENTE DE RATTACHEMENT D'UN PV (VGP-IMPORT, arbitrage 3 du 22/09/2026).
  // Quatre motifs, et chacun commence par dire qu'il n'est PAS un refus : le
  // PV est retenu, et il rentrera par le fichier des rejets. *Le mot imposé
  // n'est pas écrit ici* (D5, D47) : la colonne se désigne par ce qu'elle porte.
  "imports.motif.a_rattacher_sans_serie":
    "En attente de rattachement — la ligne ne nomme aucun n° de série (« sans », « ? », « illisible »). Le PV est conservé dans ce lot et dans le fichier des rejets : quand la machine sera identifiée, renseignez la cellule et redéposez.",
  "imports.motif.a_rattacher_serie_inconnue":
    "En attente de rattachement — aucune machine du parc ne porte ce n° de série. Le PV est conservé : créez ou corrigez la machine, ou corrigez la cellule, puis redéposez le fichier des rejets.",
  "imports.motif.a_rattacher_serie_ambigue":
    "En attente de rattachement — plusieurs machines du parc portent ce n° de série et rien ne les départage. Nommez le client dans la colonne qui le porte, ou levez le doublon dans le parc, puis redéposez.",
  "imports.motif.a_rattacher_serie_autre_client":
    "En attente de rattachement — ce n° de série existe, mais chez un autre client que celui que la ligne nomme. Corrigez la cellule qui le nomme, ou le parc, puis redéposez.",
  // LES REFUS DU GABARIT DES OBSERVATIONS — et celui d'une origine inconnue.
  "imports.motif.rapport_introuvable":
    "Aucune vérification enregistrée ne porte cette référence de rapport. Importez d'abord le fichier des vérifications et appliquez-le ; les observations viennent après.",
  "imports.motif.rapport_ambigu":
    "Cette référence de rapport couvre plusieurs machines, et la ligne ne dit pas laquelle. Renseignez « Machine (n° de série) » sur cette ligne, puis redéposez.",
  "imports.motif.observation_deja_reprise":
    "Cette observation a déjà été reprise par un lot précédent — même rapport, même code. Il n'y a rien à corriger. Pour la reprendre autrement, annulez le lot qui l'a écrite.",
  "imports.motif.origine_inconnue":
    "La colonne « Origine » doit porter un des quatre codes : rapport_organisme, rapport_transmis_client, vignette_constatee ou declaration_client. La correction est dans le fichier.",

  // LE RATTACHEMENT DES MACHINES D'UN LOT D'HISTORIQUE — les trois rangs de
  // D127, comptés sur le rapport. *Aucun n'est un rejet* : une ligne non
  // rattachée entre quand même, et c'est tout le point (72 % mesurés).
  "imports.rattachement_titre": "Rattachement aux machines",
  "imports.rattachement_aide":
    "Chaque ligne qui entrera est comptée une fois. Une ligne non rattachée entre sans machine : ce n'est pas un rejet.",
  "imports.rattachement.sans_serie": "Sans n° de série",
  "imports.rattachement.sans_serie_detail":
    "l'intervention ne porte sur aucune machine nommée",
  "imports.rattachement.rang1": "Rang 1",
  "imports.rattachement.rang1_detail":
    "le n° de série désigne une seule machine du parc, chez ce client",
  "imports.rattachement.rang2": "Rang 2",
  "imports.rattachement.rang2_detail":
    "plusieurs machines portent ce n° de série, une seule chez ce client",
  "imports.rattachement.rang3": "Non rattachées",
  "imports.rattachement.rang3_detail":
    "entrent sans machine, avec leur motif ci-dessous",
  "imports.rattachement.colonne_serie": "N° de série lu",
  "imports.rattachement.aucune":
    "Toutes les lignes qui portent un n° de série ont trouvé leur machine.",
  "imports.rattachement.serie_inconnue":
    "Aucune machine du parc ne porte ce n° de série.",
  "imports.rattachement.serie_ambigue":
    "Plusieurs machines de ce client portent ce n° de série : la ligne ne désigne rien de sûr.",
  "imports.rattachement.serie_autre_client":
    "Ce n° de série existe, mais chez un autre client que celui de la ligne.",

  // LE RATTACHEMENT D'UN LOT DE VGP (VGP-IMPORT) — trois comptes, et la liste
  // de ce qui ATTEND. *Un PV en attente est compté parmi les rejets par la
  // base, et à part ici* : les deux sont dits, aucun n'est caché.
  "imports.vgp.titre": "Rattachement aux machines",
  "imports.vgp.aide":
    "Un PV sans machine identifiée est retenu en attente, avec son motif : il n'est ni perdu ni inventé. Il rentrera par le fichier des rejets, une fois la machine nommée.",
  "imports.vgp.rattachees": "Rattachées",
  "imports.vgp.rattachees_detail":
    "entreront dans le registre, chacune sous sa machine",
  "imports.vgp.en_attente": "En attente",
  "imports.vgp.en_attente_detail":
    "retenues sans machine, avec leur motif ci-dessous — la base les compte parmi les rejets",
  "imports.vgp.autres_rejets": "Autres rejets",
  "imports.vgp.autres_rejets_detail":
    "une date, une origine ou une saisie que le fichier doit corriger",
  "imports.vgp.aucune_attente": "Chaque PV a trouvé sa machine.",
  "imports.vgp.attente.sans_serie": "Aucun n° de série sur la ligne.",
  "imports.vgp.attente.serie_inconnue":
    "Aucune machine du parc ne porte ce n° de série.",
  "imports.vgp.attente.serie_ambigue":
    "Plusieurs machines portent ce n° de série : rien ne les départage.",
  "imports.vgp.attente.serie_autre_client":
    "Ce n° de série existe, mais chez un autre client que celui de la ligne.",

  // LES REFUS DE L'ÉCRAN. Un téléversement qui n'aboutit pas, et les trois états
  // d'un lot qu'on ne peut plus toucher.
  "imports.refus.absent": "Aucun fichier n'a été joint.",
  "imports.refus.vide": "Ce fichier est vide.",
  "imports.refus.extension":
    "Seuls les fichiers .xlsx sont lus. Un CSV n'a ni type de cellule ni feuille, et tout le contrôle repose sur les deux.",
  "imports.refus.trop_gros":
    "Ce fichier est trop volumineux pour être un classeur de reprise. Vérifiez qu'il s'agit bien du bon fichier.",
  "imports.refus.sans_feuille": "Ce classeur ne porte aucune feuille.",
  "imports.refus.illisible": "Ce fichier n'a pas pu être lu.",
  "imports.refus.lot_introuvable":
    "Ce lot n'existe pas, ou il n'appartient pas à la société active.",
  "imports.refus.lot_deja_applique": "Ce lot a déjà été appliqué.",
  "imports.refus.lot_annule": "Ce lot a été annulé : il ne se rejoue pas.",
  "imports.refus.lot_non_applique":
    "Ce lot n'a jamais été appliqué : il n'y a rien à annuler.",
  "imports.refus.type_sans_application":
    "Ce type de fichier se contrôle mais ne s'écrit pas encore. Aucune fiche n'a été créée ni modifiée.",
  // AJOUTÉ le 16/09/2026 (point 4 de la session) : le filet qui suit le
  // contrôle des doublons intra-fichier — le parc a bougé entre le contrôle
  // et cette validation, par un autre lot appliqué entre-temps.
  "imports.refus.contrainte_violee":
    "L'application a rencontré une valeur qui existe déjà en base sur ce qui identifie une fiche de façon unique — par exemple une marque et une référence, ou un code. Rien n'a été appliqué : la transaction a été annulée dans son ensemble. Corrigez le doublon dans le fichier ou dans le parc, puis revalidez ce lot.",
  // AJOUTÉ le 16/09/2026 (session dépassement de délai, point 3) : même geste
  // que `contrainte_violee`, pour un lot trop lourd plutôt qu'un doublon —
  // voir `DELAIS_APPLICATION`, `lib/imports/delais.ts`.
  "imports.refus.delai_depasse":
    "L'application de ce lot a dépassé le délai autorisé. Rien n'a été appliqué : la transaction a été annulée dans son ensemble, exactement comme si elle n'avait jamais commencé. Ce lot reste trop lourd pour une seule application ; contactez le support si le fichier est d'un usage courant.",

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

  // ── L'ÉCRAN « INTERVENTIONS » (N-01, 16/09/2026) ─────────────────────────
  //
  // La liste elle-même, canonique — le planning en montre un CALENDRIER,
  // celle-ci en montre le REGISTRE : la plus récente en tête, chaque ligne
  // menant à sa fiche par son numéro affiché, jamais par l'identifiant
  // technique (I10).
  "interventions.titre": "Interventions",
  "interventions.sous_titre":
    "Le registre des interventions de la société, la plus récente en tête.",
  "interventions.vide": "Aucune intervention enregistrée.",
  // ── LA RECHERCHE, LES FILTRES ET LA PAGINATION (AT-07, 17/09/2026) ───────
  // Les quatre filtres que la maquette annonce pour cet écran : agence, type,
  // statut, période. Le texte cherche sur le client et le lieu — les
  // colonnes VISIBLES qui identifient une ligne. Le LIBELLÉ n'annonce pas la
  // référence (AT-07 bis, 18/09/2026) : seule sa moitié « `numero` » se
  // cherche (voir `numeroDeReference`, `lib/interventions/depot.ts`), et
  // `numero` vaut `null` pour toute intervention avant la synchronisation
  // (lot 3) — l'annoncer promettrait, pour la référence RÉELLEMENT affichée
  // aujourd'hui (`Local-XXXXXX`), une recherche qui ne trouve rien.
  "interventions.recherche": "Client ou lieu",
  "interventions.rechercher": "Rechercher",
  "interventions.filtre_toutes_prefixe": "Toutes les",
  "interventions.filtre_type_tous": "Tous les types",
  "interventions.filtre_statut_tous": "Tous les statuts",
  // LE FILTRE POSÉ PAR LE LIEN DE LA TUILE « INTERVENTIONS SANS DURÉE »
  // (AFFICHAGE-MATERIEL-1, 23/09/2026) — même critère que la tuile,
  // `criteresSansDureeAVenir` (`lib/interventions/depot.ts`).
  "interventions.filtre_sans_duree_a_venir":
    "Filtre actif : interventions à venir, sans durée prévue.",
  // ── LES TROIS KPI DU BANDEAU — GAP COMBLÉ (audit du 18/09/2026) ──────────
  // `interventions()` de la maquette en pose trois ; voir `kpiDuRegistre`
  // (`app/(back-office)/interventions/page.tsx`) pour ce que chacun compte
  // RÉELLEMENT — jamais les valeurs illustratives de la maquette (27, 2, 5).
  "interventions.kpi_semaine": "Planifiées cette semaine",
  "interventions.kpi_en_cours": "En cours",
  "interventions.kpi_en_attente": "En attente",
  "interventions.filtre_periode_du": "Depuis le",
  "interventions.filtre_periode_au": "Jusqu'au",
  // RG-PLA-08 (D129, 19/09/2026) : un client inactif ne s'affiche plus ici
  // par défaut — cette case est le seul moyen de le revoir depuis ce
  // registre, sans quoi son historique deviendrait inatteignable ici.
  "interventions.filtre_inclure_clients_inactifs":
    "Inclure les clients inactifs",
  // LE FILTRE TECHNICIEN (57-REGISTRE-2) — « qu'a-t-il sur les bras ? », la
  // question la plus courante du bureau, qui n'avait pas de réponse ici.
  "interventions.filtre_technicien_tous": "Tous les techniciens",
  "interventions.filtre_technicien_non_affectees": "Non affectées",

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
  // ── AU-DELÀ DE 100 %, ET C'EST LE SEUL CAS QUI DEMANDE UNE ACTION ────────
  //
  // La décision est ancienne et elle est confirmée : *le taux se dit, il ne se
  // plafonne pas* — plafonner masquerait précisément ce qu'un planificateur
  // doit voir. Mais elle n'était écrite QUE dans le commentaire de
  // `lib/interventions/statistiques.ts`, c'est-à-dire **partout sauf là où le
  // chiffre s'affiche** : le planificateur qui lit « 125 % » n'a aucun moyen de
  // savoir si c'est un fait ou un défaut de calcul.
  //
  // *Une décision qui ne vit que dans le code est une décision que son
  // destinataire ne connaît pas.* La mention n'apparaît QUE lorsque le
  // dépassement a lieu : une note permanente sur un taux de 18 % serait du
  // bruit, et un avertissement qu'on lit tous les jours cesse d'être lu
  // (§9, 11/09).
  "statistiques.taux_au_dela":
    "au-del\u00e0 de 100\u00a0%\u00a0: la charge d\u00e9passe les heures d'ouverture de l'\u00e9tablissement. Ce n'est pas une erreur de calcul.",
  // LE SÉPARATEUR N'APPARTIENT À AUCUN ÉCRAN — il s'appelait
  // `statistiques.separateur`, et la fiche d'intervention en a eu besoin le
  // jour où elle a affiché « CACES — bloquante » (L3-02). *Une clé nommée
  // d'après son premier appelant devient fausse au second*, et la pente
  // suivante est d'en écrire une deuxième qui dit la même chose.
  "ponctuation.separateur": " — ",
  // LE POINT MÉDIAN — mesuré dans `docs/maquette/codiplan-maquette-complete.html`
  // (N-08, 18/09/2026) : « CLI-000184 · Nouméa », jamais un tiret cadratin.
  // **Ce n'est pas le même signe que `ponctuation.separateur` pour la même
  // raison** : la maquette réserve le point médian au couple identifiant ·
  // lieu (`entity-card`), et garde le tiret pour un couple label — valeur
  // ailleurs. Deux relations, deux signes mesurés séparément — les confondre
  // sous une seule clé ferait dire à l'une ce qu'elle n'a jamais montré pour
  // l'autre.
  "ponctuation.point_median": " · ",
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
  // Chantier INT-MACHINE 2 (20/09/2026) : le champ machine de la création, et
  // le rattachement après coup depuis la fiche — même liste, même texte pour
  // « aucune machine à ce site », qu'elle vienne du formulaire client
  // (chantier 2.1) ou du mini-formulaire de la fiche (chantier 2.2).
  "intervention.machine.aucune_au_site":
    "Aucune machine n'est déclarée pour ce lieu d'intervention.",
  "intervention.machine.ajouter_titre": "Ajouter une machine",
  "intervention.machine.ajouter_action": "Ajouter",
  // L'OPTION VIDE DU SÉLECTEUR DE MACHINE (PARCOURS-1) — distincte de
  // `intervention.machine.aucune_au_site`, qui dit qu'AUCUNE machine
  // n'existe pour ce lieu : celle-ci dit qu'on n'en choisit AUCUNE, ce qui
  // reste le cas ordinaire même quand le site en propose.
  "intervention.machine.aucune_choisie":
    "Aucune machine (dépannage à l'aveugle)",
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
  // RG-PLA-08 À LA CRÉATION (PLANNING-1, 22/09/2026). Le motif NOMME le
  // client inactif plutôt que d'accuser le périmètre : le lieu existe, il se
  // voit sur la fiche du client (D129), et « lieu inconnu » enverrait chercher
  // la cause au mauvais endroit. Ce qu'il DIT ensuite est ce que la règle
  // implique — une intervention qui ne paraîtrait nulle part.
  "intervention.refus.client_inactif":
    "Ce client est inactif : une intervention créée chez lui n'apparaîtrait ni sur le planning ni dans le registre. La création est refusée.",
  // RG-PLA-06 (L3-04). **Le motif ne nomme ni la personne ni la période**, et
  // ce n'est pas de la pudeur : un refus est un canal d'information soumis au
  // cloisonnement comme une requête (D50). Qui planifie voit l'absence sur
  // l'écran des absences, où la politique décide ; le refus dit ce qui bloque
  // et la marche à suivre, il ne renseigne pas.
  "absence.refus.inconnue":
    "Ce blocage n'existe pas, ou il n'est pas dans votre périmètre.",
  "intervention.refus.absence":
    "L'agenda de ce technicien est bloqué à cette date. Le créneau est refusé.",
  // LE SÉLECTEUR LE DIT AVANT LE CHOIX (PLANNING-1, RG-PLA-06, 22/09/2026) —
  // suffixe d'une option du sélecteur « Affecter » de la fiche, SUIVI de la
  // date de l'intervention (`dateCivile`) : la fiche ne l'affiche nulle part
  // ailleurs, et « à cette date » y flotterait sans référent. Le refus
  // ci-dessus reste : l'option est proposée, elle renseigne, et c'est
  // toujours le dépôt qui tranche.
  "intervention.technicien_agenda_bloque_le": "agenda bloqué le",
  "intervention.refus.habilitation":
    "Ce technicien ne détient pas les habilitations exigées ici. L'affectation est refusée.",
  // Extension de la revue Codex de la PR #267 (20/09/2026) : le refus d'un
  // rôle sans `qualifier_affecter`, sur la fiche — jamais un champ vide, un
  // refus qui prend la place de toute l'action, comme pour un refus de statut.
  "intervention.refus.qualification_requise":
    "Votre rôle ne permet pas d'affecter un technicien à une intervention.",
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
  // ── LE COMPTE-RENDU DES COURRIELS DE PLANIFICATION (AVERTISSEMENTS-1) ──────
  //
  // Des CLÉS, jamais le motif technique d'`envoyerCourriel` — ce canal
  // traverse une redirection HTTP, donc une URL, donc un lien qui peut être
  // forgé (L1-02f, D50). La planification elle-même reste faite dans tous
  // les cas : ces phrases informent, elles n'interrompent rien.
  "intervention.avertissement.courriel_client_parti":
    "Le client a été prévenu par courriel.",
  "intervention.avertissement.courriel_client_non_parti":
    "Le courriel au client n'a pas pu être envoyé. La planification est faite quand même.",
  "intervention.avertissement.courriel_client_sans_destinataire":
    "Aucun donneur d'ordre avec une adresse électronique n'a été trouvé pour ce client : aucun courriel ne lui a été envoyé. La planification est faite quand même.",
  "intervention.avertissement.courriel_technicien_parti":
    "Le technicien a été prévenu par courriel.",
  "intervention.avertissement.courriel_technicien_non_parti":
    "Le courriel au technicien n'a pas pu être envoyé. La planification est faite quand même.",
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
  // FICHE-INTERVENTION-1, 23/09/2026 — REFORMULÉ : la phrase disait au
  // planificateur COMMENT le numéro s'attribue, jamais ce qu'il en pense
  // aujourd'hui. « Numéro provisoire » se lit sans jargon ; le mécanisme
  // reste écrit une fois, au chapitre 10, pas répété sur chaque fiche.
  "intervention.sans_numero": "Numéro provisoire",
  // LE PANNEAU QUI REGROUPE LES CINQ ACTIONS (FICHE-INTERVENTION-1) — un seul
  // titre, plutôt qu'un titre répété par bloc empilé.
  "intervention.actions.titre": "Actions",
  // LE RETOUR MÈNE À L'ÉCRAN D'ORIGINE (FICHE-INTERVENTION-1) — `retourFiche`
  // et `libelleRetourFiche` de `../presentation.ts` composent ces clés selon
  // `?depuis=`. « planning » réutilise `planning.retour_fleche`, déjà écrite.
  "intervention.retour.interventions": "← Retour aux interventions",
  "intervention.retour.client": "← Retour au client",
  "intervention.retour.site_prefixe": "← Retour au",
  "intervention.retour.machine": "← Retour à la machine",

  "intervention.action.affecter": "Affecter un technicien",
  "intervention.action.deplacer": "Déplacer",
  "intervention.action.planifier": "Planifier",
  "intervention.action.cloturer": "Clôturer",
  "intervention.action.annuler": "Annuler l'intervention",
  "intervention.action.creer": "Créer",

  // ── LA CRÉATION, EN DEUX GESTES (PARCOURS-1, 23/09/2026, arbitrage Alexis) ──
  //
  // *« Lors de la création d'intervention, on ne peut pas décider ni de la
  // date d'intervention, ni du technicien affecté : il doit y avoir un ordre
  // précis — Créer demande d'intervention → Planifier et qualifier
  // l'intervention. »* CRÉER ne porte plus ni date ni technicien ; PLANIFIER
  // exige les quatre valeurs — date, heure, durée, technicien — ensemble.
  "intervention.panne_signalee": "Panne signalée / travail demandé",
  "intervention.contact_sur_place": "Contact sur place",
  "intervention.aucun_contact": "Aucun contact désigné",
  "intervention.reference_client": "Référence client / n° de bon de commande",
  "intervention.refus.panne_manquante":
    "La panne signalée ou le travail demandé est obligatoire.",
  "intervention.planification.explication":
    "Les quatre valeurs — date, heure, durée prévue et technicien — se donnent ensemble : une intervention ne passe au planning qu'avec les quatre.",
  "intervention.refus.planification_date_manquante":
    "La date est obligatoire pour planifier cette intervention.",
  "intervention.refus.planification_duree_manquante":
    "L'heure de début et la durée prévue sont obligatoires pour planifier cette intervention.",
  "intervention.refus.planification_technicien_manquant":
    "Le technicien est obligatoire pour planifier cette intervention.",
  // UNE MACHINE AU PLUS (PARCOURS-1) — « Ajouter une machine » refuse une
  // SECONDE machine, nommée avant même la contrainte de base, dont le
  // message serait technique.
  "intervention.refus.machine_deja_presente":
    "Cette intervention porte déjà une machine. Une intervention ne peut pas en porter deux.",

  "intervention.cloture.temps_mesure": "Temps mesuré par le compteur",
  "intervention.cloture.temps_valide": "Temps validé (minutes)",
  "intervention.cloture.sans_compteur": "Aucun compteur n'a tourné",
  "intervention.cloture.arrondi": "Arrondi au quart d'heure supérieur",
  "intervention.cloture.plancher": "Plancher d'une heure appliqué",
  "intervention.cloture.facture": "Temps facturé",
  "intervention.cloture.taux": "Taux horaire en vigueur à cette date",
  "intervention.cloture.main_doeuvre": "Main-d'œuvre",
  "intervention.cloture.forfait_deplacement": "Forfait de déplacement",
  "intervention.cloture.total": "Total hors taxes",

  // LA VALORISATION N'EST PAS MONTRÉE À TOUT LE MONDE (D37, arbitrage 3.8).
  // Le bloc ne DISPARAÎT pas : il est remplacé par son motif, comme un refus
  // d'action l'est sur cet écran — *un bloc absent se lirait « il n'y a pas de
  // montant » là où il faut lire « ce n'est pas pour vous »* (le motif de D88).
  "intervention.valorisation.sans_droit":
    "Votre rôle ne donne pas accès aux montants de vente.",
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
    "Aucun temps n'est validé : la main-d'œuvre ne peut pas être calculée.",
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
  // Chantier INT-MACHINE 2 (20/09/2026) : le rattachement après coup refuse
  // une machine d'un AUTRE site — même du même client — ou un identifiant
  // qui n'existe pas dans le périmètre courant. Les deux cas se disent pareil
  // (D50) : distinguer « autre site » d'« inexistante » renseignerait qui
  // saisit sur ce qui existe ailleurs.
  "intervention.refus.machine_invalide":
    "Cette machine n'appartient pas au lieu de l'intervention, ou elle n'est pas dans votre périmètre.",
  // LES DEUX REFUS TECHNIQUES (D-06, 17/09/2026) — distincts, parce que la
  // marche à suivre ne l'est pas : l'un se réessaie, l'autre demande de
  // regarder ailleurs qu'à l'écran. Ni l'un ni l'autre ne compte ni ne nomme
  // ce que l'appelant n'a pas le droit de lire (D50) — le motif technique
  // reste dans les journaux du serveur, jamais ici.
  "intervention.refus.erreur_serveur":
    "Une erreur est survenue pendant l'enregistrement. Rien n'a été modifié : réessayez.",
  "intervention.refus.connexion_interrompue":
    "La connexion a été interrompue avant la fin de l'enregistrement. Rien n'a été modifié : vérifiez votre réseau avant de réessayer.",
  "intervention.refus.annulee_figee":
    "Cette intervention est annulée : elle ne se modifie plus. Une annulation n'efface rien et ne se défait pas.",
  "intervention.refus.cloturee_figee":
    "Cette intervention est clôturée : elle ne se modifie plus sans trace. Seule son annulation reste possible.",
  "intervention.refus.deja_cloturee": "Cette intervention est déjà clôturée.",
  "intervention.refus.deja_annulee": "Cette intervention est déjà annulée.",
  "intervention.refus.temps_manquant":
    "Aucun temps n'a été mesuré sur cette intervention : le compteur du technicien est la seule source du temps. Une intervention sans compteur se traite dans Winpro au moment de facturer.",
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

  // ── LA RÉALISATION — DONNÉES RÉELLES DE LA FICHE (50-INTERVENTIONS-2) ────
  "intervention.realisation.titre": "Réalisation",
  "intervention.realisation.segments_titre": "Segments de travail",
  "intervention.realisation.aucun_segment":
    "Aucun segment de travail enregistré : le compteur n'a pas encore tourné.",
  "intervention.realisation.en_cours": "En cours",
  "intervention.realisation.temps_mesure": "Temps mesuré par le compteur",
  "intervention.realisation.temps_valide": "Temps validé",
  "intervention.realisation.valide_par": "Validé par",
  "intervention.realisation.valide_le": "Validé le",
  "intervention.realisation.prestations_titre": "Prestations réalisées",
  "intervention.realisation.aucune_prestation":
    "Aucune prestation déclarée réalisée.",
  "intervention.realisation.commentaire_technicien":
    "Commentaire du technicien",
  "intervention.realisation.suite_a_donner": "Suite à donner",
  "intervention.realisation.signature": "Signature du client",
  "intervention.realisation.signee_le": "Signée le",
  "intervention.realisation.aucune_signature": "Aucune signature",
  "intervention.realisation.cloturee_le": "Clôturée le",

  // ── LES PAUSES — L'HISTORIQUE, LA PLUS RÉCENTE EN TÊTE (50-INTERVENTIONS-2) ──
  "intervention.pauses.titre": "Pauses",
  "intervention.pauses.aucune": "Aucune pause enregistrée.",
  "intervention.pauses.en_cours": "En cours",
  "intervention.pauses.duree": "Durée",
  "intervention.pauses.motif": "Motif",
  "intervention.pauses.ouverte_par": "Ouverte par",
  "intervention.pauses.fermee_par": "Fermée par",
  "intervention.pauses.piece": "Pièce attendue",
  "intervention.pauses.dispo_prevue": "Disponibilité prévue",

  // ── LA CHRONOLOGIE — depuis les faits datés, jamais le journal d'audit
  // (50-INTERVENTIONS-2 : voir `chronologieDeLaFiche`, la lecture n'est pas
  // ouverte à tous les rôles qui consultent cette fiche) ────────────────────
  "intervention.chronologie.titre": "Chronologie",
  "intervention.chronologie.creation": "Créée",
  "intervention.chronologie.suspension": "Suspendue",
  "intervention.chronologie.reprise": "Reprise",
  "intervention.chronologie.cloture": "Clôturée",
  "intervention.chronologie.annulation": "Annulée",

  // ── LA NOTE INTERNE — BACK-OFFICE SEULEMENT (50-INTERVENTIONS-2) ─────────
  //
  // Régime INVERSE de `commentaire_technicien`/`suite_a_donner` : jamais sur
  // le terrain, le bon, le portail ou un courriel.
  "intervention.note_interne.titre": "Note interne",
  "intervention.note_interne.aide":
    "Visible et modifiable en interne seulement — jamais sur le terrain, le bon, le portail ou un courriel.",
  "intervention.note_interne.aucune": "Aucune note interne.",
  "intervention.note_interne.enregistrer": "Enregistrer la note",

  // ── LE BON D'INTERVENTION IMPRIMABLE (lot 16 BON-1, complété par BON-2) ──
  //
  // BON-1 rendait l'en-tête société, la machine, les segments de travail, le
  // taux, le forfait et le montant. BON-2 ajoute les cinq blocs alors
  // nommés : prestations réalisées, commentaire, suite à donner, photos,
  // signature — chacun affichant l'ABSENCE plutôt qu'un bloc vide (§9).
  "intervention.bon.titre": "Bon d'intervention",
  "intervention.bon.imprimer": "Imprimer le bon",
  "intervention.bon.refus.acces":
    "Votre rôle ne permet pas de consulter le bon de cette intervention.",
  // LE BON N'EXISTE QUE POUR UN TRAVAIL FAIT (AFFICHAGE-MATERIEL-1,
  // 23/09/2026) — *mesuré en production le 23/09/2026 : le lien « Bon
  // d'intervention » était proposé sur une intervention encore `planifiee`.*
  // `terminee` et `cloturee` sont les deux seuls statuts où le terrain a dit
  // avoir fini (`peutGenererLeBon`, `lib/interventions/cycle-de-vie.ts`).
  "intervention.bon.refus.non_terminee":
    "Le bon sera disponible une fois l'intervention terminée.",
  // « site » n'est pas écrit ici : le mot imposé se compose depuis
  // `mot`/`motDansUnePhrase`, jamais en dur (D5, D47, L0-11) — voir
  // `presentation.ts` du dossier des interventions pour les trois phrases qui
  // le composent.
  "intervention.bon.aucune_machine":
    "Aucune machine n'est rattachée à cette intervention : elle porte sur l'ensemble du",
  "intervention.bon.segments_titre": "Temps passé sur",
  "intervention.bon.segment_arrivee": "Arrivée",
  "intervention.bon.segment_depart": "Départ",
  "intervention.bon.segment_duree": "Durée",
  "intervention.bon.segment_technicien": "Technicien",
  "intervention.bon.segment_en_cours": "en cours",
  "intervention.bon.aucun_segment":
    "Aucun segment de travail n'est enregistré pour cette intervention.",
  "intervention.bon.temps_total": "Temps total sur",
  "intervention.bon.valorisation_titre": "Valorisation",
  // *Un taux qu'on ne peut plus reconstituer efface le total avec lui* : voir
  // l'entête de `lib/interventions/bon.ts`. La phrase ne parle pas de
  // clôture — contrairement à `intervention.refus.taux_absent` — puisqu'on
  // est ici après coup, en train de consulter, jamais en train de clôturer.
  "intervention.bon.taux_absent":
    "Aucun taux horaire n'est en vigueur à la date de cette intervention : le montant ne peut pas être établi.",

  // ── LES CINQ BLOCS DE BON-2 ──────────────────────────────────────────────
  "intervention.bon.prestations_titre": "Prestations réalisées",
  "intervention.bon.aucune_prestation":
    "Aucune prestation n'a été déclarée réalisée.",
  "intervention.bon.commentaire_titre": "Commentaire du technicien",
  "intervention.bon.aucun_commentaire": "Aucun commentaire n'a été saisi.",
  "intervention.bon.suite_titre": "Suite à donner",
  "intervention.bon.aucune_suite": "Aucune suite à donner n'a été saisie.",
  "intervention.bon.photos_titre": "Photos",
  "intervention.bon.aucune_photo": "Aucune photo n'a été prise.",
  "intervention.bon.signature_titre": "Signature du client",
  "intervention.bon.aucune_signature": "Aucune signature n'a été recueillie.",
  "intervention.bon.signature_le": "Signé le",

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
  "demande.cloture.motif_requis":
    "Choisissez un motif de clôture : sans lui, la fermeture ne se distingue pas d'un oubli.",

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

  // ── LA FILE DE QUALIFICATION ET LA FICHE (DEMANDES-1) — les deux écrans
  // que L2-06 nommait manquants restent manquants nulle part ailleurs : ce
  // ticket les écrit, et se sert des clés ci-dessus sans en redéfinir le
  // sens.
  "demandes.sous_titre":
    "Les demandes ouvertes, de la plus ancienne à la plus récente.",
  "demandes.vide":
    "Aucune demande en attente de qualification : la file est à jour.",
  "demandes.retour": "← Toutes les demandes",
  "demande.colonne_statut": "Statut",
  "demande.colonne_deposee_le": "Déposée le",
  "demande.sans_interlocuteur": "Aucun interlocuteur renseigné.",
  "demande.sans_valeur": "—",
  "demande.machine_arretee_oui": "Oui, à l'arrêt",
  // « Transformer » pose SEULEMENT le statut — `marquerTransformee` ne crée
  // aucune intervention (son propre en-tête le dit). Le lien mène au geste
  // humain qui planifie réellement.
  "demande.transformer.note":
    "Cette action marque la demande transformée ; elle ne crée pas l'intervention. Créez-la depuis le lien ci-dessous, avant ou après avoir marqué cette demande transformée.",
  "demande.transformer.creer_intervention": "Créer l'intervention →",

  // ── Fixtures de l'épreuve DEMANDES-1, au dictionnaire pour le gardien de
  // L0-11 (même discipline que `contacts.e2e.*`) : un texte que l'épreuve
  // fait ensuite lire à l'écran passe par ici, jamais par un littéral du
  // fichier de scénario.
  "demandes.e2e.description_ancienne":
    "Fuite hydraulique constatée (épreuve DEMANDES-1)",
  "demandes.e2e.description_recente":
    "Bruit anormal au démarrage (épreuve DEMANDES-1)",
  // Le même refus qu'ailleurs sur cette fiche — un rôle sans `creer_demande`
  // (arbitrage du ticket : la même capacité que la création d'une
  // intervention) voit ce motif à la place de CHAQUE action, jamais un
  // formulaire qu'il ne peut pas soumettre.
  "demande.refus.capacite_requise":
    "Votre rôle ne permet pas d'agir sur cette demande.",

  // ── L'APPLICATION DU TECHNICIEN (R5-01, L3-08) ───────────────────────────
  "terrain.titre": "Ma journée",
  "terrain.aujourdhui": "Aujourd'hui",
  "terrain.sans_date": "Affectées, sans date",
  // LE BADGE « NOUVEAU » (AVERTISSEMENTS-1) — posé tant que
  // `intervention.vue_technicien_le` est nul ; s'efface à l'ouverture de la
  // fiche par le technicien affecté, et par lui seul.
  "terrain.badge_nouveau": "Nouveau",
  "terrain.rien_aujourdhui": "Aucune intervention.",
  "terrain.sans_creneau": "Sans horaire",
  "terrain.retour": "← Retour à ma journée",
  "terrain.date": "Date",
  "terrain.inconnu": "—",
  "terrain.client_inconnu": "Client",
  "terrain.compteur": "Compteur",
  "terrain.compteur.ferme": "Temps mesuré, hors compteur en cours.",
  "terrain.compteur.tourne": "Le compteur tourne.",
  "terrain.compteur.demarrer": "Démarrer l'intervention",
  "terrain.compteur.pause": "Mettre en pause",
  "terrain.compteur.ailleurs":
    "Votre compteur tourne déjà sur une autre intervention. Mettez-le en pause avant d'en démarrer un autre.",
  "terrain.compteur.aller": "Ouvrir cette intervention",
  "terrain.heures": "h",
  "terrain.minutes": "min",

  // ── LE RAPPORT DE TERRAIN (ticket 17-BON-2) ──────────────────────────────
  "terrain.rapport.titre": "Rapport",
  "terrain.rapport.commentaire_libelle": "Commentaire",
  "terrain.rapport.commentaire_placeholder": "Ce qui a été constaté ou fait…",
  "terrain.rapport.suite_libelle": "Suite à donner",
  "terrain.rapport.suite_placeholder":
    "Ce qu'il reste à faire ou à surveiller…",
  "terrain.rapport.enregistrer": "Enregistrer le rapport",
  "terrain.rapport.enregistre": "Rapport enregistré.",
  "terrain.rapport.refus": "Le rapport n'a pas pu être enregistré. Réessayez.",

  "terrain.prestations.titre": "Prestations réalisées",
  "terrain.prestations.aucune":
    "Aucune prestation n'est définie dans le catalogue de votre société.",
  "terrain.prestations.enregistrer": "Enregistrer les prestations",
  "terrain.prestations.enregistre": "Prestations enregistrées.",
  "terrain.prestations.refus":
    "Les prestations n'ont pas pu être enregistrées. Réessayez.",

  "terrain.photos.titre": "Photos",
  "terrain.photos.aucune": "Aucune photo n'a été prise.",
  "terrain.photos.libelle": "Légende",
  "terrain.photos.libelle_placeholder": "Avant intervention…",
  "terrain.photos.ajouter": "Ajouter une photo",
  "terrain.photos.refus": "La photo n'a pas pu être ajoutée. Réessayez.",
  "terrain.photos.refus_type": "Seules les images sont acceptées (JPEG, PNG).",

  "terrain.signature.titre": "Signature du client",
  "terrain.signature.deja_signee":
    "Une signature a déjà été recueillie. Une nouvelle signature s'ajoute à l'ancienne, qui reste conservée.",
  "terrain.signature.effacer": "Effacer",
  "terrain.signature.enregistrer": "Enregistrer la signature",
  "terrain.signature.enregistre": "Signature enregistrée.",
  "terrain.signature.refus":
    "La signature n'a pas pu être enregistrée. Recommencez le tracé.",
  "terrain.signature.vide":
    "Rien n'a été tracé : signez dans le cadre avant d'enregistrer.",
  "compteur.refus.deja_en_cours":
    "Un compteur tourne déjà. Mettez-le en pause avant d'en démarrer un autre.",
  "compteur.refus.aucun_en_cours":
    "Aucun compteur ne tourne : il n'y a rien à mettre en pause.",
  "compteur.refus.fin_avant_debut":
    "L'heure d'arrêt précède l'heure de départ. Vérifiez l'heure de l'appareil.",
  "compteur.refus.suspendue":
    "Cette intervention est suspendue : reprenez-la avant de démarrer le compteur.",
  "compteur.refus.introuvable": "Cette intervention est introuvable.",
  "compteur.refus.geste_inconnu":
    "Ce geste n'est pas reconnu. Revenez à l'intervention et réessayez.",
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
  // ARBITRAGE D128 (18/09/2026) — la nature du forfait, exposée en colonne à
  // côté du regroupement qu'elle sert déjà (voir `Nature` dans forfaits/page.tsx).
  "parametres.forfaits_categorie": "Catégorie",
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

  // ── LA SUCCESSION D'UN TAUX HORAIRE (TAUX-1) ────────────────────────────
  //
  // Le taux horaire n'avait qu'un seul chemin d'écriture — le geste de mise
  // en service, qui refuse dès qu'une société porte déjà un taux. Un tarif
  // qui change (hausse, correction) n'avait nulle part où aller.
  "taux_horaire.titre": "Taux horaire",
  "taux_horaire.sous_titre":
    "Le taux horaire de main-d'œuvre, et son historique. Un taux ne se modifie jamais : il se succède, à une date d'effet, sans changer aucune intervention déjà valorisée.",
  "taux_horaire.historique_date_effet": "Date d'effet",
  "taux_horaire.historique_montant": "Montant",
  "taux_horaire.historique_statut": "Statut",
  "taux_horaire.en_vigueur": "En vigueur aujourd'hui",
  "taux_horaire.vide":
    "Aucun taux horaire n'est encore réglé. Aucune intervention ne peut être valorisée tant qu'aucun n'existe.",
  "taux_horaire.poser": "Poser un nouveau taux",
  "taux_horaire.champ.montant": "Montant, en unités mineures",
  "taux_horaire.champ.date_effet": "Date d'effet",
  "taux_horaire.continuer": "Continuer",
  "taux_horaire.confirmer.titre": "Confirmer le nouveau taux",
  "taux_horaire.confirmer.explication":
    "Ce taux s'appliquera à compter de la date d'effet indiquée, à toute intervention valorisée à partir de ce jour. Il ne change aucune intervention déjà valorisée.",
  "taux_horaire.confirmer.montant": "Montant",
  "taux_horaire.confirmer.date_effet": "Date d'effet",
  "taux_horaire.confirmer.confirmer": "Confirmer et enregistrer",
  "taux_horaire.confirmer.annuler": "Annuler",
  "taux_horaire.refus.saisie":
    "La saisie est refusée : vérifier le montant (entier strictement positif, en unités mineures) et la date d'effet (AAAA-MM-JJ).",
  "taux_horaire.refus.montant_invalide":
    "Le montant doit être strictement positif : un taux à zéro se lirait « gratuit ».",
  "taux_horaire.refus.date_deja_utilisee":
    "Un taux porte déjà cette date d'effet. Deux taux ne peuvent pas partager le même jour : choisir une autre date d'effet.",
  "taux_horaire.refus.societe_introuvable":
    "Cette société est introuvable : le taux ne peut pas être posé.",

  // ── Le paramétrage d'ouverture (lot 2, I7) ────────────────────────────────
  //
  // « Agence » et « site » ne s'écrivent pas ici : le code nomme la notion.
  "parametres.titre": "Réglage des horaires d'ouverture",
  // ── CE SOUS-TITRE PROMETTAIT TROIS RÉGLAGES ET N'EN PORTE QU'UN (14/09/2026)
  //
  // Il annonçait « les jours travaillés, les horaires et le pas des créneaux ».
  // *Mesuré à l'écran : le seul formulaire de la ligne est « Enregistrer le
  // pas ».* Les jours et les plages s'AFFICHENT et ne se règlent nulle part —
  // ni ici, ni ailleurs dans l'application.
  //
  // Un écran qui promet plus qu'il ne rend fait chercher un formulaire qui
  // n'existe pas, puis douter de ce qu'on a sous les yeux. *« On ne sait pas
  // encore le faire » et « je ne trouve pas le bouton » ne se corrigent pas au
  // même endroit* — le motif de D88, appliqué à une promesse plutôt qu'à une
  // mesure. Le réglage manquant est un ticket (R3-13), pas une phrase.
  // ── ET LE RÉGLAGE MANQUANT A ÉTÉ LIVRÉ (R3-13, 14/09/2026) ──────────────
  //
  // Le sous-titre disait « ils se règlent encore en base », ce qui était exact
  // et qui ne l'est plus : les plages se règlent depuis l'écran de détail d'un
  // calendrier, et le pas depuis la ligne. *Une promesse corrigée se recorrige
  // le jour où elle devient vraie* — la laisser aurait fait chercher une console
  // à qui avait le formulaire sous les yeux.
  "parametres.sous_titre":
    "Ce que chaque établissement ouvre aujourd'hui. Le pas des créneaux se règle dans la ligne ; les jours travaillés et les horaires se règlent sur la fiche de chaque calendrier.",
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
  // ── L'ÉCRAN « PARC MACHINES » (R2-21 ; réécrit N-10, D125) ──────────────
  // LE TITRE EST CELUI DE `head()` DANS `parc()` — « Parc machines », sans
  // « clients » : `codiplan-maquette-complete.html` fait foi sur ce point
  // depuis D125, elle a été RELUE au moment du ticket, jamais recopiée d'une
  // mémoire de l'ancienne maquette.
  "parc.titre": "Parc machines",
  // LE SOUS-TITRE EST CELUI DE LA MAQUETTE, MOT POUR MOT — elle ne cite plus
  // « site » depuis N-10, si bien qu'aucune composition par
  // `motDansUnePhrase` n'est plus nécessaire ici (D5, D47 restent respectés :
  // le mot n'apparaît simplement plus dans cette phrase).
  "parc.sous_titre":
    "Recherche sur l’identifiant, le numéro de série, la désignation et le client.",
  "parc.recherche_champ":
    "Rechercher un identifiant, un numéro de série, une désignation ou un client",
  "parc.recherche_action": "Rechercher",
  "parc.filtre_statut.libelle": "Filtrer par statut",
  "parc.filtre_statut.tous": "Tous les statuts",
  // LISTES-1 (23/09/2026) — trois filtres COMBINABLES de plus, à la demande
  // d'Alexis : « il faudrait des filtres : clients, sites, famille, statut ».
  // Le mot imposé ne s'écrit PAS ici pour « site » : « parc.filtre_client.libelle »
  // et « parc.filtre_client.tous » nomment le CLIENT, jamais le site, qui se
  // compose depuis `mot("site")`.
  "parc.filtre_client.libelle": "Filtrer par client",
  "parc.filtre_client.tous": "Tous les clients",
  "parc.filtre_site.tous": "Tous les lieux",
  "parc.filtre_famille.tous": "Toutes les familles",
  "parc.reinitialiser": "Réinitialiser",
  "parc.total": "machines",
  // LE SINGULIER EST UNE CLÉ, jamais un « s » retranché : « 1 fiches à
  // compléter » a été lu SUR UNE IMAGE le 13/09/2026, et aucune assertion ne
  // pouvait le dire — le cas n'existe que sur un parc qui porte exactement une
  // fiche incomplète.
  "parc.total_un": "machine",
  "parc.incompletes": "fiches à compléter",
  "parc.incompletes_un": "fiche à compléter",
  "parc.a_completer": "À compléter",
  "parc.famille": "Famille",
  // LES QUATRE CLÉS QUI SUIVENT NE SERVENT PLUS QUE LA FICHE MACHINE
  // (`app/(back-office)/parc/[id]/page.tsx`, N-11) : la liste elle-même est
  // devenue un maître-détail (N-10, D125) et ne rend plus de `<th>`. Ce
  // ticket ne touche pas la fiche — « une proposition à la fois » — donc ces
  // quatre clés restent, à l'identique.
  "parc.colonne_serie": "N° de série",
  "parc.colonne_lieu": "Client / lieu",
  "parc.colonne_mise_en_service": "Mise en service",
  "parc.colonne_statut": "Statut",
  // ── LES TROIS KPI DU BANDEAU — libellés de `parc()`, mesurés N-10 (D125) ──
  "parc.kpi_affichees": "Machines affichées",
  "parc.kpi_garantie": "Garanties < 90 jours",
  "parc.kpi_en_panne": "En panne ou arrêtées",
  "parc.kpi_sur": "sur",
  "parc.kpi_affichees_total": "au total",
  "parc.kpi_en_panne_detail_panne": "en panne",
  // Accordé via `decompte()` depuis le lot AV-14 (19/09/2026) — « 1 arrêtées »
  // était l'un des cinq pluriels invariants mesurés à demeure.
  // `kpi_en_panne_detail_panne` ci-dessus reste invariant : « en panne » ne
  // s'accorde pas.
  "parc.kpi_en_panne_detail_arretee_un": "arrêtée",
  "parc.kpi_en_panne_detail_arretees": "arrêtées",
  // LE DÉCOMPTE QUI OCCUPAIT L'EN-TÊTE (§1 du ticket N-10) — « quitte
  // l'en-tête, devient le détail du premier KPI » : la maquette n'y place que
  // des boutons, tous deux des écarts nommés ici (lib/machines/
  // ecarts-maquette.ts), et ce nombre n'avait donc plus sa place là.
  // ── LE MAÎTRE-DÉTAIL (N-10, D125) ────────────────────────────────────────
  "parc.resultats": "Résultats",
  "parc.fiche_complete": "Fiche complète",
  "parc.derniers_evenements": "Derniers événements",
  "parc.aucun_evenement": "Aucun événement enregistré pour cette machine.",
  // « Site » et « Agence » sont IMPOSÉS (D5, D47) : leurs libellés se
  // composent depuis `mot("site")`/`mot("agence")` dans la page, jamais ici
  // — voir `lib/machines/ecarts-maquette.ts` pour la même règle déjà
  // appliquée à l'ancienne colonne « Client / lieu ».
  "parc.kv_client": "Client",
  "parc.kv_serie": "N° de série",
  "parc.kv_famille": "Famille",
  "parc.kv_agence_suffixe": "CODIMA",
  "parc.kv_contrat": "Contrat",
  // LE SYMBOLE DE `.machine-symbol` — une seule lettre, décorative, mais
  // visible à l'écran : elle passe par le dictionnaire comme tout le reste
  // (L0-11), pas parce qu'elle se traduirait un jour, mais parce que le
  // gardien des chaînes visibles ne peut pas distinguer un glyphe d'un mot.
  "parc.symbole_machine": "M",
  "parc.aucune_trouvee": "Aucune machine trouvée",
  "parc.aucune_trouvee_detail":
    "Modifiez la recherche ou réinitialisez les filtres.",
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
  // \u2500\u2500 LES SIX COLONNES DU TABLEAU, \u00c0 L'IDENTIQUE DE vgp() (D125) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  // Machine, Client, Dernier contr\u00f4le, \u00c9ch\u00e9ance, \u00c9tat, Action \u2014 la famille et
  // le r\u00e9gime ne disparaissent pas : ils deviennent la sous-ligne de la
  // machine et de l'\u00e9tat, comme `regimeExplique` le composait d\u00e9j\u00e0. Aucune
  // information n'est perdue, seule la disposition change.
  "vgp.colonne_machine": "Machine",
  "vgp.colonne_client": "Client",
  "vgp.colonne_dernier_controle": "Dernier contr\u00f4le",
  "vgp.colonne_etat": "État",
  "vgp.colonne_action": "Action",
  // ── ENREGISTRER UNE VÉRIFICATION (lot A5+A7, second temps) — l'action de
  // chaque ligne du registre mène ici ; la fiche machine reste atteignable
  // depuis le lien du numéro de série, dans la colonne « Machine ».
  "vgp.action_enregistrer": "Enregistrer",
  "vgp.verifier.titre": "Enregistrer une vérification",
  "vgp.verifier.retour": "‹ Retour au registre",
  "vgp.verifier.champ.date_verification": "Date de la vérification",
  "vgp.verifier.champ.organisme": "Organisme",
  "vgp.verifier.champ.reference_rapport": "Référence du rapport",
  "vgp.verifier.champ.origine": "Origine de l'information",
  // SANS DÉFAUT, à dessein (D114) : l'appelant DIT d'où vient l'information,
  // ou la saisie est refusée. L'option vide est désactivée, jamais choisie
  // silencieusement.
  "vgp.verifier.champ.origine_aucune": "Choisissez l'origine",
  "vgp.verifier.champ.observations": "Observations — une par ligne",
  "vgp.verifier.enregistrer": "Enregistrer",
  "vgp.verifier.refus.saisie":
    "La saisie est refusée : la date, l'organisme et l'origine de l'information sont obligatoires.",
  "vgp.verifier.refus.introuvable":
    "Cette machine n'est pas lisible sous la société active.",
  // LES QUATRE ORIGINES RATIFIÉES (D114) — valeur probante décroissante,
  // dans l'ordre où D114 les liste. Le libellé français n'est pas couvert par
  // tests/unit/docs/origines-vgp-ratifiees.test.ts (qui ne lit que le schéma
  // et l'arbitrage) : il peut se reformuler sans rouvrir l'arbitrage.
  "vgp.origine_saisie.rapport_organisme": "Rapport de l'organisme",
  "vgp.origine_saisie.rapport_transmis_client":
    "Rapport transmis par le client",
  "vgp.origine_saisie.vignette_constatee": "Vignette constatée",
  "vgp.origine_saisie.declaration_client": "Déclaration du client",
  "vgp.vide":
    "Aucune machine n'est enregistr\u00e9e pour cette soci\u00e9t\u00e9.",
  // R\u00c9\u00c9CRIT le 23/09/2026 (VISUEL-1) : la r\u00e9f\u00e9rence de ticket entre
  // parenth\u00e8ses ne disait rien \u00e0 l'exploitant qui la lisait \u00e0 l'\u00e9cran.
  "vgp.borne":
    "Les premi\u00e8res fiches du parc. La recherche et le filtre par \u00e9ch\u00e9ance ne sont pas encore disponibles.",
  // LE FILTRE `?etat=depassees` (TABLEAU-1, 23/09/2026) \u2014 que la tuile du
  // tableau de bord ouvre plut\u00f4t que le registre nu.
  "vgp.filtre_depassees_actif":
    "Filtr\u00e9 sur les \u00e9ch\u00e9ances d\u00e9pass\u00e9es.",
  "vgp.filtre_retirer": "Voir tout le registre",
  // \u2500\u2500 LES QUATRE KPI DU BANDEAU (D125) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  // La maquette \u00e9crit \u00ab Conformes \u00bb au troisi\u00e8me \u2014 CODIPLAN n'affirme jamais
  // la conformit\u00e9 (L9-02, D88, D114) : le compte ici est celui des machines
  // dont une information a \u00e9t\u00e9 RE\u00c7UE, jamais un verdict. Voir
  // tests/unit/ui/lot-a5-a7.test.ts, qui nomme cet \u00e9cart.
  // Aucune fen\u00eatre de jours (\u00ab sous 30 jours \u00bb de la maquette) n'est fix\u00e9e
  // ici : rien, ni le chapitre 10 ni docs/arbitrages.md, n'a r\u00e9gl\u00e9 ce d\u00e9lai,
  // et l'inventer serait la faute que \u00a78 du CLAUDE.md interdit. Voir
  // lib/vgp/registre.ts, \u00ab AUCUNE FEN\u00caTRE DE JOURS N'EST INVENT\u00c9E ICI \u00bb.
  "vgp.kpi_echeance_a_venir": "\u00c9ch\u00e9ances \u00e0 venir",
  "vgp.kpi_echeance_a_venir_detail":
    "Une \u00e9ch\u00e9ance d\u00e9clar\u00e9e est connue et n'est pas encore pass\u00e9e.",
  "vgp.kpi_en_retard": "\u00c9ch\u00e9ances d\u00e9pass\u00e9es",
  "vgp.kpi_en_retard_detail":
    "Une date d\u00e9clar\u00e9e est d\u00e9pass\u00e9e \u2014 une date, jamais un verdict de conformit\u00e9.",
  "vgp.kpi_informations_recues": "Informations re\u00e7ues",
  "vgp.kpi_informations_recues_detail":
    "Ce que les clients nous ont transmis, quelle que soit l'\u00e9ch\u00e9ance.",
  "vgp.kpi_a_determiner_detail":
    "Machines dont la famille attend d'\u00eatre qualifi\u00e9e.",
  // \u2500\u2500 ARBITRAGE D128 : LE BADGE D'\u00c9TAT NE PORTE QUE LA CAT\u00c9GORIE, JAMAIS UNE
  // PHRASE ENTI\u00c8RE \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  // C'est la correction du d\u00e9bordement mesur\u00e9 \u00e0 1280 px : la phrase longue de
  // `vgp.information.depuis_inconnu` (79 caract\u00e8res, sans point de rupture
  // avant la fin) for\u00e7ait le tableau \u00e0 s'\u00e9largir plut\u00f4t qu'\u00e0 envelopper le
  // texte. Ces deux cl\u00e9s composent une sous-ligne courte \u00e0 la place \u2014 la date
  // reste dite, jamais un tiret (D88), mais jamais non plus une phrase enti\u00e8re
  // dans une cellule dense.
  "vgp.etat_ligne.depuis_le": "Depuis le",
  "vgp.etat_ligne.depuis_inconnu": "Depuis une date inconnue",
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
  // LE BADGE DU RETARD (VGP-2, 22/09/2026) — une information reçue dont
  // l'échéance déduite est PASSÉE. Mesuré sur d9c9446 : la ligne portait
  // « Information reçue » en vert, le même badge qu'une machine à échéance
  // lointaine. « Dépassée » dit qu'une date est passée, jamais « en retard »
  // ni « non conforme » (D88) — le même mot que `vgp.echeance.depassee`.
  "vgp.information.recue_echeance_depassee": "Échéance dépassée",
  "vgp.information.depuis_inconnu":
    "sans information, et sans date de mise en service pour dire depuis quand",
  // L'ÉCHÉANCE DÉDUITE (R3-11) — une DATE, jamais un verdict. « Dépassée »
  // dit qu'une date déclarée est passée ; il ne dit ni « non conforme », ni
  // « en règle » — CODIPLAN n'affirme jamais la conformité (D88).
  "vgp.colonne_echeance": "Échéance déduite",
  "vgp.echeance.declaree": "Prochaine échéance",
  "vgp.echeance.depassee": "Échéance dépassée",
  // Accordé au nombre réel (lot AV-14, 19/09/2026) — « (1 jours) » était l'un
  // des cinq pluriels invariants mesurés à demeure.
  "vgp.echeance.jour_un": "jour",
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
  // \u2500\u2500 LA FICHE MACHINE, \u00c0 L'IDENTIQUE DE machinePage() (N-11, D125, D126) \u2500\u2500
  "machine.fiche.titre": "Fiche machine",
  "machine.fiche.sous_titre_separateur": "\u00b7",
  "machine.fiche.identite_titre": "Identit\u00e9 et rattachement",
  "machine.fiche.kv_famille": "Famille",
  "machine.fiche.kv_marque": "Marque",
  "machine.fiche.kv_reference": "R\u00e9f\u00e9rence",
  "machine.fiche.kv_serie": "N\u00b0 de s\u00e9rie",
  "machine.fiche.kv_annee_vente": "Ann\u00e9e de vente",
  "machine.fiche.kv_client": "Client",
  "machine.fiche.kv_site_suffixe": "client",
  "machine.fiche.kv_agence_suffixe": "CODIMA",
  "machine.fiche.kv_mise_en_service": "Mise en service",
  "machine.fiche.kv_contrat": "Contrat",
  "machine.fiche.kv_vgp": "Prochaine VGP",
  "machine.fiche.vgp_a_determiner": "\u00c0 d\u00e9terminer",
  "machine.fiche.a_completer": "\u00c0 compl\u00e9ter",
  "machine.fiche.historique_titre": "Historique des interventions",
  "machine.fiche.historique_ajouter": "+ Intervention",
  "machine.fiche.historique_colonne_date": "Date",
  "machine.fiche.historique_colonne_intervention": "Intervention",
  "machine.fiche.historique_colonne_type": "Type",
  "machine.fiche.historique_colonne_technicien": "Technicien",
  "machine.fiche.historique_colonne_resultat": "R\u00e9sultat",
  "machine.fiche.historique_vide":
    "Aucune intervention enregistr\u00e9e pour cette machine.",
  "machine.alerte.symbole": "!",
  "machine.alerte.voir_intervention": "Voir l'intervention",
  "machine.qr.eyebrow": "Identification terrain",
  "machine.qr.titre": "QR code machine",
  "machine.qr.description":
    "\u00c0 apposer sur l'\u00e9quipement. Le scan ouvre directement la fiche autoris\u00e9e.",
  "machine.qr.aria_prefixe": "QR code de la machine",
  "machine.qr.jeton_prefixe": "CODIPLAN:",
  "machine.qr.copier_id": "Copier l'ID",
  "machine.qr.imprimer": "Imprimer l'\u00e9tiquette",
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
    "Le téléchargement des fichiers n'est pas encore disponible ; les documents listés ci-dessus sont bien enregistrés.",
  // ── CRÉER ET CORRIGER UNE MACHINE (AT-07 bis, 18/09/2026) ────────────────
  //
  // Le parc était MONTRÉ, jamais GÉRÉ : aucune route n'écrivait une fiche
  // depuis un écran. Les deux formulaires suivent RG-PAR-07/D126 dans
  // l'ORDRE — famille, marque, référence, numéro de série, année de vente —
  // avant les champs facultatifs (RG-PAR-02 : quatre obligatoires, le reste
  // se complète plus tard).
  "machine.action.modifier": "Modifier",
  "machine.action.creer": "Enregistrer",
  "machine.action.enregistrer": "Enregistrer",
  "machine.action.envoi_en_cours": "Enregistrement…",
  "parc.action.nouvelle": "+ Machine",
  "machine.nouvelle.titre": "Nouvelle machine",
  "machine.nouvelle.sous_titre":
    "Les quatre champs marqués d'un astérisque sont obligatoires (RG-PAR-02) ; le reste se complète plus tard.",
  "machine.nouvelle.retour": "‹ Retour au parc",
  "machine.modifier.titre": "Corriger la fiche",
  "machine.modifier.sous_titre":
    "Le modèle, le client, le lieu d'intervention et le statut ne se corrigent pas ici : voir la fiche pour ces gestes.",
  "machine.modifier.retour": "‹ Retour à la fiche",
  // LES CHAMPS EN LECTURE SEULE DU FORMULAIRE DE CORRECTION — la même
  // raison que `modifierMachineDans` : le modèle porte l'unicité de la
  // fiche, et le déménagement (client, site) est un geste daté qu'aucun
  // formulaire ne porte encore (voir la note de tête du dépôt).
  "machine.modifier.non_modifiable": "Non modifiable ici",
  "machine.champ.famille": "Famille",
  "machine.champ.marque": "Marque",
  "machine.champ.reference": "Référence",
  "machine.champ.modele": "Modèle",
  "machine.champ.numero_serie": "N° de série",
  // LE LIBELLÉ COMPLET D'UN MATÉRIEL (AFFICHAGE-MATERIEL-1) — « Pont 2
  // colonnes Cascos 13442 S/N 10044 » : cette abréviation est le seul mot
  // qui sépare la référence du numéro de série dans `libelleMaterielComplet`
  // (`lib/machines/presentation.ts`), partagée par la carte de planning et
  // la fiche intervention.
  "machine.numero_serie_abrege": "S/N",
  "machine.champ.numero_serie_aide":
    "Plaque illisible ou absente : saisissez SN-INCONNU-<référence interne> (RG-PAR-02).",
  "machine.champ.client": "Client",
  "machine.champ.reference_interne": "Référence interne",
  "machine.champ.localisation": "Localisation",
  "machine.champ.facture_origine": "Facture d'origine",
  "machine.champ.date_mise_en_service": "Date de mise en service",
  "machine.champ.date_vente": "Date de vente",
  "machine.champ.garantie_fin": "Fin de garantie",
  "machine.champ.statut": "Statut",
  "machine.champ.criticite": "Criticité",
  "machine.champ.aucun_modele": "Aucun modèle actif dans cette société.",
  "machine.champ.aucun_client": "Aucun client actif dans cette société.",
  "machine.champ.aucun_site": "Choisissez d'abord un client.",
  "criticite_machine.bloquante": "Bloquante",
  "criticite_machine.importante": "Importante",
  "criticite_machine.normale": "Normale",
  // ── LE REFUS DU FORMULAIRE, EN QUATRE ISSUES (D-06, 17/09/2026) ──────────
  //
  // Même distinction que le glisser-déposer du planning
  // (`components/planning/pose.tsx`) : un refus métier n'est ni une erreur
  // serveur, ni une connexion interrompue, et confondre les deux enverrait
  // réessayer à l'aveugle une écriture peut-être déjà appliquée.
  "machine.refus.saisie":
    "La saisie a été refusée : vérifiez les quatre champs obligatoires (modèle, client, lieu d'intervention, numéro de série).",
  "machine.refus.numero_serie_pris":
    "Ce numéro de série est déjà utilisé pour ce modèle dans votre société.",
  "machine.refus.reference_interne_prise":
    "Cette référence interne est déjà utilisée par une autre machine de votre société.",
  "machine.refus.reference_invalide":
    "Le modèle, le client ou le lieu d'intervention sélectionné est introuvable ou hors de votre société.",
  "machine.refus.introuvable":
    "Cette machine est introuvable, ou hors de votre périmètre.",
  "machine.refus.inconnue":
    "Cette machine n'existe pas, ou elle n'est pas dans votre périmètre.",
  "machine.refus.erreur_serveur":
    "Une erreur est survenue pendant l'enregistrement. Rien n'a été modifié : réessayez.",
  "machine.refus.connexion_interrompue":
    "La connexion a été interrompue avant la fin de l'enregistrement. Rien n'a été modifié : vérifiez votre réseau avant de réessayer.",
  "machine.creee": "La fiche machine est créée.",
  "machine.modifiee": "La fiche machine est enregistrée.",
  "parametres.colonne_pas": "Pas",
  "parametres.colonne_creneaux": "Créneaux",
  "parametres.colonne_exceptions": "Exceptions",
  "parametres.aucune_agence":
    "Aucun établissement n'est enregistré pour cette société.",
  "parametres.sans_calendrier_court": "Aucun calendrier",
  "parametres.refus_pas":
    "Le pas des créneaux se règle en minutes entières, entre 1 et 480.",

  // ── L'ÉCRAN DE DÉTAIL D'UN CALENDRIER (R3-13) ────────────────────────────
  //
  // Il existe parce que l'argument de R2-05 — « le formulaire de réglage du pas
  // reste DANS la ligne » — ne vaut PAS pour les plages. Un pas est un nombre
  // qu'on compare d'un établissement à l'autre ; une semaine d'ouverture est
  // sept jours et autant de plages, et l'entrer dans une cellule détruirait la
  // densité que R2-05 venait de gagner.
  //
  // « FERMER UN JOUR » N'EST PAS UNE CASE À COCHER, et l'écran le dit plutôt que
  // de faire semblant d'avoir un interrupteur : la migration du 21/08 a écrit à
  // la naissance de la table qu'il n'y aurait pas de booléen « ouvert », parce
  // que deux sources pour un même fait finissent par se contredire. Un jour sans
  // plage EST un jour fermé.
  "calendrier.titre": "Horaires d'ouverture",
  "calendrier.retour": "Revenir aux établissements",
  "calendrier.sous_titre":
    "Chaque jour ouvre par une ou plusieurs plages. Un jour sans plage est un jour fermé : il n'y a pas d'interrupteur, et c'est délibéré — la plage est la seule source de ce qu'un établissement ouvre.",
  "calendrier.jour_ferme": "Fermé",
  "calendrier.debut": "Ouverture",
  "calendrier.fin": "Fermeture",
  "calendrier.enregistrer": "Enregistrer",
  "calendrier.retirer": "Retirer",
  "calendrier.ajouter": "Ajouter une plage",
  "calendrier.ajouter_ouvre":
    "Ajouter une plage à ce jour l'ouvre ; retirer la dernière le ferme.",
  "calendrier.pas_courant": "Pas des créneaux",
  "calendrier.creneaux_du_jour": "Créneaux proposés",
  "calendrier.aucun_creneau": "Aucun créneau",
  "calendrier.introuvable":
    "Ce calendrier n'est pas lisible sous la société active.",
  // ── CE QUI SE RECALCULE QUAND ON CHANGE UN HORAIRE (R3-13, question 1) ────
  //
  // L'effet rétroactif n'est pas empêchable ici : rien n'est matérialisé, et le
  // taux d'occupation comme la majoration relisent les plages à chaque rendu. Le
  // travail est donc de le DIRE là où le réglage se fait — la même forme que
  // D76, qui rend « je ne sais pas » plutôt que « 0 % ».
  //
  // Ce qui NE bouge pas est dit aussi : ce qui est posé reste posé. Une phrase
  // qui n'énonce que le risque fait croire que tout bouge.
  "calendrier.retroactif":
    "Ce que ce réglage change, et ce qu'il ne change pas : les interventions déjà posées restent en place, et le départ des compteurs d'accusé de réception ne bouge pas. En revanche le taux d'occupation et le supplément hors ouverture se recalculent à chaque affichage, y compris pour des semaines passées.",
  "parametres.plage.refus_saisie":
    "Une plage se saisit avec une heure d'ouverture et une heure de fermeture, la seconde après la première.",
  "parametres.plage.refus_chevauchement":
    "Cette plage en recouvre une autre le même jour. Deux plages qui se touchent sont admises ; deux plages qui se recouvrent compteraient deux fois les mêmes heures ouvrables.",
  "parametres.plage.refus_plage_courte":
    "Cette plage est plus courte que le pas des créneaux : le planning ne proposerait aucun créneau ce jour-là. Baisser le pas d'abord, ou allonger la plage.",
  "parametres.plage.refus_introuvable":
    "Cette plage n'est pas lisible sous la société active.",
  "parametres.pas.refus_plage_courte":
    "Ce pas dépasse la plus courte plage de ce calendrier : le planning ne proposerait aucun créneau sur cette plage. Allonger la plage d'abord, ou choisir un pas plus court.",
  "parametres.regler_horaires": "Régler les horaires",

  // ── LA CRÉATION ET LA MODIFICATION D'UN ÉTABLISSEMENT (AGENCE-1) ─────────
  //
  // « Agence » ne s'écrit qu'à `lib/i18n/vocabulaire.ts` (L0-11) : ces textes
  // composent `mot("agence")` à leur point d'usage, ou lui préfèrent
  // « établissement » — la même convention que `parametres.aucune_agence` et
  // `calendrier.retour`, gardée par `tests/unit/i18n/vocabulaire-impose.test.ts`.
  "agence.creer": "Nouvel établissement",
  "agence.retour": "← Tous les établissements",
  "agence.aide_calendrier_vide":
    "Le calendrier créé avec cet établissement ne portera aucune plage : il sera fermé tous les jours tant que ses horaires n'auront pas été réglés, juste après la création.",
  "agence.code": "Code",
  "agence.code.aide":
    "Repère unique dans la société, utilisé notamment par les imports du référentiel pour désigner cet établissement.",
  "agence.territoire": "Territoire",
  "agence.territoire.exemple": "NC",
  "agence.territoire.aide":
    "Code ISO 3166-1 alpha-2 des jours fériés — indépendant du fuseau horaire, jamais déduit de lui. « NC » pour la Nouvelle-Calédonie, « FR » pour la France.",
  "agence.fuseau_horaire": "Fuseau horaire",
  // Aucun identifiant IANA réel n'est écrit ici — voir
  // `tests/unit/calendar/sans-fuseau-en-dur.test.ts` : la plateforme ne
  // connaît aucun territoire par défaut, et « Continent/Ville » n'est un
  // repère de FORMAT que pour qui saisit, jamais une donnée pour le code.
  "agence.fuseau_horaire.exemple": "Continent/Ville",
  "agence.fuseau_horaire.aide":
    "Identifiant IANA (« Continent/Ville »). Facultatif : laissé vide, il reprend celui de la société.",
  "agence.action.creer": "Créer",
  "agence.action.modifier": "Enregistrer",
  "agence.creee":
    "L'établissement a été créé. Son calendrier ne porte encore aucune plage : réglez ses horaires ci-dessous pour qu'il ouvre.",
  "agence.modifiee": "Les modifications ont été enregistrées.",
  "agence.modifier.titre": "Modifier un établissement",
  "agence.lien_calendrier_aide": "Les horaires se règlent à part :",
  // L'ÉTAT, DIT DANS LA LISTE (AGENCE-2). `agence.actif` sert deux fois — la
  // case de la fiche ET la pastille de la liste —, comme `equipe.actif` sur
  // /parametres/equipe : un même mot pour un même état, où qu'on le lise.
  "agence.actif": "Actif",
  "agence.inactif": "Inactif",
  "agence.colonne_actions": "Actions",
  // Le lien de la liste vers la fiche. PAS `agence.action.modifier` : cette
  // clé-là est le bouton d'ENREGISTREMENT de la fiche, et la liste le
  // reprenait tel quel — un « Enregistrer » en bout de ligne, qui ne dit pas
  // où il mène, et qu'Alexis a lu comme « aucun lien » (mesuré le
  // 22/09/2026 sur la base de production). Même mot que `equipe.modifier`.
  "agence.modifier": "Modifier",
  "agence.refus.saisie":
    "Cette saisie n'est pas valide : vérifiez les champs remplis, notamment le territoire (deux lettres).",
  "agence.refus.code_pris":
    "Ce code est déjà utilisé dans cette société — choisissez-en un autre.",
  "agence.refus.introuvable":
    "Cet établissement n'est pas lisible sous la société active.",
  "agence.refus.territoire_ecarts":
    "Ce territoire ne peut pas changer : des écarts de calendrier (jours fériés travaillés ou ponts) subsistent pour l'ancien territoire. Traitez-les d'abord, puis recommencez.",

  // ── LES BLOCAGES D'AGENDA (R3-14) ────────────────────────────────────────
  //
  // AUCUNE NATURE, AUCUN MOTIF, AUCUN ÉTAT N'EST NOMMÉ ICI, et c'est le sujet du
  // ticket. CODIPLAN n'est pas un outil de gestion des ressources humaines :
  // `arret` était un arrêt de travail — une donnée de santé, sur un salarié
  // nommé, en clair —, et un circuit demandée → validée → refusée est un
  // circuit d'approbation de congés. *On peut toujours ajouter une colonne plus
  // tard ; on ne peut jamais dé-enregistrer ce qui a été écrit.*
  //
  // Le mot « absence » demeure dans les CLÉS parce que la table s'appelle
  // `absence` : renommer les unes sans l'autre ferait deux vocabulaires pour un
  // même objet, ce que le §3 refuse pour « agence » et « site ».
  "absences.titre": "Blocages d'agenda",
  "absences.sous_titre":
    "Qui n'est pas disponible, et quand. Un blocage dit une personne et une période, et rien d'autre : ce n'est pas un oubli, c'est une décision — la nature d'une indisponibilité regarde la médecine du travail, pas le planning.",
  "absences.declarer": "Bloquer un agenda",
  "absences.declarer_action": "Bloquer",
  "absences.personne": "Personne",
  "absences.periode": "Période",
  "absences.du": "Du",
  "absences.au": "Au",
  "absences.levee": "Levée",
  "absences.lever": "Lever",
  "absences.aucune": "Aucun blocage sur la période affichée.",
  "absences.immediat":
    "Le blocage prend effet dès qu'il est posé : il n'y a rien à valider. Les interventions déjà posées sur ces jours-là repartent aussitôt en file à planifier.",
  // ── CE QUE LA POSE CHANGE RÉTROACTIVEMENT (R3-14, question 4) ─────────────
  //
  // Rien n'est matérialisé : le taux d'occupation relit les blocages à chaque
  // rendu. L'effet rétroactif n'est donc pas empêchable, et le travail est de le
  // DIRE là où la saisie se fait — la forme de D76, appliquée non plus à une
  // valeur mais à sa fraîcheur.
  "absences.retroactif":
    "Un blocage posé sur une semaine passée change le taux d'occupation de cette semaine-là, y compris s'il a déjà été lu. Le taux dit toujours le mieux qu'on sait, jamais ce qu'on savait.",
  "absences.levee_explication":
    "Lever un blocage libère les jours à venir. Il ne rend pas leur créneau aux interventions déjà reparties en file : elles ne savent plus où elles étaient, et c'est au planificateur de les reposer.",
  "absences.rendues_titre": "Interventions rendues à la file à planifier",
  "absences.rupture_titre": "Rupture de service",
  "absences.rupture_explication":
    "Ces établissements n'ont plus qu'un seul technicien actif : aucun créneau n'est proposé à la place, et c'est délibéré — le planificateur sait ce que le système ne saura jamais.",

  // ── LES TROIS KPI ET LE CALENDRIER DE `absences()` (D125, lot A4) ────────
  "absences.kpi_ce_mois": "Absences ce mois",
  "absences.kpi_ce_mois_detail_suffixe_une": "personne concernée",
  "absences.kpi_ce_mois_detail_suffixe": "personnes concernées",
  "absences.kpi_rupture": "Rupture de service",
  // Le mot imposé « agence » (D5, D47) ne s'écrit pas ici : composé par
  // `libelleRuptureAucune` (./presentation.ts) depuis `motDansUnePhrase`.
  "absences.kpi_rupture_aucune_prefixe": "Aucune",
  "absences.kpi_rupture_aucune_suffixe":
    "sans technicien disponible aujourd'hui.",
  "absences.kpi_demandes_a_valider": "Demandes à valider",
  "absences.kpi_demandes_a_valider_valeur": "Sans objet",
  // RÉÉCRIT le 23/09/2026 (VISUEL-1) : la référence de ticket entre
  // parenthèses ne disait rien à l'exploitant qui la lisait à l'écran.
  "absences.kpi_demandes_a_valider_motif":
    "Le blocage est immédiat : il n'existe aucune file de validation à afficher.",
  "absences.calendrier_precedente": "‹",
  "absences.calendrier_aujourdhui": "Aujourd'hui",
  "absences.calendrier_suivante": "›",
  "absences.pastille_bloque": "Bloqué",
  "absences.pastille_separateur": "·",
  "absence.refus.saisie":
    "Un blocage se pose avec une personne, une date de début et une date de fin, la seconde après la première.",
  "absence.refus.pour_autrui":
    "Un technicien bloque son propre agenda, jamais celui d'un autre.",
  // ── LE CATALOGUE DES PRESTATIONS (R3-15 ; D109, D113) ────────────────────
  //
  // AUCUN LIBELLÉ DE MONTANT N'EXISTE ICI, et ce n'est pas une omission :
  // *une prestation porte une durée, jamais un taux* (D109). La colonne
  // n'existe pas en base, et un gardien refuse qu'elle apparaisse.
  "prestations.titre": "Catalogue des prestations",
  "prestations.sous_titre":
    "Ce qu'on sait faire, et le temps que cela prend d'habitude. Le prix n'est pas ici : il se lit au taux horaire en vigueur à la date de l'intervention, ou au forfait qui s'applique.",
  "prestations.creer": "Ajouter une prestation",
  "prestations.creer_action": "Ajouter",
  "prestations.modifier": "Modifier",
  "prestations.enregistrer": "Enregistrer",
  "prestations.code": "Code",
  "prestations.libelle": "Libellé",
  "prestations.famille": "Famille de matériel",
  "prestations.sans_famille": "Aucune famille",
  "prestations.famille_inconnue": "Famille non lisible",
  "prestations.duree": "Durée standard",
  "prestations.duree_minutes": "Durée (minutes)",
  // « NON ESTIMÉE » ET « ZÉRO » NE SE CORRIGENT PAS AU MÊME ENDROIT : zéro
  // dirait « instantané », et la base le refuse pour cette raison exacte. La
  // troisième fois que ce dépôt sépare « je ne sais pas » de « la valeur vaut
  // rien » (D76, D88).
  "prestations.duree_non_estimee": "Non estimée",
  "prestations.activite": "Activité",
  "prestations.active": "Active",
  "prestations.inactive": "Inactive",
  "prestations.activer": "Réactiver",
  "prestations.desactiver": "Désactiver",
  "prestations.aucune": "Le catalogue est vide.",
  "prestations.sans_montant":
    "Une prestation ne porte pas de tarif. Le prix se lit au taux horaire en vigueur à la date de l'intervention, ou au forfait qui s'applique — deux endroits qui porteraient un prix, ce serait une préséance à inventer et une facture qu'on ne saurait plus expliquer.",
  "prestations.sans_checklist":
    "La checklist type ne se saisit pas encore : personne n'a dit ce qu'elle porte — une liste d'étapes, un texte, un modèle à désigner. L'inventer ici la figerait pour toutes les sociétés.",
  "prestations.refus.saisie":
    "Une prestation se saisit avec un code et un libellé. La durée est facultative ; si elle est donnée, elle est en minutes entières et supérieure à zéro.",
  "prestations.refus.code_pris":
    "Ce code est déjà pris par une autre prestation de cette société.",
  "prestations.refus.famille_hors_societe":
    "Cette famille de matériel n'est pas lisible sous la société active.",
  "prestations.refus.introuvable":
    "Cette prestation n'est pas lisible sous la société active.",

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
  // LA HUITIÈME PORTE (N-02, 16/09/2026). Elle n'existait nulle part : la
  // pastille « Charte de la société » / « Thème neutre » occupait la barre en
  // permanence pour répondre à une question qu'on ne pose qu'à la mise en
  // service. Elle DÉMÉNAGE ici plutôt que de disparaître — c'est le seul
  // endroit du produit qui parle déjà de ce que la société a réglé.
  "parametres.index_societe_titre": "Charte de la société",
  "parametres.index_societe_resume":
    "L'identité affichée de la société active, et si ses propres couleurs sont appliquées ou non.",
  "parametres.index_horaires_titre": "Horaires d'ouverture",
  "parametres.index_horaires_resume":
    "Les jours travaillés, les horaires et le pas des créneaux, établissement par établissement. C'est ce calendrier qui décide de ce que le planning propose et de ce qu'il refuse.",
  "parametres.index_trajets_titre": "Temps de trajet par zone",
  "parametres.index_trajets_resume":
    "Le temps de route depuis l'établissement, par zone géographique. Des valeurs de référence s'appliquent tant que la société n'a rien réglé — un réglage retiré rend la main à la référence, jamais à zéro.",
  "parametres.index_taux_horaire_titre": "Taux horaire",
  "parametres.index_taux_horaire_resume":
    "Le taux horaire de main-d'œuvre et son historique. Un changement de taux ne modifie jamais les interventions déjà valorisées.",
  "parametres.index_forfaits_titre": "Forfaits applicables",
  "parametres.index_forfaits_resume":
    "Le catalogue des forfaits et leur ordre de priorité. Un forfait s'ajoute toujours aux heures ; il ne les remplace pas.",
  // Le libellé se COMPOSE depuis `mot("site")` : le mot imposé se définit une
  // fois, sous `vocabulaire.*`, et ne se recopie nulle part (D5, D47).
  "parametres.index_sites_suffixe": "d'intervention",
  "parametres.index_sites_resume":
    "Les lieux où l'on intervient, chez les clients. Leur rattachement décide du temps de trajet estimé et du calendrier de référence.",
  // LE RÉFÉRENTIEL CLIENT — cinquième carte, à côté des lieux d'intervention
  // (14/09/2026). *La fiche se rejoint neuf fois sur dix depuis une machine ou
  // un lieu qu'on regardait déjà ; la CRÉATION, elle, n'a aucun de ces points
  // de départ — on ne crée pas un client depuis une machine qui n'existe pas
  // encore.* C'est ce qui fait de la liste une porte à part entière, et non un
  // doublon des colonnes « Client » du parc et des sites.
  "parametres.index_clients_titre": "Clients",
  "parametres.index_clients_resume":
    "Le r\u00e9f\u00e9rentiel des clients\u00a0: identit\u00e9, code de rapprochement \u00e0 l'import et lieux d'intervention. C'est d'ici que part la cr\u00e9ation d'une fiche.",
  "materiel.titre": "Référentiel matériel",
  "materiel.sous_titre":
    "Les familles et les modèles que le parc désigne. Une machine exige un modèle, un modèle exige une famille : sans eux, aucune fiche ne peut naître.",
  "materiel.familles": "Familles",
  "materiel.modeles": "Modèles",
  "materiel.creer_famille": "Ajouter une famille",
  "materiel.creer_modele": "Ajouter un modèle",
  "materiel.creer_action": "Ajouter",
  "materiel.modifier_famille": "Modifier la famille",
  "materiel.modifier_modele": "Modifier le modèle",
  "materiel.enregistrer": "Enregistrer",
  "materiel.code": "Code",
  "materiel.libelle": "Libellé",
  "materiel.famille": "Famille",
  "materiel.famille_inconnue": "Famille non lisible",
  "materiel.marque": "Marque",
  "materiel.reference": "Référence",
  "materiel.periodicite_jours": "Entretien (jours)",
  "materiel.periodicite_compteur": "Entretien (compteur)",
  "materiel.periodicite": "Entretien périodique",
  "materiel.sans_periodicite": "Non périodique",
  "materiel.activite": "Activité",
  "materiel.active": "Actif",
  "materiel.inactive": "Inactif",
  "materiel.activer": "Réactiver",
  "materiel.desactiver": "Désactiver",
  // ── LE RÉGIME VGP, VISIBLE DEPUIS AT-04 — les libellés de valeur viennent
  // déjà de « vgp.regime.* » (registre des VGP) : une seconde entrée pour la
  // même valeur divergerait au premier renommage (§9, 01/09).
  "materiel.colonne_regime": "Régime VGP",
  "materiel.colonne_modeles": "Modèles",
  "materiel.vgp_mois": "mois",
  "materiel.modeles_compte": "modèles",
  "materiel.modeles_compte_un": "modèle",
  "materiel.aucune_famille": "Aucune famille n\u2019est encore déclarée.",
  "materiel.aucun_modele":
    "Aucun modèle n\u2019est encore déclaré. Une famille doit exister avant lui.",
  "materiel.modele_sans_famille":
    "Déclarez d\u2019abord une famille : un modèle en désigne une, et la base le refuse sans elle.",
  "materiel.pas_la_vgp":
    "L\u2019entretien périodique n\u2019est PAS la périodicité réglementaire des vérifications générales. Celle-ci se déclare à la famille, depuis le registre des VGP, avec le texte qui la fonde.",
  "materiel.vgp_ailleurs":
    "Une famille nouvelle naît « à déterminer » au registre des VGP, et y reste tant que personne n\u2019a tranché.",
  "materiel.aucune_suppression":
    "Rien ne se supprime ici : des modèles, des forfaits, des prestations et des machines désignent ces lignes. Désactiver les retire du choix sans toucher au passé.",
  "materiel.refus.saisie":
    "La saisie est refusée : code, libellé, marque et référence ne peuvent pas être vides, et une périodicité saisie est strictement positive.",
  "materiel.refus.code_pris":
    "Ce code de famille est déjà pris dans cette société.",
  "materiel.refus.marque_reference_prise":
    "Ce couple marque et référence est déjà pris dans cette société.",
  "materiel.refus.famille_hors_societe":
    "Cette famille n\u2019existe pas dans cette société.",
  "materiel.refus.introuvable": "Cette ligne est introuvable.",
  "parametres.index_prestations_titre": "Catalogue des prestations",
  "parametres.index_prestations_resume":
    "Ce qu'on sait faire, et combien de temps cela prend. Une prestation porte une durée standard, jamais un tarif : le prix se lit au taux horaire ou au forfait, à la date de l'intervention.",
  "parametres.index_materiel_titre": "Référentiel matériel",
  "parametres.index_materiel_resume":
    "Familles et modèles. Une machine exige un modèle, un modèle exige une famille.",
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
  // `trajets.minute_une` sert `duree()` via `decompte()` (lot AV-14,
  // 19/09/2026) : « (1 minutes) » était l'un des cinq pluriels invariants
  // mesurés à demeure. `trajets.minutes` reste seul dans `etiquetteChamp()`,
  // une étiquette d'unité sans nombre attaché, jamais un compte.
  "trajets.minute_une": "minute",
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
  // LA DÉCONNEXION, DANS LE CHROME (N-02, arbitrage du 16/09/2026).
  //
  // Cette clé portait `arrivee.deconnexion` : elle ne servait qu'à l'écran
  // d'atterrissage, sur lequel on ne revient jamais — et c'est très
  // exactement pourquoi personne ne pouvait fermer sa session. Elle sert
  // maintenant le CHROME, dans les trois coques, et son nom le dit plutôt que
  // de continuer à nommer un écran qu'elle a quitté.
  "nav.deconnexion": "Se déconnecter",

  // LE BANDEAU MOBILE (COQUE-375, arbitrage du directeur d'exploitation) —
  // sous 901px, la colonne sort de l'écran et ce bouton la fait revenir.
  // Un seul libellé, jamais deux : « ouvrir » et « fermer » sont le MÊME
  // geste sur le même bouton, et son état s'entend par `aria-expanded`,
  // pas par un second mot.
  "nav.ouvrir_le_menu": "Ouvrir le menu",

  // ── LA BARRE LATÉRALE, TROIS DOMAINES (D121, N-07) ────────────────────
  //
  // `docs/maquette/codiplan-maquette-complete.html` dessine une colonne
  // verticale sectionnée en trois titres — Exploitation, Clients & parc,
  // Paramètres — et quatorze destinations, toutes visibles en permanence
  // (aucune n'est un sous-menu qui se déplie). Les trois titres sont du TEXTE,
  // jamais un bouton ni un lien : voir `GroupeNavigation`
  // (`lib/navigation/entrees.ts`) pour ce que cela change à la règle qui leur
  // interdisait un mot neuf. Quatre des quatorze n'avaient encore aucune porte
  // dans la barre — Clients, Sites, VGP, Absences —, chacune vers un écran
  // déjà vivant.
  "nav.groupe_exploitation": "Exploitation",
  "nav.groupe_clients_parc": "Clients & parc",
  "nav.groupe_parametres": "Paramètres",
  "nav.clients": "Clients",
  // Pas de « nav.sites » : « site » est un mot IMPOSÉ (D5, D47) qui ne
  // s'écrit qu'aux clés `vocabulaire.*` (lib/i18n/vocabulaire.ts) — la
  // destination réutilise donc `vocabulaire.site.pluriel`, déjà « Sites »,
  // plutôt que d'écrire le mot une seconde fois.
  "nav.vgp": "VGP",
  "nav.absences": "Absences",

  // ── LE TABLEAU DE BORD (AV-10) — six chiffres, dont un que rien ne
  // calcule encore (R2-13). La maquette fait foi sur la disposition et les
  // couleurs (D95, D118) ; ce que ce ticket ne montre pas — répartition par
  // type, parc suivi, qualité de service — n'a pas de source réelle avant le
  // lot 4, et l'écart est écrit dans le fichier de l'écran plutôt que tu.
  "tableau_de_bord.titre": "Tableau de bord",
  "tableau_de_bord.sous_titre":
    "Les décisions et alertes du jour, sans remplacer le planning.",
  "tableau_de_bord.ouvrir_planning": "Ouvrir le planning",
  "tableau_de_bord.kpi_interventions_jour": "Interventions aujourd'hui",
  "tableau_de_bord.non_affectee_une": "non affectée",
  "tableau_de_bord.non_affectees": "non affectées",
  "tableau_de_bord.kpi_dossiers_bloques": "Dossiers bloqués",
  "tableau_de_bord.en_attente_detail_prefixe": "dont",
  "tableau_de_bord.en_attente_detail_suffixe": "depuis plus de 30 jours",
  // *Un taux ne voyage jamais sans ses deux termes ; ici les deux termes
  // eux-mêmes n'existent pas encore sous une forme consolidée* — la
  // consolidation multi-agence n'est pas une règle du chapitre 10 (R2-13).
  //
  // « Non calculé » est GÉNÉRIQUE depuis le lot AV-14 (19/09/2026) : la même
  // clé sert désormais aussi la tuile « VGP à prévoir » ci-dessous, quand le
  // registre n'a encore reçu aucune vérification — la doctrine du dépôt est
  // de nommer les refus UNE fois, jamais une troisième forme par tuile.
  //
  // LE MOTIF « R2-13 » A QUITTÉ LA TUILE LE 23/09/2026 (TABLEAU-1) : une
  // référence de ticket interne, lue par un opérateur, sans aucune valeur
  // pour lui. Remplacé par un lien vers `/planning`, où le taux PAR
  // TECHNICIEN est déjà affiché.
  "tableau_de_bord.kpi_taux_occupation": "Taux d'occupation",
  "tableau_de_bord.non_calcule": "Non calculé",
  "tableau_de_bord.lien_charge_planning": "Voir la charge sur le planning →",
  "tableau_de_bord.kpi_vgp_a_prevoir": "VGP à prévoir",
  // LES TROIS VOIES DE LA TUILE (VGP-2, 22/09/2026) — DÉPASSÉE, À VENIR sous
  // l'horizon, SANS INFORMATION. ~~« Dans les 30 prochains jours »~~ : ce seul
  // détail, sous un « 0 », se lisait « rien à faire » sur une base dont une
  // machine était dépassée depuis huit mois (mesuré sur d9c9446). L'horizon
  // n'est plus écrit ici : il est COMPOSÉ depuis `HORIZON_VGP_JOURS` de la
  // page, la seule à le fixer. Aucun mot ne dit « conforme » ni « en retard »
  // (D88) — on dit ce qu'on sait d'une date, jamais ce que la machine vaut.
  "tableau_de_bord.vgp_voie_depassee_une": "échéance dépassée",
  "tableau_de_bord.vgp_voie_depassees": "échéances dépassées",
  "tableau_de_bord.vgp_voie_a_venir_prefixe": "à venir sous",
  "tableau_de_bord.vgp_voie_a_venir_suffixe": "jours",
  "tableau_de_bord.vgp_voie_sans_information": "sans information",
  // LE REGISTRE N'A JAMAIS RIEN REÇU (lot AV-14) — distinct de « rien n'est dû
  // dans l'horizon » : voir `auMoinsUneVerificationEnregistree`
  // (lib/vgp/verification.ts) et `etatVgpAPrevoir` (./presentation.ts).
  "tableau_de_bord.vgp_a_prevoir_motif_non_calcule":
    "Aucune vérification VGP n'est encore enregistrée.",
  // LA TUILE OUVRE LE REGISTRE, FILTRÉ (TABLEAU-1, 23/09/2026) — un chiffre
  // sans chemin vers ce qu'il compte est la même faute que le zéro muet.
  "tableau_de_bord.lien_vgp_a_prevoir": "Voir les échéances dépassées →",

  // ── DEUX AJOUTS VOLONTAIRES, SANS ÉQUIVALENT DANS LA MAQUETTE (D128) ─────
  //
  // Un troisième — « Clients sans code externe » — a quitté ce bandeau le
  // 19/09/2026 (lot AV-14) : un problème de qualité de données n'est pas une
  // alerte du matin, et `/clients` porte déjà la même lecture pour sa propre
  // carte (`titreSansCode`, `compterSansCodeExterne`).
  "tableau_de_bord.indicateurs_complementaires_titre": "Autres indicateurs",
  "tableau_de_bord.kpi_demandes_ouvertes":
    "Demandes en attente de qualification",
  "tableau_de_bord.lien_demandes": "Qualifier une demande →",
  "tableau_de_bord.kpi_absences_jour": "Techniciens indisponibles aujourd'hui",

  "tableau_de_bord.priorites_titre": "Priorités opérationnelles",
  "tableau_de_bord.priorites_filtre_libelle": "Filtrer les priorités",
  "tableau_de_bord.priorites_filtre_tous": "Tous les besoins",
  "tableau_de_bord.priorites_filtre_urgent": "Urgences",
  "tableau_de_bord.priorites_filtre_piece": "Pièces",
  "tableau_de_bord.priorites_filtre_planning": "À planifier",
  "tableau_de_bord.priorites_filtrer_action": "Filtrer",
  "tableau_de_bord.priorites_vide": "Aucune priorité dans ce filtre.",
  "tableau_de_bord.priorites_ouvrir": "Ouvrir",
  "tableau_de_bord.priorite_urgent_titre": "Intervention urgente",
  "tableau_de_bord.priorite_piece_titre": "Pièce attendue",
  "tableau_de_bord.priorite_piece_detail_suffixe": "j d'attente",
  "tableau_de_bord.priorite_a_planifier_titre": "Intervention à planifier",
  "tableau_de_bord.priorite_demande_titre": "Demande à qualifier",

  // LA CARTE « ACTIVITÉ RÉCENTE » EST REMPLACÉE LE 23/09/2026 (TABLEAU-1) —
  // le marqueur `data-bloc="activite"` reste (D125), son contenu devient une
  // mesure réelle : combien d'interventions déjà planifiées n'ont encore
  // aucune durée prévue, faussant la charge tant que la saisie manque.
  "tableau_de_bord.interventions_sans_duree_titre": "Interventions sans durée",
  "tableau_de_bord.kpi_interventions_sans_duree":
    "Planifiées sans durée prévue",
  "tableau_de_bord.lien_interventions_sans_duree": "Voir les interventions →",

  // ── LA GRILLE DU PLANNING (D95) ──────────────────────────────────────────
  "planning.colonne_technicien": "Technicien",
  // ── LES DEUX FAÇONS DE NE PAS SAVOIR QUI TRAVAILLE (14/09/2026) ─────────
  //
  // Elles n'en faisaient qu'une, et le repli portait un fragment d'identifiant
  // — qui ressemblait à une donnée, et qui ne distinguait personne : les huit
  // premiers caractères d'un UUID v7 sont ceux de l'horodatage (I10).
  //
  // Le REFUS est légitime et le restera : un compte qui n'a pas le droit de
  // connaître une identité voit une colonne sans nom, jamais un nom.
  "planning.nom_non_communique": "Technicien (nom non communiqué)",
  // L'OUBLI ne l'est pas. Il n'a aucune raison d'exister, et il se lit comme ce
  // qu'il est : *une anomalie, jamais une donnée manquante* — la coupure de
  // D88, appliquée à une identité.
  "planning.nom_non_demande": "Technicien (anomalie : nom non demandé)",
  "planning.semaine": "Semaine",
  "planning.du": "du",
  "planning.au": "au",
  "planning.semaine_avant": "← Semaine précédente",
  "planning.semaine_apres": "Semaine suivante →",
  "planning.semaine_vide": "Aucune intervention posée sur cette semaine.",
  "planning.file_vide": "Rien n'attend d'être posé.",
  // ── LOT A2 (D125, D128) — LA BANNIÈRE ABSENTE ET LE BADGE DE LA FILE ────
  //
  // `planning()` de codiplan-maquette-complete.html dessine une bannière
  // « Calendriers d'agence respectés », mesurée ABSENTE par
  // `docs/audits/2026-09-19-ecrans.md`. Le texte ci-dessous ne recopie PAS
  // l'exemple figé de la maquette (« Ducos ouvre du lundi au samedi ; Koné du
  // lundi au vendredi ») : ce serait un calendrier codé en dur (I7). Seuls le
  // titre et la phrase de garde sont fixes ; la liste des jours par agence est
  // COMPOSÉE à partir de `joursTravailles`, jamais écrite ici.
  // Le mot « agence » ne s'écrit jamais ici (§3, vocabulaire imposé) : le
  // titre se compose en deux morceaux, autour de `motDansUnePhrase("agence")`
  // — même discipline que `absences.kpi_rupture_aucune_prefixe`.
  "planning.calendriers_titre_prefixe": "Calendriers d’",
  "planning.calendriers_titre_suffixe": "respectés",
  "planning.calendriers_aide":
    "Une case vide n'est pas automatiquement une disponibilité.",
  // Le mot du badge de la file « À affecter » — accordé via `decompte()`
  // (lot AV-14, 19/09/2026) : « 1 dossiers » était l'un des cinq pluriels
  // invariants mesurés à demeure, avec `planning.creneaux_libres` juste
  // au-dessus dans ce fichier.
  "planning.file_attente_dossier_un": "dossier",
  "planning.file_attente_dossiers": "dossiers",
  // DEUX ÉTATS DIFFÉRENTS DANS LA BANNIÈRE : `parametres.sans_calendrier` dit
  // qu'AUCUN calendrier n'est rattaché ; cette clé-ci dit qu'un calendrier
  // EST rattaché mais qu'il n'a plus aucun jour ouvert — `retirerPlage`
  // accepte de fermer le dernier jour, ce n'est pas une erreur (lib/calendar/
  // depot.ts). Les confondre donnerait un faux diagnostic (revue
  // d'exploitation, 19/09/2026).
  "planning.calendrier_ferme_tous_les_jours":
    "Calendrier rattaché, mais fermé tous les jours",
  // ── N-02 / N-06 — LA LISTE DU PLANNING SUR PETITE LARGEUR (17/09/2026) ───
  //
  // Bloc contigu et nommé pour ces clés : `lib/i18n/fr.ts` est aussi
  // écrit par AT-07 en ce moment (proposition #219), et une clé isolée au
  // milieu d'un autre bloc serait le point de conflit le plus probable à la
  // fusion.
  //
  // `technicien_sans_intervention` porte le seul mot que la réserve absolue
  // autorise sur une carte vide : jamais « disponible » — nous n'avons lu ni
  // les absences, ni les trajets, ni le calendrier de l'agence, et l'écrire
  // affirmerait un état que cet écran n'a pas observé (§9, 07/09).
  "planning.technicien_sans_intervention": "Sans intervention",
  // `liste_lecture_seule` — mesuré et ajouté le 17/09/2026, revue de #221.
  // La liste n'a AUCUNE case de dépôt : elle n'a jamais pu recevoir un
  // glisser-déposer, contrairement à la grille qu'elle remplace sous `lg`.
  // Sans ce mot, un bloc à la couleur d'un statut se prenait pour un bloc
  // qu'on peut prendre — la famille exacte de D-06, un geste qui se montre
  // possible et se refuse en silence. Il nomme où le geste existe vraiment :
  // la fiche de l'intervention, dont le formulaire « Déplacer » fait
  // exactement la même chose que le dépôt (`components/planning/pose.tsx`).
  "planning.liste_lecture_seule":
    "Pour réaffecter une intervention, ouvrez sa fiche.",
  // La légende de la maquette, six entrées, dans son ordre. Elle NOMME des
  // familles de couleur, pas des statuts un à un : huit statuts, cinq
  // familles, et c'est la maquette qui groupe (voir `lib/theme/statuts.ts`).
  // ── LES DEUX VUES DU PLANNING (11/09/2026) ───────────────────────────────
  "planning.vue_semaine": "Semaine",
  "planning.vue_jour": "Jour",
  // ~~LES DEUX VUES NE MONTRENT PAS LA MÊME POPULATION~~ — RETIRÉ (N-06,
  // 17/09/2026). Les deux clés qui le disaient, `planning.population_jour` et
  // `planning.population_semaine`, sont supprimées avec le défaut qu'elles
  // documentaient : les deux vues tirent maintenant leurs lignes et leurs
  // colonnes du même référentiel, et il n'y a plus d'écart à annoncer.
  "planning.jour_avant": "← Jour précédent",
  "planning.jour_apres": "Jour suivant →",
  "planning.colonne_heure": "Heure",
  "planning.jour_vide": "Aucune intervention posée ce jour-là.",
  // Accordé via `decompte()` depuis le lot AV-14 (19/09/2026) — « 1 créneaux
  // libres » était l'un des cinq pluriels invariants mesurés à demeure.
  "planning.creneau_libre_un": "créneau libre",
  "planning.creneaux_libres": "créneaux libres",
  "planning.pas": "pas de",
  "planning.jour_occupe": "Occupé",
  "planning.jour_libre": "Libre",
  "planning.jour_hors_ouverture": "Hors ouverture",
  // LE BLOCAGE D'AGENDA SE VOIT AVANT LE GESTE (PLANNING-1, RG-PLA-06,
  // 22/09/2026). *Mesuré* : la case d'un technicien absent se dessinait comme
  // une case libre, et le refus n'arrivait qu'au dépôt, après la tentative.
  // Le mot est celui de `/absences` (`absences.pastille_bloque`), sur la même
  // pastille violette (D124, D128) : une chose, un mot, une couleur. La case
  // reste une cible — c'est toujours le dépôt qui refuse —, et la légende le
  // dit plutôt que de le laisser découvrir.
  "planning.agenda_bloque": "Agenda bloqué",
  "planning.legende.agenda_bloque": "Agenda bloqué — le dépôt sera refusé",
  // CE QUE LA VUE JOUR NE PEUT PAS DESSINER DANS L'AXE, ET QU'ELLE DIT
  // (12/09/2026). *Une intervention qui ne peut pas être dessinée doit être
  // DITE, jamais effacée* : trois disparitions silencieuses vivaient dans cet
  // écran, et un planning qui perd une ligne fait poser quelqu'un sur un
  // créneau déjà pris.
  "planning.jour_hors_grille": "Non placées sur la grille",
  "planning.jour_hors_grille_aide":
    "Elles sont bien de ce jour ; l'axe des heures ne peut pas les montrer.",
  "planning.jour_hors_grille_hors_axe": "hors des heures d'ouverture",
  // LA LIGNE « SANS HEURE », EN TÊTE DE LA VUE JOUR (AFFICHAGE-MATERIEL-1,
  // 23/09/2026). *Mesuré en production le 23/09/2026 : quatre interventions du
  // jour, reléguées SOUS la grille, se lisaient comme absentes pour
  // l'exploitant.* Elles entrent désormais dans la colonne de leur
  // technicien, jamais seulement en dessous.
  "planning.jour_sans_heure": "Journée — heure non fixée",
  // LE MATÉRIEL D'UNE CARTE DE PLANNING, QUAND AUCUNE MACHINE N'EST AFFECTÉE
  // (AFFICHAGE-MATERIEL-1) — RG-INT-01 autorise le dépannage à l'aveugle,
  // sans machine connue : ce n'est pas une donnée manquante, et le mot le dit
  // plutôt qu'un tiret muet.
  "planning.materiel_non_precise": "Matériel non précisé",
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

  // Les mois — le titre « Septembre 2026 » du calendrier d'absences (D125).
  "mois.1": "Janvier",
  "mois.2": "Février",
  "mois.3": "Mars",
  "mois.4": "Avril",
  "mois.5": "Mai",
  "mois.6": "Juin",
  "mois.7": "Juillet",
  "mois.8": "Août",
  "mois.9": "Septembre",
  "mois.10": "Octobre",
  "mois.11": "Novembre",
  "mois.12": "Décembre",

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

  // ── LA PAGINATION, PARTAGÉE PAR LES QUATRE LISTES DU BACK-OFFICE (AT-07) ──
  //
  // « Page » et « précédent/suivant » ne dépendent d'aucune entité : composés
  // une fois ici, jamais recopiés dans chacun des quatre écrans qui paginent
  // (`app/(back-office)/presentation.ts` les assemble avec les numéros).
  "pagination.page": "Page",
  "pagination.sur": "sur",
  "pagination.precedent": "← Page précédente",
  "pagination.suivant": "Page suivante →",
  // Les unités que chaque écran compose avec `decompte()` pour SON total
  // filtré — jamais le compte de la page. `parc` réutilise déjà
  // `parc.total_un` / `parc.total` ; `sites` compose depuis le vocabulaire
  // imposé (`mot("site")`) et n'a besoin d'aucune clé de plus.
  "clients.resultat_un": "client",
  "clients.resultat": "clients",
  "interventions.resultat_un": "intervention",
  "interventions.resultat": "interventions",

  // ── LES QUATRE ÉTATS QUI MANQUAIENT À TOUT ÉCRAN (AV-11) ─────────────────
  //
  // `loading.tsx`, `error.tsx`, `not-found.tsx` et `global-error.tsx` sont posés
  // à la racine de `app/` : ils valent pour tout écran, quel que soit le
  // segment, et c'est pourquoi leurs libellés ne portent le préfixe d'aucun
  // écran particulier.
  //
  // Un chargement dit qu'on ATTEND, jamais qu'il n'y a rien — ce n'est pas
  // `EtatVide` (D88 : un vide affiché sans mot se lit comme une mesure).
  "etat.chargement": "Chargement…",
  // Une erreur dit ce qui s'est passé et ce qu'on PEUT FAIRE, jamais ce que
  // l'appelant n'a pas le droit de lire (D50 : un message d'erreur est un
  // canal d'information, soumis au cloisonnement comme une requête) et jamais
  // de trace technique.
  "etat.erreur.titre": "Une erreur est survenue",
  "etat.erreur.description":
    "Quelque chose s'est mal passé de ce côté-ci. Vous pouvez réessayer, ou revenir à l'écran précédent.",
  // Une page introuvable propose une SORTIE — un écran sans sortie est une
  // impasse.
  "etat.introuvable.titre": "Page introuvable",
  "etat.introuvable.description":
    "Cette adresse ne correspond à aucun écran de CODIPLAN.",
  // `global-error.tsx` remplace la mise en page racine elle-même : son message
  // ne peut pas supposer qu'une session, une barre ou une charte existent.
  "etat.erreur_globale.titre": "L'application ne peut pas s'afficher",
  "etat.erreur_globale.description":
    "Une erreur inattendue a interrompu le chargement. Vous pouvez réessayer, ou retourner à l'accueil.",
  // Les trois actions, PARTAGÉES entre les états ci-dessus plutôt que
  // recopiées : aucun délai, aucun compte à rebours, aucun réessai
  // automatique — un geste que l'humain actionne, et rien de plus (§8).
  "etat.reessayer": "Réessayer",
  "etat.retour_arriere": "Revenir en arrière",
  "etat.retour_accueil": "Retourner à l'accueil",

  // ── L'ÉQUIPE — créer, modifier, désactiver un technicien (ÉQUIPE-1) ──────
  //
  // Mesuré sur 4fead41 : aucun écran, aucune route, un technicien n'existait
  // que semé. « Agence » se compose depuis `mot("agence")` dans l'écran,
  // jamais écrit en dur ici (D5, D47) — les clés ci-dessous ne portent donc
  // que le RESTE du libellé.
  "parametres.index_equipe_titre": "Équipe",
  "parametres.index_equipe_resume":
    "Les techniciens de la société — création, rattachement, désactivation.",
  "equipe.titre": "Équipe",
  "equipe.sous_titre":
    "Les techniciens de la société active : créer, rattacher, désactiver.",
  "equipe.creer": "Ajouter un technicien",
  "equipe.creer_action": "Ajouter",
  "equipe.creer_aide":
    "Un courriel déjà connu de la plateforme rattache la personne existante à cette société, sans créer de doublon.",
  "equipe.liste_titre": "Techniciens",
  "equipe.filtre.montrer_inactifs": "Afficher les techniciens inactifs",
  "equipe.filtre.masquer_inactifs": "Masquer les techniciens inactifs",
  "equipe.aucun": "Aucun technicien.",
  "equipe.nom": "Nom",
  "equipe.email": "Courriel",
  // Composé avec `mot("agence")` au point d'usage : « Agence de rattachement ».
  "equipe.agence_suffixe": "de rattachement",
  "equipe.choisir_rattachement": "Sélectionner un rattachement",
  "equipe.activite": "Activité",
  "equipe.actif": "Actif",
  "equipe.inactif": "Inactif",
  "equipe.modifier": "Modifier",
  "equipe.enregistrer": "Enregistrer",
  // Une personne déjà connue de la plateforme (un autre courriel pris) est
  // RATTACHÉE à cette société, jamais dupliquée — voir `lib/techniciens/depot.ts`.
  "equipe.info.rattache":
    "Cette personne est déjà connue de la plateforme : elle a été rattachée à cette société, sans créer de nouvelle identité.",
  "equipe.refus.saisie": "Saisie invalide : vérifiez les champs du formulaire.",
  "equipe.refus.deja_membre":
    "Cette personne est déjà membre de la société active.",
  "equipe.refus.agence_hors_societe":
    "Le rattachement choisi n'appartient pas à la société active.",
  // ── FIXTURES DE L'ÉPREUVE DE BOUT EN BOUT (tests/e2e/equipe.spec.ts) ─────
  //
  // Le gardien de L0-11 fait passer par ici jusqu'au texte qu'un test de
  // rendu attend (« y compris le texte attendu par un test de rendu ») : ces
  // trois valeurs ne sont JAMAIS vues par un utilisateur réel, mais un
  // scénario qui les cherche à l'écran est une « requête d'écran » comme une
  // autre.
  "equipe.e2e.nom": "Technicien de l'épreuve",
  "equipe.e2e.courriel": "technicien.epreuve@codima.test",
  "equipe.e2e.nom_doublon": "Doublon tenté",
  "equipe.refus.introuvable": "Aucun technicien ne correspond à cette fiche.",
  // AJOUTÉE EN FIN DE FICHIER (lot PERF, 19/09/2026) — un autre lot y écrit
  // en même temps. La colonne « État » de `/vgp` répétait le motif complet
  // (régime · origine · rythme, jusqu'à cinq lignes une fois enveloppé) sur
  // CHAQUE ligne du tableau ; il reste, mais replié sous une divulgation
  // native (`<details>/<summary>`, sans JavaScript ni composant partagé
  // neuf) plutôt qu'affiché d'office — le motif reste ACCESSIBLE, jamais
  // supprimé (voir `app/(back-office)/vgp/page.tsx`).
  "vgp.etat_ligne.voir_motif": "Voir le motif",

  // ── AJOUTÉES EN FIN DE FICHIER (ÉQUIPE-2, 20/09/2026) ────────────────────
  //
  // Le référentiel des habilitations, leur attribution depuis la fiche d'un
  // technicien, et les exigences déclarées depuis la fiche d'un site.
  "parametres.index_habilitations_titre": "Habilitations",
  "parametres.index_habilitations_resume":
    "Le référentiel des qualifications, leur attribution aux techniciens et ce qu'exige chaque lieu d'intervention.",

  "habilitations.titre": "Habilitations",
  "habilitations.sous_titre":
    "Le référentiel des qualifications requises pour intervenir, et leur durée de validité.",
  "habilitations.creer": "Ajouter une habilitation",
  "habilitations.creer_action": "Créer",
  "habilitations.aide_duree":
    "La durée de validité n'est qu'une aide à la saisie d'une attribution : c'est la date d'expiration portée par chaque attribution qui décide.",
  "habilitations.aucune": "Aucune habilitation.",
  "habilitations.code": "Code",
  "habilitations.libelle": "Libellé",
  "habilitations.duree": "Durée de validité",
  "habilitations.duree_mois": "Durée de validité (mois)",
  "habilitations.duree_illimitee": "N'expire pas",
  "habilitations.activite": "Activité",
  "habilitations.active": "Active",
  "habilitations.inactive": "Inactive",
  "habilitations.activer": "Activer",
  "habilitations.desactiver": "Désactiver",
  "habilitations.modifier": "Modifier",
  "habilitations.enregistrer": "Enregistrer",
  "habilitations.retirer": "Retirer",
  "habilitations.expiree": "Expirée",
  "habilitations.expire_jamais": "N'expire pas",
  "habilitations.date_obtention": "Date d'obtention",
  "habilitations.date_expiration": "Date d'expiration",

  "habilitations.refus.saisie":
    "Saisie invalide : vérifiez les champs du formulaire.",
  "habilitations.refus.code_pris":
    "Ce code est déjà utilisé par une autre habilitation de la société active.",
  "habilitations.refus.introuvable":
    "Aucune habilitation ne correspond à cette fiche.",
  "habilitations.refus.technicien_hors_societe":
    "Ce technicien n'appartient pas à la société active.",
  "habilitations.refus.habilitation_hors_societe":
    "Cette habilitation n'appartient pas à la société active.",
  "habilitations.refus.deja_attribuee":
    "Cette habilitation est déjà attribuée à ce technicien.",
  "habilitations.refus.site_hors_societe":
    "Ce lieu d'intervention n'appartient pas à la société active.",
  "habilitations.refus.deja_exigee":
    "Cette habilitation est déjà exigée par ce lieu d'intervention.",

  // Depuis la fiche d'un technicien (`/parametres/equipe`).
  "habilitations.technicien.titre": "Habilitations",
  "habilitations.technicien.aucune": "Aucune habilitation attribuée.",
  "habilitations.technicien.rien_a_attribuer":
    "Aucune habilitation active à attribuer — le référentiel n'en porte aucune.",
  "habilitations.technicien.attribuer": "Habilitation",
  "habilitations.technicien.choisir": "Sélectionner une habilitation",
  "habilitations.technicien.attribuer_action": "Attribuer",

  // Depuis la fiche d'un site (`/sites/[id]`).
  "habilitations.site.titre": "Habilitations exigées",
  "habilitations.site.aucune": "Aucune habilitation exigée.",
  "habilitations.site.rien_a_exiger":
    "Aucune habilitation active à exiger — le référentiel n'en porte aucune.",
  "habilitations.site.exiger": "Habilitation",
  "habilitations.site.choisir": "Sélectionner une habilitation",
  "habilitations.site.bloquant": "Bloquante",
  "habilitations.site.avertissement": "Avertissement seulement",
  "habilitations.site.bloquant_case": "Bloquante",
  "habilitations.site.exiger_action": "Exiger",

  // ── FIXTURES DE L'ÉPREUVE DE BOUT EN BOUT (tests/e2e/habilitations.spec.ts)
  //
  // Même raison que `equipe.e2e.*` : le gardien de L0-11 fait passer par ici
  // jusqu'au texte qu'un test de rendu attend, et ces valeurs ne sont jamais
  // vues par un utilisateur réel.
  "habilitations.e2e.code": "EPR-01",
  "habilitations.e2e.libelle": "Habilitation de l'épreuve",

  // ── LES INTERLOCUTEURS D'UN CLIENT (CONTACTS-1) ────────────────────────────
  //
  // `lib/contacts/saisie.ts` (L1-03) clôt déjà les rôles et les canaux ;
  // aucune de ces entrées ne recopie cette liste, elles la RENDENT depuis
  // `ROLES_CONTACT` par `t(\`contact.role.${role}\`)`.
  "contact.nom": "Nom",
  "contact.fonction": "Fonction",
  "contact.telephone": "Téléphone",
  "contact.mobile": "Mobile",
  "contact.email": "Courriel",
  "contact.email.aide":
    "Un seul canal de notification est servi aujourd'hui — le courriel — et il est donc demandé pour tout interlocuteur.",
  "contact.roles": "Rôles",
  "contact.role.donneur_ordre": "Donneur d'ordre",
  "contact.role.signataire": "Signataire",
  "contact.role.contact_technique": "Contact technique",
  "contact.role.comptabilite": "Comptabilité",
  "contact.rattachement": "Rattachement",
  "contact.rattachement.client": "Contact du client (aucun lieu associé)",
  "contact.actif": "Actif",
  "contact.inactif": "Inactif",

  "contacts.action.creer": "Ajouter un interlocuteur",
  "contacts.action.modifier": "Enregistrer",
  "contacts.action.activer": "Activer",
  "contacts.action.desactiver": "Désactiver",
  "contacts.cree": "L'interlocuteur est enregistré.",
  "contacts.modifie": "L'interlocuteur est enregistré.",

  "contacts.refus.saisie":
    "Saisie invalide : vérifiez les champs du formulaire — un nom, au moins un rôle, et un courriel sont requis.",
  "contacts.refus.client_hors_perimetre":
    "Ce client n'appartient pas à la société active.",
  "contacts.refus.site_hors_client": "Ce lieu n'appartient pas à ce client.",
  "contacts.refus.introuvable":
    "Aucun interlocuteur ne correspond à cette fiche.",

  // Depuis la fiche d'un site (`/sites/[id]`).
  "sites.fiche.contacts": "Interlocuteurs",
  "sites.fiche.contacts_vide":
    "Aucun interlocuteur n'est enregistré pour ce lieu.",

  // ── FIXTURES DE L'ÉPREUVE DE BOUT EN BOUT (tests/e2e/contacts.spec.ts) ────
  //
  // Même raison que `habilitations.e2e.*` : le gardien de L0-11 fait passer
  // par ici jusqu'au texte qu'un test de rendu attend, et ces valeurs ne sont
  // jamais vues par un utilisateur réel.
  "contacts.e2e.nom_du_client": "Donneuse d'ordre (épreuve)",
  "contacts.e2e.nom_du_site": "Contact du lieu (épreuve)",

  // ── FIXTURES DE L'ÉPREUVE DE BOUT EN BOUT (tests/e2e/rapport-terrain.spec.ts)
  //
  // Même raison que `equipe.e2e.*` : le contenu qu'un technicien de l'épreuve
  // saisit dans le rapport de terrain, puis relit sur le bon, est du texte
  // affiché — le gardien de L0-11 l'exige donc ici, même s'il n'est jamais vu
  // par un utilisateur réel.
  "terrain.e2e.commentaire": "Filtre à air remplacé.",
  "terrain.e2e.suite_a_donner": "Revoir le compresseur dans 3 mois.",

  // ── FIXTURES DE L'ÉPREUVE DE BOUT EN BOUT (tests/e2e/avertissements-1.spec.ts)
  //
  // Même raison que `contacts.e2e.*` et `terrain.e2e.*` : sa PROPRE scène,
  // créée et supprimée par l'épreuve, préfixée `AV1-` pour se distinguer du
  // semis (`docs/propositions/47-AVERTISSEMENTS-1`).
  "avertissements.e2e.client": "AV1 — Client avec donneur d'ordre",
  "avertissements.e2e.site": "AV1 — Lieu avec donneur d'ordre",
  "avertissements.e2e.contact_donneur_ordre": "AV1 — Donneuse d'ordre",
  "avertissements.e2e.client_sans_contact": "AV1 — Client sans donneur d'ordre",
  "avertissements.e2e.site_sans_contact": "AV1 — Lieu sans donneur d'ordre",
  "avertissements.e2e.panne": "AV1 — Panne signalée pour l'épreuve.",

  // ── FIXTURES DE L'ÉPREUVE DE BOUT EN BOUT (tests/e2e/interventions-2.spec.ts)
  //
  // Même raison que `avertissements.e2e.*` : sa PROPRE scène, créée et
  // supprimée par l'épreuve, préfixée `INT2-` pour se distinguer du semis
  // (`docs/propositions/50-INTERVENTIONS-2`).
  "interventions2.e2e.client": "INT2 — Client de l'épreuve",
  "interventions2.e2e.site": "INT2 — Lieu de l'épreuve",
  "interventions2.e2e.panne": "INT2 — Panne signalée pour l'épreuve.",
  "interventions2.e2e.piece_x": "X-1",
  "interventions2.e2e.piece_y": "Y-1",
  "interventions2.e2e.note": "INT2 — note interne, jamais côté terrain.",

  // ── FIXTURES DE L'ÉPREUVE DE BOUT EN BOUT (tests/e2e/registre-2.spec.ts)
  //
  // Même raison que `interventions2.e2e.*` : sa PROPRE scène, créée et
  // supprimée par l'épreuve, préfixée `REG2-` pour se distinguer du semis
  // (`docs/propositions/57-REGISTRE-2`).
  "registre2.e2e.client": "REG2 — Client de l'épreuve",
  "registre2.e2e.site": "REG2 — Lieu de l'épreuve",
  "registre2.e2e.technicien_a": "REG2 — Technicien A",
  "registre2.e2e.technicien_b": "REG2 — Technicien B",

  // ── LE FIL D'ARIANE (FICHE-360-1) ───────────────────────────────────────
  "navigation.fil_ariane": "Fil d'Ariane",
  "fil_ariane.clients": "Clients",
  "fil_ariane.separateur": "›",

  // ── LA SYNTHÈSE EN TÊTE, LES ACTIONS EN CONTEXTE (FICHE-360-1) ──────────
  //
  // Un compteur INCONNU (aucun fait en base pour le dire) s'écrit « — »,
  // jamais 0 — la même règle que `ouTiret` applique déjà ailleurs (D88).
  // AUCUNE valeur ci-dessous n'écrit « site »/« agence » en clair (D5, D47,
  // L0-11) : « lieu(x) » reprend la paraphrase déjà retenue par
  // `clients.fiche.sites` et `sites.fiche.contacts_vide` ; le mot lui-même,
  // quand un libellé en a réellement besoin, se compose depuis `mot("site")`
  // dans l'écran, jamais ici.
  "clients.fiche.synthese.sites_actifs": "Lieux d'intervention actifs",
  "clients.fiche.synthese.equipements": "Équipements",
  "clients.fiche.synthese.interventions_ouvertes": "Interventions ouvertes",
  "clients.fiche.synthese.derniere_intervention": "Dernière intervention",
  "clients.action.ajouter_intervention": "+ Intervention",
  "clients.fiche.sites.equipements": "Équipements",

  "sites.fiche.synthese.equipements": "Équipements",
  "sites.fiche.synthese.interventions_ouvertes": "Interventions ouvertes",
  "sites.fiche.synthese.derniere_intervention": "Dernière intervention",
  "sites.fiche.synthese.vgp_prochaine": "Prochaine VGP due",
  "sites.action.ajouter_intervention": "+ Intervention",
  "sites.action.ajouter_machine": "+ Machine",

  // ── LE BLOC « ÉQUIPEMENTS DU SITE » (FICHE-360-1) ───────────────────────
  "sites.fiche.equipements": "Équipements enregistrés",
  "sites.fiche.equipements_vide":
    "Aucun équipement n'est enregistré pour ce lieu.",
  "sites.fiche.equipements.colonne_famille": "Famille",
  "sites.fiche.equipements.colonne_materiel": "Marque / référence",
  "sites.fiche.equipements.colonne_serie": "N° de série",
  "sites.fiche.equipements.colonne_statut": "Statut",
  "sites.fiche.equipements.colonne_action": "Action",
  "sites.fiche.equipement_resultat_un": "équipement",
  "sites.fiche.equipement_resultat": "équipements",

  // « + AGENCE/SITE », COMPOSÉ AVEC LE MOT IMPOSÉ (FICHE-360-1) — seul le
  // signe s'écrit ici, jamais le mot : `{t("action.ajouter")} {mot("site")}`
  // dans l'écran (D5, D47, L0-11).
  "action.ajouter": "+",

  // ── FIXTURES DE L'ÉPREUVE DE BOUT EN BOUT (tests/e2e/fiche-360-1.spec.ts)
  //
  // Sa PROPRE scène, créée et supprimée par l'épreuve, préfixée `F360-` pour
  // se distinguer du semis — même discipline que `avertissements.e2e.*`, et
  // « Lieu » plutôt que « Site » pour la même raison que `avertissements.e2e.site`.
  "fiche360.e2e.client": "F360 — Client de la fiche 360",
  "fiche360.e2e.site_un": "F360 — Lieu avec équipements",
  "fiche360.e2e.site_deux": "F360 — Lieu sans équipement de ce lot",
  "fiche360.e2e.numero_serie_1": "F360-SN-1",
  "fiche360.e2e.numero_serie_2": "F360-SN-2",
  "fiche360.e2e.numero_serie_3": "F360-SN-3",

  // ── FIXTURES DE L'ÉPREUVE DE BOUT EN BOUT (tests/e2e/formulaires-2.spec.ts)
  //
  // Même discipline que `fiche360.e2e.*` : sa PROPRE scène, créée et supprimée
  // par l'épreuve, préfixée `FRM2-` pour se distinguer du semis
  // (`docs/propositions/56-FORMULAIRES-2`).
  "formulaires2.e2e.client": "FRM2 — Client de l'épreuve",
  "formulaires2.e2e.site": "FRM2 — Lieu de l'épreuve",
  "formulaires2.e2e.numero_serie": "FRM2-SN-1",
  "formulaires2.e2e.panne": "FRM2 — Panne signalée pour l'épreuve.",
  "formulaires2.e2e.reference_client": "FRM2-ref",
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
