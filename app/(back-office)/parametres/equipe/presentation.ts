import type { EtatAcces } from "@/lib/auth/acces-technicien";
import type { Fuseau, JourLocal } from "@/lib/calendar/fuseau";
import { dateCivile, versLocal } from "@/lib/calendar/fuseau";
import type { LigneAttribution } from "@/lib/habilitations/depot";
import { t } from "@/lib/i18n/fr";

import type { TonBadge } from "@/components/ui/badge";

/**
 * CE QUE L'ÉCRAN AFFICHE — jamais une décision de blocage.
 *
 * Extraite de `page.tsx` (D-13) : un `page.tsx` de l'App Router n'accepte que
 * les exports que Next.js reconnaît (`default`, `metadata`, …) — mesuré à la
 * compilation, `pnpm build` refuse `estExpiree` exportée depuis la page avec
 * « n'est pas un champ d'export de Page valide ». Même raisonnement que
 * `referenceAffichee` dans `app/(back-office)/interventions/presentation.ts` :
 * un fichier voisin, pas un composant, pour que la fonction reste testable
 * sans navigateur.
 *
 * **Le jugement « expirée » compare le jour LOCAL, jamais le jour UTC** — la
 * portée est l'affichage, et seulement lui. `lib/habilitations/affectation.ts`
 * (RG-PLA-04) ne dérive rien de « maintenant » : il compare à la date de
 * l'intervention, et cette fonction ne le remplace jamais.
 */
export function estExpiree(
  attribution: LigneAttribution,
  aujourdHui: JourLocal,
): boolean {
  if (attribution.date_expiration === null) {
    return false;
  }
  const expiration = Date.UTC(
    attribution.date_expiration.getUTCFullYear(),
    attribution.date_expiration.getUTCMonth(),
    attribution.date_expiration.getUTCDate(),
  );
  const jourCourant = Date.UTC(
    aujourdHui.annee,
    aujourdHui.mois - 1,
    aujourdHui.jour,
  );
  return expiration < jourCourant;
}

/** LE DÉLAI DE RENOUVELLEMENT — J-60 (CDC §16.1, `docs/cahier-des-charges.md:1267-1285`). */
const JOURS_RENOUVELLEMENT_HABILITATION = 60;

/**
 * « À RENOUVELER (60 J) » — sœur d'`estExpiree`, pour le tableau de bord de
 * l'administrateur (9EG-TP-UX6-TABLEAU-DE-BORD-2). **Jamais une habilitation
 * déjà expirée** — les deux jugements sont deux compartiments disjoints, pas
 * un sous-ensemble l'un de l'autre.
 */
export function estARenouveler60Jours(
  attribution: LigneAttribution,
  aujourdHui: JourLocal,
): boolean {
  if (attribution.date_expiration === null) {
    return false;
  }
  const MS_PAR_JOUR = 24 * 60 * 60 * 1000;
  const expiration = Date.UTC(
    attribution.date_expiration.getUTCFullYear(),
    attribution.date_expiration.getUTCMonth(),
    attribution.date_expiration.getUTCDate(),
  );
  const jourCourant = Date.UTC(
    aujourdHui.annee,
    aujourdHui.mois - 1,
    aujourdHui.jour,
  );
  const joursRestants = Math.round((expiration - jourCourant) / MS_PAR_JOUR);
  return (
    joursRestants >= 0 && joursRestants <= JOURS_RENOUVELLEMENT_HABILITATION
  );
}

/**
 * LE TAG D'UNE HABILITATION, DANS LE TABLEAU DE L'ONGLET TECHNICIENS (point 2,
 * maquette `habTag`, `maquette-toutes-pages.html:4627`) — jamais le libellé
 * complet, seulement le CODE : « <CODE> · expirée le JJ/MM/AAAA » (rouge),
 * « <CODE> · expire le JJ/MM/AAAA » (orange, ≤ 60 jours), « <CODE> · jusqu'au
 * JJ/MM/AAAA » (neutre), « <CODE> · n'expire pas » (neutre, date nulle).
 * Distinct de `BlocHabilitations`, qui garde le libellé complet dans le
 * `<details>` de modification.
 */
export function texteTagHabilitation(
  attribution: LigneAttribution,
  aujourdHui: JourLocal,
): string {
  const SEPARATEUR = " · ";
  if (attribution.date_expiration === null) {
    return `${attribution.code}${SEPARATEUR}${t("equipe.tableau.habilitation.nexpire_pas")}`;
  }
  const date = dateCivile(attribution.date_expiration);
  if (estExpiree(attribution, aujourdHui)) {
    return `${attribution.code}${SEPARATEUR}${t("equipe.tableau.habilitation.expiree_prefixe")} ${date}`;
  }
  if (estARenouveler60Jours(attribution, aujourdHui)) {
    return `${attribution.code}${SEPARATEUR}${t("equipe.tableau.habilitation.expire_prefixe")} ${date}`;
  }
  return `${attribution.code}${SEPARATEUR}${t("equipe.tableau.habilitation.jusquau_prefixe")} ${date}`;
}

/** Le ton du tag — rouge (expirée), orange (≤ 60 jours), gris sinon. */
export function tonTagHabilitation(
  attribution: LigneAttribution,
  aujourdHui: JourLocal,
): TonBadge {
  if (estExpiree(attribution, aujourdHui)) {
    return "rouge";
  }
  if (estARenouveler60Jours(attribution, aujourdHui)) {
    return "orange";
  }
  return "gris";
}

/**
 * LE PRÉNOM — le premier mot d'un nom (point 3, D86) : le dialogue « Nouveau
 * lien » s'adresse à la personne par son prénom (« <prénom> choisit un
 * nouveau mot de passe »), comme la maquette (`x.nom.split(" ")[0]`). Sœur
 * de `dernierMot` (`lib/tri/collation.ts`), qui prend le DERNIER mot pour le
 * tri — aucun champ « prénom » dédié n'existe non plus.
 */
export function premierMot(nom: string): string {
  const mots = nom
    .trim()
    .split(/\s+/)
    .filter((mot) => mot.length > 0);
  return mots.length === 0 ? nom : mots[0];
}

/**
 * « N intervention(s) », SANS le suffixe « à venir » (point 2) — la colonne
 * du tableau s'appelle déjà « À venir » ; `decompteInterventionsAVenir`
 * (`page.tsx`), elle, le garde pour la fiche de modification où le contexte
 * ne le dit pas déjà.
 */
export function decompteInterventions(nombre: number): string {
  return `${nombre} ${
    nombre === 1 ? t("equipe.tableau.a_venir_un") : t("equipe.tableau.a_venir")
  }`;
}

/**
 * « À VENIR : N INTERVENTION(S)[, SANS ACCÈS À L'APPLICATION] » — la carte
 * sous 900 px (point 4, maquette `aVenirCell` adaptée à la carte, `rowTech.
 * card.meta`) ; `etatActif` vient de `etat.etat === "actif"`.
 */
export function phraseAVenirCarte(nombre: number, etatActif: boolean): string {
  const compte =
    nombre === 0 ? t("equipe.tableau.aucune") : decompteInterventions(nombre);
  const suffixe =
    !etatActif && nombre > 0
      ? `, ${t("equipe.tableau.sans_acces_application")}`
      : "";
  return `${t("equipe.tableau.a_venir_prefixe")} ${compte}${suffixe}`;
}

/**
 * LA CIBLE D'UN BANDEAU « LIEN ENVOYÉ »/« NON PARTI » EST-ELLE CONNUE ?
 * (SOLDE 182, relecture de 9ET-COMPTES-BUREAU-2) — un envoi déclenché depuis
 * la fiche d'un TECHNICIEN nomme sa cible `technicien` (`/api/equipe/[id]/
 * envoyer-acces`), un envoi déclenché depuis l'onglet « Comptes de bureau »
 * la nomme `compte` (`/api/equipe/bureau/[id]/envoyer-acces`) — DEUX chemins,
 * jamais le même paramètre. Avant ce correctif, l'écran ne reconnaissait que
 * `technicien` : le bandeau d'un envoi depuis l'onglet bureau restait
 * invisible, motif compris dans l'URL mais jamais affiché.
 */
export function cibleAccesConnue(
  technicienId: string | undefined,
  compteBureauId: string | undefined,
  techniciens: readonly { readonly utilisateurId: string }[],
  comptesBureau: readonly { readonly utilisateurId: string }[],
): boolean {
  return (
    (technicienId !== undefined &&
      techniciens.some((t) => t.utilisateurId === technicienId)) ||
    (compteBureauId !== undefined &&
      comptesBureau.some((c) => c.utilisateurId === compteBureauId))
  );
}

/**
 * UN INSTANT, EN « JJ/MM à HH:MM » LOCAL — l'état d'accès d'un technicien
 * (D162, 9DJ-TP-ACC1-DONNER-ACCES).
 *
 * Un événement d'accès (`journal_acces.horodatage`) est un INSTANT, pas un
 * jour civil : `dateCivile` ne convient pas, voir `dateHeureLocale` de
 * `app/(back-office)/interventions/presentation.ts`, dont cette fonction est
 * la variante SANS année — le ticket ne demande que « JJ/MM à HH:MM ».
 */
export function dateHeureCourte(instant: Date, fuseau: Fuseau): string {
  const local = versLocal(instant, fuseau);
  const jour = String(local.jour).padStart(2, "0");
  const mois = String(local.mois).padStart(2, "0");
  const heures = String(local.heures).padStart(2, "0");
  const minutes = String(local.minutes).padStart(2, "0");
  return `${jour}/${mois} à ${heures}:${minutes}`;
}

/**
 * LE LIBELLÉ COURT D'UN ÉTAT D'ACCÈS (badge) — `EtatAcces` et
 * `EtatAccesBureau` (`lib/auth/acces-bureau.ts`) sont structurellement
 * identiques (9EXA, point 2) : une seule fonction pour les deux, jamais deux
 * copies qui pourraient diverger.
 */
export function libelleEtatAccesCourt(etat: EtatAcces): string {
  switch (etat.etat) {
    case "actif":
      return t("equipe.acces.badge.actif");
    case "lien_expire":
      return t("equipe.acces.badge.lien_expire");
    case "lien_envoye":
      return t("equipe.acces.badge.lien_envoye");
    case "aucun":
      return t("equipe.acces.badge.aucun");
  }
}

/**
 * L'ALERTE « N PERSONNE(S) NE PEUVENT PAS ENCORE SE CONNECTER » (point 2,
 * maquette `maquette-toutes-pages.html:4678`) — composée hors du JSX, aucun
 * nombre au dictionnaire (D26).
 */
export function titreAlerteAccesAOuvrir(nombre: number): string {
  return `${nombre} ${
    nombre === 1 ? t("equipe.alerte.titre_un") : t("equipe.alerte.titre")
  }`;
}

/** « Voir les N » / « Voir la personne » (N = 1) — le lien de l'alerte. */
export function libelleVoirAccesAOuvrir(nombre: number): string {
  return nombre === 1
    ? t("equipe.alerte.voir_un")
    : `${t("equipe.alerte.voir")} ${nombre}`;
}

/** Le titre du dialogue « Tout envoyer » (maquette `:4699-4703`). */
export function titreDialogueToutEnvoyer(nombre: number): string {
  return nombre === 1
    ? t("equipe.dialogue.tout_envoyer.titre_un")
    : `${t("equipe.dialogue.tout_envoyer.titre_prefixe")} ${nombre} ${t("equipe.dialogue.tout_envoyer.titre_suffixe")}`;
}

/** Le bouton « Envoyer les N liens » / « Envoyer le lien » (N = 1). */
export function boutonToutEnvoyer(nombre: number): string {
  return nombre === 1
    ? t("equipe.dialogue.tout_envoyer.bouton_un")
    : `${t("equipe.dialogue.tout_envoyer.bouton_prefixe")} ${nombre} ${t("equipe.dialogue.tout_envoyer.bouton_suffixe")}`;
}

/** Le bandeau de retour après « Tout envoyer » — tout parti, sans échec. */
export function libelleToutEnvoye(nombre: number): string {
  return `${nombre} ${
    nombre === 1
      ? t("equipe.acces.tous_envoyes.un")
      : t("equipe.acces.tous_envoyes.plusieurs")
  }`;
}

/** Le bandeau de retour après « Tout envoyer » — avec au moins un échec. */
export function libelleToutEnvoyeAvecEchecs(
  partis: number,
  echecs: number,
): string {
  const partisTexte = libelleToutEnvoye(partis);
  const echecsTexte = `${echecs} ${
    echecs === 1
      ? t("equipe.acces.tous_envoyes.echec_un")
      : t("equipe.acces.tous_envoyes.echec")
  }`;
  return `${partisTexte}, ${echecsTexte}`;
}

/**
 * UNE LIGNE DU DIALOGUE « TOUT ENVOYER » — « <nom> — <courriel> — <état en
 * minuscules> » (point 1) — composée hors du JSX (L0-11), jamais un texte
 * assemblé dans le rendu.
 */
export function ligneDialogueToutEnvoyer(personne: {
  readonly nom: string;
  readonly email: string;
  readonly etat: EtatAcces;
}): string {
  const separateur = t("ponctuation.separateur");
  return `${personne.nom}${separateur}${personne.email}${separateur}${libelleEtatAccesCourt(personne.etat).toLowerCase()}`;
}

/** « Renouveler <CODE> » — le lien-bouton d'une habilitation expirée. */
export function libelleRenouvelerHabilitation(code: string): string {
  return `${t("habilitations.renouveler")} ${code}`;
}

/** Le titre du dialogue « Renouveler <CODE> — <nom> » (point 3). */
export function titreDialogueRenouveler(code: string, nom: string): string {
  return `${t("habilitations.renouveler")} ${code}${t("ponctuation.separateur")}${nom}`;
}
