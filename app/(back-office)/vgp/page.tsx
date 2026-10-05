import type { Metadata } from "next";

import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { ImprimerRegistreVgp } from "@/components/vgp/impression-registre";
import { Page } from "@/components/mise-en-page/page";
import { Badge } from "@/components/ui/badge";
import { Kpi } from "@/components/ui/kpi";
import { Onglets, type EtatOnglet } from "@/components/ui/onglets";
import { Pagination } from "@/components/ui/pagination";
import { Cellule, LignePleine, Tableau } from "@/components/ui/tableau";
import { peut } from "@/lib/auth/habilitations";
import { obtenirSession } from "@/lib/auth/session";
import {
  dateCivile,
  instantDuJour,
  jourDe,
  maintenant,
  schemaFuseau,
} from "@/lib/calendar/fuseau";
import { avecContexteApplicatif } from "@/lib/db/client";
import { t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";
import { LIMITE_RECHERCHE_PAR_DEFAUT } from "@/lib/machines/saisie";
import { trierAlphanumeriquement } from "@/lib/tri/collation";
import {
  etatVideDuRegistreVgp,
  libelleEcheance,
  libelleEtatCourt,
  tonEtat,
} from "@/lib/vgp/libelles";
import {
  echeanceDepassee,
  echeanceEstAVenir,
  enregistrementPropose,
  estSansInformation,
  famillesADeterminer,
  listerLeRegistre,
  optionsDeFiltreDuRegistre,
  rechercheCorrespond,
  regrouperRegistreParClient,
  resumerLeRegistre,
  trierParUrgence,
  type GroupeDeRegistreParClient,
  type LigneDeRegistre,
} from "@/lib/vgp/registre";
import { CLASSES_LIEN } from "@/lib/theme/apparence";

import {
  decompte,
  hrefDeLaPage,
  libelleClientSite,
  libellePage,
} from "../presentation";

export const metadata: Metadata = { title: t("vgp.titre") };

/**
 * LE REGISTRE DES VÉRIFICATIONS PÉRIODIQUES (L9-02, L9-03 ; D88, D125, D128).
 *
 * ## LA DISPOSITION VIENT DE vgp() (D125), LE CONTENU DE D88 — ET D128 TRANCHE
 *    LEUR ORDRE QUAND ILS SE CROISENT
 *
 * `codiplan-maquette-complete.html` dessine, pour cet écran, quatre KPI en
 * bandeau puis une table à six colonnes dont deux — « État » et « Action » —
 * n'existaient pas ici avant ce ticket. Cette disposition est reprise : D125
 * fait foi dessus.
 *
 * **Ce que D125 NE fait PAS foi : le contenu de la colonne « État ».** La
 * maquette y pose des badges « Conforme », « À planifier », « En retard » —
 * un verdict de conformité. C'est exactement ce que D88 (L9-02, D114)
 * interdit : *les VGP sont commandées par les clients, CODIPLAN n'apprend
 * leur résultat que si on nous le transmet, et ne rend jamais de verdict.*
 * D128 (18/09/2026) tranche l'ordre entre les deux : *« D125 fait foi sur la
 * disposition, jamais sur une règle de gestion déjà arbitrée. Quand les deux
 * s'opposent, la règle de gestion l'emporte. »* Le badge de cette colonne
 * code donc l'ÉTAT DE L'INFORMATION — Hors registre / Sans information /
 * Information reçue —, jamais une conformité. C'est un ÉCART VOLONTAIRE à la
 * maquette, nommé ici et dans la proposition du lot, pas un oubli.
 *
 * **Depuis VGP-2 (22/09/2026), une information reçue dont l'échéance déduite
 * est PASSÉE porte un badge distinct — « Échéance dépassée », ton rouge.**
 * Ce n'est toujours pas un verdict : c'est une DATE passée, dite au même
 * endroit que l'état, parce que le vert d'« Information reçue » se lisait
 * comme « à jour » (voir `tonEtat`).
 *
 * ## LE BOUTON « + PLANIFIER UN CONTRÔLE » DE L'EN-TÊTE — ÉCART NOMMÉ
 *
 * `head()` de `vgp()` pose ce bouton. Aucune route ne planifie un contrôle
 * aujourd'hui — enregistrer une vérification déjà FAITE (§ ci-dessous) n'est
 * pas la même chose que planifier une échéance future, qui reste à
 * construire. Un bouton qui ne mène nulle part se lit comme une panne
 * (R2-13) : il n'est donc pas rendu.
 *
 * ## LA COLONNE « ACTION » MÈNE À `enregistrerVerification` (SECOND TEMPS)
 *
 * `enregistrerVerification` (`lib/vgp/verification.ts`) existait sans aucun
 * appelant — un geste réglementaire qu'on ne pouvait pas faire est un écran
 * qui ment. La fiche machine reste atteignable par le lien du numéro de
 * série, dans la colonne « Machine » — le bouton d'action ne la porte plus,
 * pour ne pas dupliquer deux destinations sous un même bouton.
 *
 * **DEPUIS TP-A2 (29/09/2026), CE N'EST PLUS « chaque ligne »** — une ligne
 * `non_soumis` (ou `verifie`) ne mène plus nulle part : la question ne se
 * pose pas, et un bouton qui mènerait à `/vgp/enregistrer/[id]` s'y écrirait
 * quand même sans jamais compter (le serveur ne lit pas la famille, PV-33).
 * `a_determiner` GARDE le lien, avec un avertissement — une machine dont la
 * famille n'est pas encore qualifiée peut le devenir demain, et ne doit pas
 * avoir perdu, entre-temps, tout chemin pour enregistrer ce qu'un organisme
 * aurait constaté aujourd'hui (décision d'Alexis, 29/09/2026). Voir
 * `enregistrementPropose`, `lib/vgp/registre.ts`.
 *
 * ## LE DÉBORDEMENT MESURÉ À 1280 PX (AUDIT D128) ET SA CORRECTION
 *
 * La colonne « Dernière information » de l'ancien tableau portait, pour une
 * machine « sans information » sans date de mise en service connue, la
 * phrase entière `vgp.information.depuis_inconnu` (79 caractères, aucun point
 * de rupture avant la fin) — dans un tableau posé sous `overflow-x-auto`,
 * l'algorithme de disposition automatique d'un `<table>` préfère ÉLARGIR la
 * colonne plutôt que d'envelopper une phrase sans rupture, et la ligne
 * débordait du cadre visible. Deux corrections, ensemble : le badge d'état ne
 * porte plus qu'un MOT (jamais une phrase), et la date qui l'accompagne
 * (`vgp.etat_ligne.*`) est composée courte, avec `break-words` en secours sur
 * les sous-lignes qui peuvent rester longues (le régime).
 *
 * ## CE QUE CET ÉCRAN AFFICHE AUJOURD'HUI, ET IL LE DIT
 *
 * **Toutes les machines soumises sont « sans information »**, parce que rien
 * n'enregistre encore ce qu'un organisme a écrit : le rapport de VGP est un
 * document de classe `client` (D88 §9), et rien ne le distingue d'un autre
 * document. L'écran porte cette phrase en toutes lettres plutôt que de laisser
 * croire à un parc jamais vérifié. *Un écran qui se tait sur ce qu'il ne sait
 * pas est exactement le registre qui ment.*
 *
 * ## LA LISTE DES INDÉTERMINÉS EST À UN CLIC, ET SON COMPTE EST ICI
 *
 * C'est la seconde moitié de L9-03, et c'est elle qui fait tenir la première :
 * *une famille qui naît « à déterminer » et que personne ne voit jamais est
 * exactement la case décochée qu'on a refusée.* `vgp()` ne dessine ni ce
 * lien ni le paragraphe d'explication qui le suit : ils restent, écart nommé
 * dans l'autre sens — les retirer romprait L9-03.
 *
 * ## CET ÉCRAN EST UNE ENTRÉE DE LA BARRE — `nav.vgp`
 *
 * **Corrigé le 30/09/2026 (TP-A6-TRIS-MISE-EN-PAGE, audit du 28/09/2026,
 * PV-11) : ce paragraphe affirmait le contraire, et c'était devenu faux.**
 * La barre est une liste CLOSE confrontée à la maquette (D95/D118,
 * `lib/navigation/entrees.ts`), et la maquette y dessine bien une entrée
 * « VGP » — `nav.vgp`, qui mène directement ici (`/vgp`). Le lien que `/parc`
 * portait vers ce registre en était donc un DOUBLON silencieux, jamais le
 * seul chemin : il est retiré (voir `lib/machines/ecarts-maquette.ts`,
 * `ECARTS_MAQUETTE_AJOUTS_PARC`).
 *
 * ## VGP-4 (25/09/2026) — UN ORDRE, PAS UNE FENÊTRE DE JOURS ; ÉCART NOMMÉ
 *
 * `codiplan-maquette-complete.html` écrit « à faire sous 30 jours » sur le
 * premier KPI — un délai que rien, ni le chapitre 10 ni `docs/arbitrages.md`,
 * n'a réglé, et l'inventer serait la faute que §8 du CLAUDE.md interdit (voir
 * déjà « AUCUNE FENÊTRE DE JOURS N'EST INVENTÉE ICI » dans
 * `lib/vgp/registre.ts`). L'arbitrage du 25/09/2026 tranche : aucune fenêtre,
 * un ORDRE à la place — `trierParUrgence` classe les lignes dépassées (la
 * plus ancienne en tête) puis à venir (la plus proche en tête), sans aucun
 * seuil. **« Sous 30 jours » de la maquette n'est donc PAS repris**, ni comme
 * fenêtre ni comme libellé : c'est un écart nommé, pas un oubli. La
 * recherche `q` porte sur le numéro de série, la désignation (le modèle) et
 * le client — les trois colonnes qui identifient déjà une ligne du registre
 * (`rechercheCorrespond`, `lib/vgp/registre.ts`).
 *
 * ## TP-A2 (29/09/2026) — COMPTE, PAGINATION, ET UN CINQUIÈME KPI NOMMÉ
 *
 * Le tableau était coupé MUETTEMENT à 200 lignes, sans compte ni pagination
 * — l'audit du 28/09 (PV-30, PV-31) mesure qu'un registre de plusieurs
 * centaines de machines n'y était donc jamais lisible en entier. Le tableau
 * PAGINE désormais, `LIMITE_RECHERCHE_PAR_DEFAUT` (`lib/machines/saisie.ts`)
 * par page — la même taille de page que `/parc`, un registre étant une liste
 * de machines. Trois des cinq KPI datés — « Échéances à venir », « Échéances
 * dépassées » et, depuis ce ticket, « Sans information » — mènent chacun à
 * `?etat=a_venir`, `?etat=depassees` et `?etat=sans_information`, le même
 * critère non borné que chaque KPI compte déjà ; les deux autres (« Informations
 * reçues », « À déterminer ») restent inertes. Le cinquième KPI est un ÉCART
 * NOMMÉ à D125 (qui n'en dessine que quatre) : D88 §2 l'exige au même titre
 * que les trois autres voies déjà nommées à l'accueil (`CompteAPrevoir`,
 * `lib/vgp/registre.ts`), et QT-13 (a) le confirme.
 */

/**
 * LE PLAFOND DU RÉSUMÉ (KPI), PAS DE L'AFFICHAGE (TABLEAU-1, 23/09/2026) —
 * voir le docblock de `listerLeRegistre` (`lib/vgp/registre.ts`), et même
 * genre de compromis qu'AT-07 pour `/parc` (`LIMITE_RECHERCHE_MAXIMALE`,
 * `lib/machines/saisie.ts`) : une borne de SÉCURITÉ contre un parc qui
 * compterait des milliers de machines, pas un calcul du tout — *un parc
 * au-delà verrait son résumé approximatif plutôt que faux de façon
 * imprévisible*, et c'est un écart documenté, pas un défaut caché.
 */
const LIGNES_RESUME_MAXIMALES = 2000;

/**
 * LE FILTRE `?etat=` — une LECTURE DE PARAMÈTRE, rien de plus (TABLEAU-1,
 * 23/09/2026 ; étendu VGP-4, 25/09/2026). La tuile « VGP à prévoir » du
 * tableau de bord ouvre `?etat=depassees` plutôt que `/vgp` nu : un chiffre
 * sans chemin vers ce qu'il compte est la même faute que le zéro muet que ce
 * dépôt corrige ailleurs. `a_venir` fait de même pour le KPI « Échéances à
 * venir » de cet écran — le MÊME critère non borné que le KPI compte déjà
 * (`echeanceEstAVenir`, `lib/vgp/registre.ts`). Aucune AUTRE valeur n'est
 * reconnue — un paramètre qui ne vaut ni l'un ni l'autre laisse le registre
 * tel quel, jamais une erreur.
 *
 * **`sans_information` s'y ajoute (TP-A2, 29/09/2026)** — le même prédicat
 * que le cinquième KPI compte déjà (`estSansInformation`, `lib/vgp/registre.ts`).
 */
const ETATS_FILTRE = ["depassees", "a_venir", "sans_information"] as const;
type EtatFiltre = (typeof ETATS_FILTRE)[number] | "tous";

function etatFiltreLu(valeur: string | string[] | undefined): EtatFiltre {
  return typeof valeur === "string" &&
    (ETATS_FILTRE as readonly string[]).includes(valeur)
    ? (valeur as EtatFiltre)
    : "tous";
}

/** `page` — le même contrat que `lib/machines/saisie.ts:224`, un écran de plus. */
const schemaPage = z.coerce.number().int().min(1).catch(1);

/**
 * LES FILTRES CLIENT ET SITE (D122, TP-VGP) — un IDENTIFIANT technique,
 * jamais un libellé, même contrat que `client_id`/`site_id` de
 * `schemaRechercheParc` (`lib/machines/saisie.ts`) : rien n'est recomparé qui
 * ne soit déjà cloisonné en base (PV-32, `FILTRE_PARC_ACTIF`). `.catch(null)`
 * plutôt que `.safeParse` : un identifiant malformé laisse le registre tel
 * quel, jamais une erreur — la même tolérance que `etatFiltreLu` ci-dessus.
 */
const schemaIdentifiantFiltre = z.uuid().nullable().catch(null);

function identifiantFiltreLu(
  valeur: string | string[] | undefined,
): string | null {
  return schemaIdentifiantFiltre.parse(
    typeof valeur === "string" && valeur.length > 0 ? valeur : null,
  );
}

/**
 * LE REGROUPEMENT « PAR CLIENT » (MO-12, UX9-c, D166) — `?groupe=client`,
 * une lecture de paramètre comme `etat` : toute autre valeur laisse le
 * registre dans sa disposition habituelle, jamais une erreur.
 */
function groupeParClientActif(valeur: string | string[] | undefined): boolean {
  return valeur === "client";
}

/** Le tiret cadratin d'une valeur absente — un SIGNE, jamais une phrase. */
const ABSENT = "—";

/**
 * L'échéance, ou le signe de son absence — composé HORS du JSX.
 *
 * *Le gardien de L0-11 a refusé `{… ?? ABSENT}` écrit dans le rendu* : il
 * résout la constante et y lit une chaîne visible en dur. Il a raison de ne pas
 * faire la différence — c'en est une —, et la forme que le dépôt emploie
 * ailleurs est celle-ci : une fonction qui rend le texte, jamais un littéral
 * dans le JSX.
 */
function echeanceAffichee(ligne: LigneDeRegistre): string {
  return libelleEcheance(ligne.information) ?? ABSENT;
}

/**
 * LE DERNIER CONTRÔLE CONNU — la date de VÉRIFICATION, jamais celle de la
 * saisie (même règle que `dernieresInformations`). Sans information reçue,
 * le signe d'absence : il n'y a rien à dater ici, la colonne « État » dit
 * pourquoi.
 */
function dernierControleAffiche(ligne: LigneDeRegistre): string {
  return ligne.information.etat === "information_recue"
    ? dateCivile(ligne.information.derniereInformation)
    : ABSENT;
}

/**
 * LA SOUS-LIGNE « DEPUIS QUAND » — uniquement pour « sans information » :
 * « hors registre » n'a pas de date (sa nature, D88) et « information reçue »
 * porte déjà sa date dans la colonne « Dernier contrôle ». Composée COURTE
 * (§ « LE DÉBORDEMENT… » ci-dessus), jamais la phrase longue du dictionnaire
 * de bibliothèque (`vgp.information.depuis_inconnu`, réservée à la fonction
 * pure et à son propre gardien).
 */
function departSousLigne(ligne: LigneDeRegistre): string | null {
  const info = ligne.information;
  if (info.etat !== "sans_information") {
    return null;
  }
  return info.depuis === null
    ? t("vgp.etat_ligne.depuis_inconnu")
    : `${t("vgp.etat_ligne.depuis_le")} ${dateCivile(info.depuis)}`;
}

export default async function PageRegistreVgp({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await obtenirSession(await headers());
  if (session === null) {
    redirect("/connexion");
  }
  if (session.contexte.societeId === null) {
    redirect("/arrivee");
  }
  const contexte = session.contexte;

  // LE FUSEAU EST UNE DONNÉE, JAMAIS UN LITTÉRAL (L0-08) : la date courante ne
  // se lit pas sans lui, et c'est celui de la société — le registre couvre
  // toutes ses agences.
  const societe = await avecContexteApplicatif(contexte, (tx) =>
    tx.societe.findFirst({
      where: { id: contexte.societeId as string },
      // `raison_sociale` S'AJOUTE (MO-12) — l'en-tête de l'aperçu d'impression
      // par client la porte, comme `bon.societe.raisonSociale` le fait déjà
      // pour le bon d'intervention (`lib/interventions/bon.ts`).
      select: { fuseau_horaire: true, raison_sociale: true },
    }),
  );
  const fuseau = schemaFuseau.parse(societe?.fuseau_horaire);
  // LA CIVILE, JAMAIS L'INSTANT (DATES-1, même faute que `compterAPrevoir`
  // avant sa réparation au tableau de bord) : `prochaineEcheance` et
  // `derniereInformation` sont des `@db.Date`, posées à minuit UTC. Comparer
  // l'heure qu'il est à minuit UTC fait tomber une échéance du JOUR MÊME sous
  // zéro dès que l'horloge dépasse minuit UTC — 11 h du matin à Nouméa.
  const aujourdHui = instantDuJour(jourDe(maintenant(fuseau).local));

  // TROIS LECTURES INDÉPENDANTES (lot PERF, mesuré sur 4fead41) : aucune ne
  // dépend du résultat d'une autre, toutes ne dépendent que du contexte
  // cloisonné.
  const [toutesLesLignes, indetermines, options] = await Promise.all([
    // `LIGNES_RESUME_MAXIMALES` (TABLEAU-1) : voir le docblock de
    // `LIGNES_RESUME_MAXIMALES` dans `lib/vgp/registre.ts`. Une SEULE
    // lecture — le tableau n'en garde que la page courante (TP-A2), jamais
    // une seconde requête plafonnée séparément.
    listerLeRegistre(contexte, aujourdHui, LIGNES_RESUME_MAXIMALES),
    famillesADeterminer(contexte),
    // LES OPTIONS DES FILTRES CLIENT ET SITE (D122, TP-VGP) — indépendantes
    // de la recherche en cours, comme `optionsDeFiltreDuParc` : choisir un
    // filtre ne doit pas rétrécir les autres listes déroulantes.
    optionsDeFiltreDuRegistre(contexte),
  ]);
  // LE RÉSUMÉ PORTE SUR TOUT CE QUI A ÉTÉ LU, jamais sur ce qui est rendu :
  // c'est exactement l'écart qui sous-comptait le KPI face à la tuile du
  // tableau de bord (`compterAPrevoir`, qui ne plafonne rien).
  const resume = resumerLeRegistre(toutesLesLignes);
  const machinesADeterminer = indetermines.reduce(
    (total, famille) => total + famille.machines,
    0,
  );

  const params = await searchParams;
  const filtre = etatFiltreLu(params.etat);
  const recherche = typeof params.q === "string" ? params.q : "";
  const clientFiltre = identifiantFiltreLu(params.client);
  const siteFiltre = identifiantFiltreLu(params.site);
  const groupeParClient = groupeParClientActif(params.groupe);
  const page = schemaPage.parse(
    typeof params.page === "string" ? params.page : undefined,
  );
  // LE FILTRE NE BORNE QUE L'AFFICHAGE, jamais le résumé ci-dessus : les
  // cinq KPI continuent de compter TOUT le registre, filtre ou non — la
  // même règle que `/tableau-de-bord` applique déjà à ses propres priorités
  // (`elementsFiltres`, appliqué en DERNIER, sur la liste déjà composée).
  const lignesFiltreesParEtat =
    filtre === "depassees"
      ? toutesLesLignes.filter((ligne) => echeanceDepassee(ligne.information))
      : filtre === "a_venir"
        ? toutesLesLignes.filter((ligne) =>
            echeanceEstAVenir(ligne.information),
          )
        : filtre === "sans_information"
          ? toutesLesLignes.filter((ligne) =>
              estSansInformation(ligne.information),
            )
          : toutesLesLignes;
  // LES FILTRES CLIENT ET SITE (D122) — un IDENTIFIANT, jamais une seconde
  // lecture du nom affiché ; combinables entre eux et avec `etat`/`q`, comme
  // les trois filtres de `/parc` (`filtreDuParc`, `lib/machines/depot.ts`).
  const lignesFiltreesParClientEtSite = lignesFiltreesParEtat
    .filter((ligne) => clientFiltre === null || ligne.clientId === clientFiltre)
    .filter((ligne) => siteFiltre === null || ligne.siteId === siteFiltre);
  const lignesFiltrees = lignesFiltreesParClientEtSite.filter((ligne) =>
    rechercheCorrespond(ligne, recherche),
  );
  // LE TRI PAR URGENCE (VGP-4) — dépassées les plus anciennes d'abord, puis
  // les échéances à venir les plus proches ; voir `trierParUrgence`
  // (lib/vgp/registre.ts). Appliqué APRÈS les filtres, jamais avant : trier
  // puis PAGINER (TP-A2) donne les lignes les plus urgentes de CE QUI EST
  // FILTRÉ, page par page, plutôt qu'un plafond d'affichage muet.
  const lignesTriees = trierParUrgence(lignesFiltrees);
  const totalPages = Math.max(
    1,
    Math.ceil(lignesTriees.length / LIMITE_RECHERCHE_PAR_DEFAUT),
  );
  const lignes = lignesTriees.slice(
    (page - 1) * LIMITE_RECHERCHE_PAR_DEFAUT,
    page * LIMITE_RECHERCHE_PAR_DEFAUT,
  );

  // LE REGROUPEMENT « PAR CLIENT » (MO-12, UX9-c) — sur TOUT ce qui est
  // FILTRÉ et TRIÉ, jamais sur la seule page : imprimer le dossier d'un
  // client ne doit pas s'arrêter à la cinquantième ligne affichée. Aucune
  // pagination dans ce mode — la même raison que `/vgp/a-determiner` n'en
  // porte pas davantage pour une liste de familles.
  const groupes = groupeParClient
    ? regrouperRegistreParClient(lignesTriees)
    : [];

  // LE FILTRE SITE DÉPEND DU CLIENT CHOISI (D122) — les options affichées
  // se restreignent au client filtré, sans jamais toucher à la POPULATION
  // cloisonnée que `optionsDeFiltreDuRegistre` a déjà lue.
  const sitesOptions =
    clientFiltre === null
      ? options.sites
      : options.sites.filter((site) => site.clientId === clientFiltre);
  const clientsTries = trierAlphanumeriquement(
    options.clients,
    (c) => c.libelle,
  );
  const sitesTries = trierAlphanumeriquement(
    sitesOptions,
    (s) => s.client,
    (s) => s.libelle,
  );

  // LES PARAMÈTRES PORTÉS D'UN LIEN À L'AUTRE (D122, MO-12) — client, site et
  // groupe survivent à la pagination et à la recherche, comme `etat` le fait
  // déjà ; composés UNE fois, pour que pagination et champs cachés du
  // formulaire ne divergent pas (§9, 01/09).
  const parametresPersistants = {
    q: recherche === "" ? undefined : recherche,
    etat: filtre === "tous" ? undefined : filtre,
    client: clientFiltre ?? undefined,
    site: siteFiltre ?? undefined,
    groupe: groupeParClient ? "client" : undefined,
  };

  const colonnes = [
    { cle: "machine", libelle: t("vgp.colonne_machine"), largeur: "160px" },
    { cle: "client", libelle: t("vgp.colonne_client"), largeur: "150px" },
    {
      cle: "dernier_controle",
      libelle: t("vgp.colonne_dernier_controle"),
      largeur: "110px",
    },
    {
      cle: "echeance",
      libelle: t("vgp.colonne_echeance"),
      largeur: "160px",
    },
    { cle: "etat", libelle: t("vgp.colonne_etat"), largeur: "220px" },
    { cle: "action", libelle: t("vgp.colonne_action"), largeur: "90px" },
  ];

  const onglets: readonly EtatOnglet[] = [
    { libelle: t("vgp.onglet.registre"), href: "/vgp", actif: true },
    {
      libelle: t("vgp.indetermines.titre"),
      href: "/vgp/a-determiner",
      compte: indetermines.length,
    },
  ];

  return (
    <Page
      chemin="/vgp"
      titre={t("vgp.titre")}
      sousTitre={t("vgp.sous_titre")}
      actions={
        contexte.role !== null && peut(contexte.role, "importer_exporter") ? (
          <a
            href={hrefExportRegistre({
              etat: filtre,
              texte: recherche,
              clientId: clientFiltre,
              siteId: siteFiltre,
            })}
            className={CLASSES_LIEN}
          >
            {t("export.bouton")}
          </a>
        ) : undefined
      }
    >
      {/*
        LES ONGLETS (QE-13d (a), D166) — ÉCART NOMMÉ à D125 : `vgp()` de la
        maquette ne dessine aucun onglet pour cet écran. Réduits à ce qui
        EXISTE — « Registre » (cette page) et « Familles à déterminer »
        (inchangé) — jamais « Réserves », qui n'existe pas encore (lot
        suivant, avec migration).
      */}
      <Onglets libelleAria={t("vgp.titre")} elements={onglets} />

      {/*
        LES QUATRE KPI DE `vgp()` (D125), PLUS UN CINQUIÈME (TP-A2) — le
        troisième est un ÉCART VOLONTAIRE de CONTENU : voir l'en-tête de ce
        fichier et tests/unit/ui/lot-a5-a7.test.ts, qui nomme cet écart. Le
        cinquième, « Sans information », est un ÉCART VOLONTAIRE DANS
        L'AUTRE SENS : D125 n'en dessine que quatre, D88 §2 l'exige quand
        même — voir l'en-tête.

        TUILES CLIQUABLES, SANS LIEN DOUBLON (D140, D144, D166) — les trois
        tuiles datées portent désormais leur propre `href` (D140) ; le lien
        texte qui les suivait disparaît (D144, même défaut que les tuiles du
        tableau de bord et du registre des interventions). Les deux autres
        (« Informations reçues », « À déterminer ») restent inertes : aucune
        liste de ce registre ne compte EXACTEMENT ce qu'elles affichent — la
        même exception que D140 réserve déjà à un décompte sans liste à
        ouvrir.
      */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <div data-bloc="kpi-sous-30-jours">
          <Kpi
            ton="orange"
            libelle={t("vgp.kpi_echeance_a_venir")}
            valeur={resume.echeanceAVenir}
            detail={t("vgp.kpi_echeance_a_venir_detail")}
            href="/vgp?etat=a_venir"
          />
        </div>
        <div data-bloc="kpi-en-retard">
          <Kpi
            ton="rouge"
            libelle={t("vgp.kpi_en_retard")}
            valeur={resume.echeanceDepassee}
            detail={t("vgp.kpi_en_retard_detail")}
            href="/vgp?etat=depassees"
          />
        </div>
        <div data-bloc="kpi-informations-recues">
          <Kpi
            ton="vert"
            libelle={t("vgp.kpi_informations_recues")}
            valeur={resume.informationRecue}
            detail={t("vgp.kpi_informations_recues_detail")}
          />
        </div>
        <div data-bloc="kpi-a-determiner">
          <Kpi
            libelle={t("vgp.regime.a_determiner")}
            valeur={machinesADeterminer}
            detail={t("vgp.kpi_a_determiner_detail")}
          />
        </div>
        <div data-bloc="kpi-sans-information">
          <Kpi
            ton="orange"
            libelle={t("vgp.information.sans_information")}
            valeur={resume.sansInformation}
            detail={t("vgp.kpi_sans_information_detail")}
            href="/vgp?etat=sans_information"
          />
        </div>
      </div>

      {/*
        LE COMPTE DES INDÉTERMINÉS EST UN LIEN, jamais un simple chiffre : *sans
        la liste visible, la troisième valeur ne sert à rien* (D88 §3). Zéro
        famille indéterminée n'efface pas le lien — il dirait alors que la
        question ne se pose plus, ce qui est faux : une famille créée demain y
        revient.
      */}
      <Link
        href="/vgp/a-determiner"
        data-bloc="bandeau-indetermines"
        className="border-app-orange-bord bg-app-orange-fond text-app-orange-encre rounded-md border px-3.5 py-2.5 text-13 font-bold underline underline-offset-2"
      >
        {indetermines.length}{" "}
        {t(
          indetermines.length === 1
            ? "vgp.indetermines.lien_une"
            : "vgp.indetermines.lien",
        )}
      </Link>

      <p className="text-app-encre-faible max-w-[80ch] text-12 font-bold">
        {t("vgp.information.ce_que_le_silence_dit")}
      </p>

      {/* LA RECHERCHE EST UN FORMULAIRE `GET` (VGP-4, 25/09/2026) — même
          contrat que `/sites` et `/parc` : elle s'écrit dans l'URL, donc elle
          se partage et se recharge, sans état client à tenir. Le filtre
          `etat` en cours, s'il y en a un, est porté par un champ CACHÉ : une
          recherche lancée depuis `?etat=depassees` ne doit pas le perdre.

          LES FILTRES CLIENT ET SITE (D122, TP-VGP) — deux `<select>`, jamais
          des pastilles cliquables (D122, « la seconde maquette »). Le site
          DÉPEND du client choisi : `sitesTries` ne liste déjà que les sites
          du client filtré (voir plus haut) — changer de client, soumettre,
          retrouve un second `<select>` restreint. `groupe` voyage en champ
          caché, comme `etat` : une recherche lancée en vue groupée ne doit
          pas en sortir. */}
      <form
        method="get"
        className="bg-app-surface border-app-bord flex flex-wrap items-end gap-3 rounded-lg border px-4 py-3.5"
      >
        {filtre === "tous" ? null : (
          <input type="hidden" name="etat" value={filtre} />
        )}
        {groupeParClient ? (
          <input type="hidden" name="groupe" value="client" />
        ) : null}
        <label className="flex flex-col gap-1 text-[12px] font-bold">
          {t("vgp.recherche")}
          <input
            type="search"
            name="q"
            defaultValue={recherche}
            className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
          />
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-bold">
          {t("vgp.filtre_client.libelle")}
          <select
            name="client"
            defaultValue={clientFiltre ?? ""}
            className="border-app-bord bg-app-surface h-[34px] w-[150px] truncate rounded-md border px-2 text-[13px] font-bold"
          >
            <option value="">{t("vgp.filtre_client.tous")}</option>
            {clientsTries.map((option) => (
              <option key={option.id} value={option.id}>
                {option.libelle}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-bold">
          {mot("site")}
          <select
            name="site"
            defaultValue={siteFiltre ?? ""}
            className="border-app-bord bg-app-surface h-[34px] w-[150px] truncate rounded-md border px-2 text-[13px] font-bold"
          >
            <option value="">{t("vgp.filtre_site.tous")}</option>
            {sitesTries.map((option) => (
              <option key={option.id} value={option.id}>
                {libelleClientSite(option.client, option.libelle)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="border-app-bord rounded-md border px-4 py-2 text-[13px] font-bold"
        >
          {t("vgp.rechercher")}
        </button>
      </form>

      {filtre === "tous" ? null : (
        <p data-bloc="filtre-actif" className="text-12 font-bold">
          <span className="text-app-encre-faible">
            {t(libelleFiltreActif(filtre))}
          </span>{" "}
          <Link href="/vgp" className={CLASSES_LIEN}>
            {t("vgp.filtre_retirer")}
          </Link>
        </p>
      )}

      {/* L'INTERRUPTEUR « GROUPER PAR CLIENT » (MO-12, UX9-c, D166) — un
          lien `GET`, comme tout le reste de cet écran : aucun état client à
          tenir. Les autres filtres (`q`, `etat`, `client`, `site`) survivent
          au basculement, dans un sens comme dans l'autre. */}
      <p data-bloc="bascule-groupe" className="text-13 font-bold">
        {groupeParClient ? (
          <Link
            href={hrefDeLaPage(
              "/vgp",
              { ...parametresPersistants, groupe: undefined },
              page,
            )}
            className={CLASSES_LIEN}
          >
            {t("vgp.groupe.desactiver")}
          </Link>
        ) : (
          <Link
            href={hrefDeLaPage(
              "/vgp",
              { ...parametresPersistants, groupe: "client" },
              1,
            )}
            className={CLASSES_LIEN}
          >
            {t("vgp.groupe.activer")}
          </Link>
        )}
      </p>

      {groupeParClient ? (
        <div data-bloc="groupes-registre" className="flex flex-col gap-4">
          {groupes.length === 0 ? (
            <p className="text-app-encre-faible text-13 font-bold">
              {t(etatVideDuRegistreVgp({ filtre, recherche }))}
            </p>
          ) : (
            groupes.map((groupe) => (
              <GroupeClientRegistre
                key={groupe.clientId}
                groupe={groupe}
                raisonSocialeSociete={societe?.raison_sociale ?? ""}
                aujourdHuiAffiche={dateCivile(aujourdHui)}
              />
            ))
          )}
        </div>
      ) : (
        <>
          <section
            data-bloc="tableau-registre"
            className="bg-app-surface border-app-bord overflow-hidden rounded-lg border"
          >
            <div data-bloc="colonnes-registre" className="contents">
              <Tableau colonnes={colonnes} minimum="890px">
                {lignes.length === 0 ? (
                  <LignePleine colonnes={colonnes.length}>
                    {t(etatVideDuRegistreVgp({ filtre, recherche }))}
                    {filtre === "tous" && recherche.trim() === "" ? null : (
                      <>
                        {" "}
                        <Link href="/vgp" className={CLASSES_LIEN}>
                          {t("vgp.filtre_retirer")}
                        </Link>
                      </>
                    )}
                  </LignePleine>
                ) : null}
                {lignes.map((ligne) => (
                  <LigneRegistre key={ligne.id} ligne={ligne} />
                ))}
              </Tableau>
            </div>
          </section>

          <Pagination
            page={page}
            totalPages={totalPages}
            libelleResultats={decompte(
              lignesTriees.length,
              t("parc.total_un"),
              t("parc.total"),
            )}
            libellePage={libellePage(page, totalPages)}
            libellePrecedent={t("pagination.precedent")}
            libelleSuivant={t("pagination.suivant")}
            hrefPage={(p) => hrefDeLaPage("/vgp", parametresPersistants, p)}
          />
        </>
      )}

      <p className="text-app-encre-faible text-12 font-bold">
        {t("vgp.borne")}
      </p>
    </Page>
  );
}

/**
 * LE LIEN D'EXPORT (MO-9, D169) — mêmes paramètres d'adresse que `/vgp`
 * lui-même, `groupe` et `page` exclus : l'export n'en pagine aucun et ne
 * change aucune colonne selon le regroupement par client.
 */
function hrefExportRegistre(parametres: {
  readonly etat: EtatFiltre;
  readonly texte: string;
  readonly clientId: string | null;
  readonly siteId: string | null;
}): string {
  const recherche = new URLSearchParams();
  if (parametres.etat !== "tous") {
    recherche.set("etat", parametres.etat);
  }
  if (parametres.texte !== "") {
    recherche.set("q", parametres.texte);
  }
  if (parametres.clientId !== null) {
    recherche.set("client", parametres.clientId);
  }
  if (parametres.siteId !== null) {
    recherche.set("site", parametres.siteId);
  }
  const chaine = recherche.toString();
  return `/api/vgp/exporter${chaine.length > 0 ? `?${chaine}` : ""}`;
}

/** Le texte du bandeau de filtre actif — trois voies, UNE seule fonction (TP-A2). */
function libelleFiltreActif(
  filtre: Exclude<EtatFiltre, "tous">,
):
  | "vgp.filtre_depassees_actif"
  | "vgp.filtre_a_venir_actif"
  | "vgp.filtre_sans_information_actif" {
  if (filtre === "depassees") {
    return "vgp.filtre_depassees_actif";
  }
  if (filtre === "a_venir") {
    return "vgp.filtre_a_venir_actif";
  }
  return "vgp.filtre_sans_information_actif";
}

/**
 * « Marque référence » (PV-37, D166) — même composition que `titreDeLaLigne`
 * de `/parc` (`app/(back-office)/parc/page.tsx`), recopiée plutôt
 * qu'importée (la même retenue que ce fichier assume déjà pour
 * `rythmeAffiche`) : le registre n'affichait jamais le modèle d'une machine,
 * alors que la recherche le lisait déjà (`rechercheCorrespond`).
 */
function referenceMachineAffichee(ligne: LigneDeRegistre): string {
  return `${ligne.marque} ${ligne.modele}`;
}

function LigneRegistre({ ligne }: { readonly ligne: LigneDeRegistre }) {
  const depart = departSousLigne(ligne);
  return (
    <tr>
      <Cellule mono>
        <Link href={`/parc/${ligne.id}`} className={CLASSES_LIEN}>
          {ligne.numero_serie}
        </Link>
        <span className="text-app-encre-faible mt-[3px] block font-sans text-12 font-bold break-words">
          {referenceMachineAffichee(ligne)}
        </span>
        <span className="text-app-encre-faible mt-[3px] block font-sans text-12 font-bold break-words">
          {ligne.famille}
        </span>
      </Cellule>
      <Cellule>
        {ligne.client}
        <span className="text-app-encre-faible mt-[3px] block text-12 font-bold break-words">
          {ligne.site}
        </span>
      </Cellule>
      <Cellule>{dernierControleAffiche(ligne)}</Cellule>
      <Cellule>{echeanceAffichee(ligne)}</Cellule>
      <Cellule>
        <Badge ton={tonEtat(ligne.information)}>
          {libelleEtatCourt(ligne.information)}
        </Badge>
        {depart === null ? null : (
          <span className="text-app-encre-faible mt-[3px] block text-12 font-bold break-words">
            {depart}
          </span>
        )}
        {/*
          LE MOTIF (régime · origine · rythme) EN INFOBULLE, jamais SUPPRIMÉ
          (lot PERF, mesuré sur 4fead41) : affiché sur chaque ligne, il
          répétait jusqu'à cinq lignes de texte une fois enveloppé, et une
          table cesse d'être une table quand chaque cellule porte un
          paragraphe. `<details>/<summary>` est une DIVULGATION NATIVE — repliée
          par défaut, sans JavaScript, sans composant partagé neuf : le motif
          reste à UN CLIC, jamais retiré du registre (l'esprit de D88).
        */}
        <details className="mt-[3px]">
          <summary className="text-app-encre-faible cursor-pointer text-12 font-bold underline decoration-dotted">
            {t("vgp.etat_ligne.voir_motif")}
          </summary>
          <span className="text-app-encre-faible mt-[3px] block text-12 font-bold break-words">
            {regimeExplique(ligne)}
          </span>
        </details>
      </Cellule>
      <Cellule>
        <ActionEnregistrer ligne={ligne} />
      </Cellule>
    </tr>
  );
}

/**
 * L'ACTION « ENREGISTRER », SELON LE RÉGIME (TP-A2, PV-33) — `soumis` propose
 * le lien ; `a_determiner` le propose AUSSI, avec un avertissement (décision
 * d'Alexis, 29/09/2026) ; tout le reste le MASQUE. `enregistrementPropose`
 * lit `ligne.assujettissement`, la valeur RÉSOLUE — jamais la seule famille.
 */
function ActionEnregistrer({ ligne }: { readonly ligne: LigneDeRegistre }) {
  const decision = enregistrementPropose(ligne);
  if (decision === "masque") {
    return null;
  }
  return (
    <>
      <Link
        href={`/vgp/enregistrer/${ligne.id}`}
        className="border-app-bord rounded-md border px-2.5 py-1 text-[12px] font-bold whitespace-nowrap"
      >
        {t("vgp.action_enregistrer")}
      </Link>
      {decision === "propose_avec_avertissement" ? (
        <span className="text-app-encre-faible mt-[3px] block text-12 font-bold break-words">
          {t("vgp.enregistrer_a_determiner")}
        </span>
      ) : null}
    </>
  );
}

/**
 * LE RYTHME, AVEC LE NIVEAU QUI L'A FIXÉ ET LE TEXTE QUI LE FONDE.
 *
 * *Sans le texte, la périodicité est un chiffre que personne ne peut défendre*
 * (D88 §4). Aucune durée n'est écrite ici : le nombre de mois vient de la
 * donnée saisie, et « aucun rythme déclaré » est un libellé, pas un zéro.
 */
function regimeExplique(ligne: LigneDeRegistre): string {
  // La chaîne est composée ICI et non dans le JSX : `react/jsx-no-literals`
  // refuse le moindre texte dans un composant, et il a raison — *aucune chaîne
  // en dur dans un composant* (§5 du CLAUDE.md). Le séparateur en est une.
  return `${t(`vgp.regime.${ligne.assujettissement}`)} · ${t(`vgp.origine.${ligne.origine}`)} · ${rythmeAffiche(ligne)}`;
}

function rythmeAffiche(ligne: LigneDeRegistre): string {
  if (ligne.periodiciteMois === null || ligne.originePeriodicite === null) {
    return t("vgp.periodicite.aucune");
  }
  const provenance = t(`vgp.periodicite.${ligne.originePeriodicite}`);
  const texte =
    ligne.referenceTexte === null ? "" : ` · ${ligne.referenceTexte}`;
  return `${ligne.periodiciteMois} mois — ${provenance}${texte}`;
}

/**
 * UN GROUPE « PAR CLIENT » (MO-12, UX9-c, D166) — la MÊME carte sert l'écran
 * et l'impression (même principe que `zone-impression-bon`,
 * `app/(back-office)/interventions/[id]/bon/page.tsx`) : `data-zone-
 * impression-vgp` porte l'identifiant du client, et `ImprimerRegistreVgp`
 * (`components/vgp/impression-registre.tsx`) s'en sert pour isoler CE SEUL
 * groupe à l'impression, parmi plusieurs rendus sur le même écran.
 *
 * **Colonnes réduites** — Machine, Site, Dernier contrôle, Échéance, État —
 * la colonne Client disparaît (le groupe la porte déjà dans son en-tête) et
 * l'Action disparaît aussi : un document remis à un client ne porte pas de
 * bouton. **Sans réserves** (lot suivant, avec migration).
 */
function GroupeClientRegistre({
  groupe,
  raisonSocialeSociete,
  aujourdHuiAffiche,
}: {
  readonly groupe: GroupeDeRegistreParClient;
  readonly raisonSocialeSociete: string;
  readonly aujourdHuiAffiche: string;
}) {
  const colonnes = [
    { cle: "machine", libelle: t("vgp.colonne_machine"), largeur: "160px" },
    { cle: "site", libelle: mot("site"), largeur: "150px" },
    {
      cle: "dernier_controle",
      libelle: t("vgp.colonne_dernier_controle"),
      largeur: "110px",
    },
    {
      cle: "echeance",
      libelle: t("vgp.colonne_echeance"),
      largeur: "160px",
    },
    { cle: "etat", libelle: t("vgp.colonne_etat"), largeur: "220px" },
  ];
  return (
    <section
      data-zone-impression-vgp={groupe.clientId}
      className="zone-impression-vgp bg-app-surface border-app-bord flex flex-col gap-3 rounded-lg border p-4"
    >
      <header className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <h2 className="text-14 font-extrabold">{groupe.client}</h2>
          <p className="text-app-encre-faible text-12 font-bold">
            {decompte(
              groupe.lignes.length,
              t("parc.total_un"),
              t("parc.total"),
            )}
          </p>
        </div>
        <ImprimerRegistreVgp clientId={groupe.clientId} />
      </header>

      {/* L'EN-TÊTE DU DOCUMENT IMPRIMÉ (MO-12) — société émettrice, client,
          date du jour ; masquée à l'écran (`print:block hidden`), comme le
          bouton ci-dessus l'est à l'impression (le symétrique exact). */}
      <header className="border-app-bord hidden flex-col gap-1 border-b pb-2 print:flex">
        <h1 className="text-16 font-extrabold">{raisonSocialeSociete}</h1>
        <p className="text-13 font-bold">{t("vgp.titre")}</p>
        <p className="text-app-encre-faible text-12 font-bold">
          {t("vgp.impression.client")} {groupe.client}
        </p>
        <p className="text-app-encre-faible text-12 font-bold">
          {t("vgp.impression.edite_le")} {aujourdHuiAffiche}
        </p>
      </header>

      <Tableau colonnes={colonnes} minimum="760px">
        {groupe.lignes.map((ligne) => (
          <LigneGroupeClient key={ligne.id} ligne={ligne} />
        ))}
      </Tableau>
    </section>
  );
}

/** Une ligne de l'impression par client (MO-12) — cinq colonnes, sans action. */
function LigneGroupeClient({ ligne }: { readonly ligne: LigneDeRegistre }) {
  return (
    <tr>
      <Cellule mono>
        {ligne.numero_serie}
        <span className="text-app-encre-faible mt-[3px] block font-sans text-12 font-bold break-words">
          {referenceMachineAffichee(ligne)}
        </span>
      </Cellule>
      <Cellule>{ligne.site}</Cellule>
      <Cellule>{dernierControleAffiche(ligne)}</Cellule>
      <Cellule>{echeanceAffichee(ligne)}</Cellule>
      <Cellule>
        <Badge ton={tonEtat(ligne.information)}>
          {libelleEtatCourt(ligne.information)}
        </Badge>
      </Cellule>
    </tr>
  );
}
