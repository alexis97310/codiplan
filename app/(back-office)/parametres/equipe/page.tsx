import type { StatutRessource } from "@prisma/client";
import type { Metadata } from "next";

import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Page } from "@/components/mise-en-page/page";
import { LienPrimaire } from "@/components/ui/action-primaire";
import { OptionsAgence, type AgenceOption } from "@/components/agences/options";
import { Badge, type TonBadge } from "@/components/ui/badge";
import { BandeauMotif } from "@/components/ui/bandeau-motif";
import { Button } from "@/components/ui/button";
import { CaseACocher } from "@/components/ui/case-a-cocher";
import { Onglets } from "@/components/ui/onglets";
import {
  Cellule,
  LignePleine,
  Tableau,
  type Colonne,
} from "@/components/ui/tableau";
import { RefusAcces } from "@/components/ui/refus-acces";
import { Volet } from "@/components/ui/volet";
import {
  ROLES_DE_BUREAU,
  etatsAccesDesComptes,
  listerComptesDeBureau,
  type EtatAccesBureau,
  type LigneCompteDeBureau,
} from "@/lib/auth/acces-bureau";
import {
  etatsAccesDesTechniciens,
  type EtatAcces,
} from "@/lib/auth/acces-technicien";
import { peut } from "@/lib/auth/habilitations";
import { obtenirSession } from "@/lib/auth/session";
import {
  dateCivile,
  jourDe,
  maintenant,
  schemaFuseau,
  type Fuseau,
  type JourLocal,
} from "@/lib/calendar/fuseau";
import { avecContexteApplicatif } from "@/lib/db/client";
import {
  habilitationsDesTechniciens,
  listerHabilitations,
  type LigneAttribution,
  type LigneHabilitation,
} from "@/lib/habilitations/depot";
import { dernierMot, trierAlphanumeriquement } from "@/lib/tri/collation";
import {
  agencesDisponibles,
  agencesProposablesPourTechnicien,
  compterInterventionsAVenirParTechnicien,
  listerLesTechniciens,
  type LigneTechnicien,
} from "@/lib/techniciens/depot";
import { STATUTS_RESSOURCE } from "@/lib/techniciens/saisie";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";
import { cn } from "@/lib/utils";

import { MenuGestesAccesActif } from "./menu-nouveau-lien";
import {
  cibleAccesConnue,
  dateHeureCourte,
  decompteInterventions,
  estARenouveler60Jours,
  estExpiree,
  texteTagHabilitation,
  tonTagHabilitation,
} from "./presentation";

export const metadata: Metadata = { title: t("equipe.titre_ecran") };

/** Les deux valeurs d'onglet de cet écran (9ET-COMPTES-BUREAU-2) — liste close. */
type OngletEquipe = "techniciens" | "bureau";

/** Les deux types de personne que le volet « Ajouter une personne » distingue. */
type TypePersonneAjoutee = "technicien" | "bureau";

/**
 * L'ÉQUIPE — créer, modifier et désactiver un technicien (ÉQUIPE-1).
 *
 * ## Pourquoi cet écran existe
 *
 * Mesuré sur 4fead41 : aucune route `api/techniciens/*`, aucun écran
 * d'équipe sous `/parametres`, et les seules écritures de `technicien` du
 * dépôt étaient le seed et un scénario d'isolation. Un technicien n'existait
 * que semé — impossible d'en ajouter un, impossible de faire partir celui
 * qui s'en va.
 *
 * ## CE QUE CET ÉCRAN NE FAIT PAS
 *
 * Ni le référentiel d'habilitations (`/parametres/habilitations`), ni les
 * exigences de site (`/sites/[id]`) — ÉQUIPE-2 les pose ailleurs. Il porte en
 * revanche l'ATTRIBUTION, datée, depuis la fiche de CHAQUE technicien : c'est
 * l'endroit que l'énoncé du ticket nomme, et le seul qui connaisse déjà la
 * personne concernée. Créer un technicien crée son identité, pas son accès
 * (voir `lib/techniciens/depot.ts`) : cet écran porte DEPUIS 9DJ-TP-ACC1 (D162)
 * le geste qui l'ouvre — « Envoyer le lien d'accès », par technicien, voir
 * `BlocAcces` ci-dessous.
 *
 * ## LES INACTIFS SONT VISIBLES DERRIÈRE UN FILTRE, JAMAIS EFFACÉS
 *
 * `Technicien.actif` porte l'intention du chapitre 11 : « il cesse d'être
 * proposé, il ne cesse pas d'avoir existé ». Le tableau ne montre donc que
 * les actifs par défaut, et un lien bascule l'affichage — jamais une
 * suppression.
 */
export default async function PageEquipe({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await obtenirSession(await headers());
  if (session === null) {
    redirect("/connexion");
  }
  if (session.contexte.societeId === null) {
    redirect("/arrivee");
  }

  // D153 (03/10/2026, TP-S3) — même garde que `/parametres/habilitations` :
  // « Administrer les utilisateurs » n'a aucun ○, seul admin_societe
  // l'ouvre. Remplace la garde QT-2 (D152) qui ne fermait que le technicien.
  if (
    session.contexte.role === null ||
    !peut(session.contexte.role, "administrer_utilisateurs")
  ) {
    return (
      <Page chemin="/parametres/equipe" titre={t("equipe.titre")}>
        <RefusAcces />
      </Page>
    );
  }

  const params = await searchParams;
  const motif = params.motif;
  const montrerInactifs = params.etat === "tous";

  // ── L'ONGLET ET LE VOLET (9ET-COMPTES-BUREAU-2) ─────────────────────────
  const ongletActif: OngletEquipe =
    params.onglet === "bureau" ? "bureau" : "techniciens";
  const ajouterOuvert = params.ajouter === "1";
  const typePersonneAjoutee: TypePersonneAjoutee | undefined =
    params.type === "technicien" || params.type === "bureau"
      ? params.type
      : undefined;

  const techniciens = await listerLesTechniciens(session.contexte);
  const agences = await agencesDisponibles(session.contexte);
  const comptesBureau = await listerComptesDeBureau(session.contexte);
  // SOLDE 189 — « Triés par nom de famille. », pour de vrai : même règle que
  // `trierLesTechniciens` (`lib/techniciens/depot.ts`), voir `dernierMot`.
  const comptesBureauTries = trierAlphanumeriquement(
    comptesBureau,
    (compte) => dernierMot(compte.nom),
    (compte) => `${compte.nom}\u0000${compte.utilisateurId}`,
  );
  const etatsAccesBureau = await etatsAccesDesComptes(
    session.contexte,
    comptesBureau.map((compte) => compte.utilisateurId),
  );
  const affiches = montrerInactifs
    ? techniciens
    : techniciens.filter((technicien) => technicien.actif);

  // LE MENU DE MODIFICATION DE CHAQUE TECHNICIEN, PAS LA LISTE PARTAGÉE
  // (AGENCE-ACTIVE, AA-3) — `agences` (ci-dessus) ne porte que les agences
  // ACTIVES : une fiche déjà rattachée à une agence désactivée après coup
  // perdrait son option, et « Enregistrer » un tout autre champ ferait
  // déraper le rattachement vers la première option du menu. Même piège,
  // même parade que `/sites/[id]`.
  const agencesParTechnicien = new Map(
    await Promise.all(
      affiches.map(
        async (technicien) =>
          [
            technicien.utilisateurId,
            await agencesProposablesPourTechnicien(
              session.contexte,
              technicien.agenceId,
            ),
          ] as const,
      ),
    ),
  );

  const comptesAVenir = await compterInterventionsAVenirParTechnicien(
    session.contexte,
    affiches.map((technicien) => technicien.utilisateurId),
  );

  // L'AVERTISSEMENT POSÉ APRÈS UNE DÉSACTIVATION (SAV-24) — le motif seul ne
  // suffit pas à porter N et le lien : `technicien` et `n` l'accompagnent
  // dans la même redirection (`app/api/techniciens/[id]/modifier/route.ts`).
  // Un identifiant hors société ou un nombre invalide reste invisible, jamais
  // une erreur — même discipline que le filtre de famille de `/parametres/materiel`.
  const avertissementTechnicienId =
    typeof params.technicien === "string" ? params.technicien : undefined;
  const avertissementNombre =
    typeof params.n === "string" ? Number(params.n) : undefined;
  const avertissementDesactivation =
    motif === "equipe.avertissement.desactivation_a_venir" &&
    avertissementTechnicienId !== undefined &&
    techniciens.some((t) => t.utilisateurId === avertissementTechnicienId) &&
    avertissementNombre !== undefined &&
    Number.isInteger(avertissementNombre) &&
    avertissementNombre > 0;

  // LE COMPTE RENDU APRÈS « ENVOYER LE LIEN D'ACCÈS » (D162) — même discipline
  // que l'avertissement de désactivation ci-dessus : un simple `motif` ne
  // porte qu'une clé FIXE (D26), jamais une adresse ni le motif d'un
  // prestataire — `destinataire` et `raison` l'accompagnent dans la même
  // redirection (`app/api/equipe/[id]/envoyer-acces/route.ts` POUR un
  // technicien, `app/api/equipe/bureau/[id]/envoyer-acces/route.ts` POUR un
  // compte de bureau — ce second chemin nomme sa cible `compte`, jamais
  // `technicien` : SOLDE 182, relecture de 9ET-COMPTES-BUREAU-2, qui mesurait
  // ce bandeau invisible depuis l'onglet « Comptes de bureau »).
  const compteBureauCibleId =
    typeof params.compte === "string" ? params.compte : undefined;
  const accesCibleEstConnue = cibleAccesConnue(
    avertissementTechnicienId,
    compteBureauCibleId,
    techniciens,
    comptesBureau,
  );
  const accesDestinataire =
    typeof params.destinataire === "string" ? params.destinataire : undefined;
  const accesRaison =
    typeof params.raison === "string" ? params.raison : undefined;
  const accesEnvoye =
    motif === "equipe.acces.envoye" &&
    accesCibleEstConnue &&
    accesDestinataire !== undefined;
  const accesNonParti =
    motif === "equipe.acces.non_parti" &&
    accesCibleEstConnue &&
    accesDestinataire !== undefined &&
    accesRaison !== undefined;

  const etatsAcces = await etatsAccesDesTechniciens(
    session.contexte,
    affiches.map((technicien) => technicien.utilisateurId),
  );

  const habilitations = await listerHabilitations(session.contexte);
  const habilitationsActives = habilitations.filter((h) => h.actif);
  const habilitationsParTechnicien = await habilitationsDesTechniciens(
    session.contexte,
    affiches.map((technicien) => technicien.utilisateurId),
  );
  // LE FUSEAU EST UNE DONNÉE, JAMAIS UN LITTÉRAL (L0-08) : le jugement
  // « expirée » de `BlocHabilitations` compare à AUJOURD'HUI, et cette date ne
  // se lit pas sans fuseau — celui de la société, comme `/vgp` et `/parc/[id]`.
  const societe = await avecContexteApplicatif(session.contexte, (tx) =>
    tx.societe.findFirst({
      where: { id: session.contexte.societeId as string },
      select: { fuseau_horaire: true },
    }),
  );
  const fuseau = schemaFuseau.parse(societe?.fuseau_horaire);
  // D-13 : `maintenant(fuseau).instant` est un `Date` que le fuseau n'a pas
  // touché (`new Date(Date.now())`) — comparer son jour avec les accesseurs
  // `getUTC*` compare le jour UTC, pas le jour à Nouméa. `.local`, lui, est
  // déjà la lecture dans CE fuseau ; `jourDe` en retient le jour civil.
  const aujourdHui = jourDe(maintenant(fuseau).local);

  // `?acces=a-ouvrir` ET `?echeance=expiree|j60` (9EG-TP-UX6-TABLEAU-DE-
  // BORD-2) — les tuiles du tableau de bord ouvrent cet écran DÉJÀ FILTRÉ,
  // sur le MÊME jugement que `BlocAcces`/`BlocHabilitations` ci-dessous :
  // jamais une seconde écriture du critère. Une valeur hors des deux
  // reconnues ne filtre rien, comme `?etat=` au-dessus.
  const affichesApresAcces =
    params.acces === "a-ouvrir"
      ? affiches.filter(
          (technicien) =>
            technicien.actif &&
            (etatsAcces.get(technicien.utilisateurId)?.etat ?? "aucun") !==
              "actif",
        )
      : affiches;
  const affichesFiltrees =
    params.echeance === "expiree"
      ? affichesApresAcces.filter((technicien) =>
          (habilitationsParTechnicien.get(technicien.utilisateurId) ?? []).some(
            (attribution) => estExpiree(attribution, aujourdHui),
          ),
        )
      : params.echeance === "j60"
        ? affichesApresAcces.filter((technicien) =>
            (
              habilitationsParTechnicien.get(technicien.utilisateurId) ?? []
            ).some((attribution) =>
              estARenouveler60Jours(attribution, aujourdHui),
            ),
          )
        : affichesApresAcces;

  // SOLDE 185 (relecture de 9ET-COMPTES-BUREAU-2) — les hrefs de l'onglet et
  // du volet gardaient l'onglet actif, jamais les filtres `?etat=`,
  // `?acces=` ni `?echeance=` : ouvrir « Ajouter une personne » depuis une
  // tuile du tableau de bord déjà filtrée (ou depuis `?etat=tous`) les
  // faisait disparaître à la fermeture du volet.
  const filtres: FiltresEquipe = {
    etat: typeof params.etat === "string" ? params.etat : undefined,
    acces: typeof params.acces === "string" ? params.acces : undefined,
    echeance: typeof params.echeance === "string" ? params.echeance : undefined,
  };

  return (
    <Page
      chemin="/parametres/equipe"
      titre={t("equipe.titre_ecran")}
      // FIL D'ARIANE (9DR-TP-NAV2-RETOURS-FIL, D168) — remplace
      // `<RetourParametres />`, retiré. Le repère COURT, « Équipe » — jamais
      // le grand titre de l'écran (voir `equipe.titre_ecran` ci-dessus).
      filAriane={[
        { libelle: t("nav.societes_tarifs"), href: "/parametres" },
        { libelle: t("equipe.titre") },
      ]}
      sousTitre={t("equipe.sous_titre")}
      actions={
        <LienPrimaire href={hrefOuvrirVolet(ongletActif, filtres)}>
          {t("equipe.ajouter_personne")}
        </LienPrimaire>
      }
    >
      {typeof motif === "string" &&
      estCleTraduction(motif) &&
      !avertissementDesactivation &&
      !accesEnvoye &&
      !accesNonParti ? (
        <BandeauMotif motif={motif}>{t(motif)}</BandeauMotif>
      ) : null}

      {avertissementDesactivation &&
      avertissementTechnicienId !== undefined &&
      avertissementNombre !== undefined ? (
        <p
          role="status"
          className="border-app-orange-bord bg-app-orange-fond text-app-orange-encre flex flex-wrap items-center gap-1.5 rounded-md border px-3.5 py-2.5 text-13 font-bold"
        >
          <span>{t("equipe.avertissement.desactivation_a_venir")}</span>
          <a
            href={lienInterventionsAVenir(avertissementTechnicienId)}
            className="font-semibold underline"
          >
            {libelleLienInterventionsAVenir(avertissementNombre)}
          </a>
        </p>
      ) : null}

      {accesEnvoye && accesDestinataire !== undefined ? (
        <p
          role="status"
          className="bg-app-surface border-app-bord rounded-md border px-3.5 py-2.5 text-13 font-bold"
        >
          {libelleAccesEnvoye(accesDestinataire)}
        </p>
      ) : null}

      {accesNonParti &&
      accesDestinataire !== undefined &&
      accesRaison !== undefined ? (
        <p
          role="status"
          className="border-app-orange-bord bg-app-orange-fond text-app-orange-encre flex flex-col gap-1 rounded-md border px-3.5 py-2.5 text-13 font-bold"
        >
          <span>{libelleAccesNonParti(accesRaison)}</span>
          <span className="font-normal">
            {t("equipe.acces.non_parti_jeton")}
          </span>
        </p>
      ) : null}

      <Onglets
        libelleAria={t("equipe.titre_ecran")}
        elements={[
          {
            libelle: t("equipe.onglet.techniciens"),
            href: hrefOnglet("techniciens", filtres),
            // SOLDE 190 — le nombre que l'onglet annonce est celui qu'il
            // MONTRE (les actifs, ou tous avec `?etat=tous`), jamais le
            // total brut, inactifs compris à l'insu du filtre.
            compte: affiches.length,
            actif: ongletActif === "techniciens",
          },
          {
            libelle: t("equipe.onglet.bureau"),
            href: hrefOnglet("bureau", filtres),
            compte: comptesBureau.length,
            actif: ongletActif === "bureau",
          },
        ]}
      />

      {ongletActif === "techniciens" ? (
        <>
          <section className="bg-app-surface border-app-bord overflow-hidden rounded-lg border">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <h2 className="text-[14px] font-bold">
                {t("equipe.liste_titre")}
              </h2>
              <a
                href={
                  montrerInactifs
                    ? "/parametres/equipe"
                    : "/parametres/equipe?etat=tous"
                }
                className="text-app-marque text-[12px] font-bold underline"
              >
                {montrerInactifs
                  ? t("equipe.filtre.masquer_inactifs")
                  : t("equipe.filtre.montrer_inactifs")}
              </a>
            </div>
            <Tableau colonnes={colonnes()} minimum="900px">
              {affichesFiltrees.length === 0 ? (
                <LignePleine colonnes={5}>{t("equipe.aucun")}</LignePleine>
              ) : null}
              {affichesFiltrees.map((technicien) => (
                <LigneTechnicienTableau
                  key={technicien.utilisateurId}
                  technicien={technicien}
                  etat={
                    etatsAcces.get(technicien.utilisateurId) ?? {
                      etat: "aucun",
                    }
                  }
                  attributions={
                    habilitationsParTechnicien.get(technicien.utilisateurId) ??
                    []
                  }
                  interventionsAVenir={
                    comptesAVenir.get(technicien.utilisateurId) ?? 0
                  }
                  aujourdHui={aujourdHui}
                  fuseau={fuseau}
                />
              ))}
            </Tableau>
          </section>
          <p className="text-app-encre-faible text-12 font-bold">
            {t("equipe.pied.techniciens")}
          </p>
          <p className="text-app-encre-faible text-12 font-bold">
            {t("equipe.tableau.note_lien_acces")}
          </p>
          <p className="text-app-encre-faible text-12 font-bold">
            {t("equipe.tableau.note_mot_de_passe_oublie")}
          </p>

          {/*
            REPLI PAR LIGNE (ERGO-1) — même raisonnement et même mesure que
            `/parametres/habilitations` (voir son commentaire). LE PANNEAU
            HABILITATIONS SUIT SON TECHNICIEN : il est posé DANS le même
            `<details>`, jamais à côté, pour rester replié avec lui.
          */}
          {affichesFiltrees.map((technicien) => (
            <details
              key={technicien.utilisateurId}
              className="bg-app-surface border-app-bord flex flex-col gap-2 rounded-lg border px-4 py-3.5"
            >
              <summary className="cursor-pointer text-[13px] font-bold">
                {titreDeModification(technicien.nom)}
              </summary>
              <div id={ancreModification(technicien.utilisateurId)}>
                <FormulaireModification
                  agences={
                    agencesParTechnicien.get(technicien.utilisateurId) ??
                    agences
                  }
                  technicien={technicien}
                  interventionsAVenir={
                    comptesAVenir.get(technicien.utilisateurId) ?? 0
                  }
                />

                <BlocAcces
                  technicien={technicien}
                  etat={
                    etatsAcces.get(technicien.utilisateurId) ?? {
                      etat: "aucun",
                    }
                  }
                  fuseau={fuseau}
                />

                <BlocHabilitations
                  technicien={technicien}
                  attributions={
                    habilitationsParTechnicien.get(technicien.utilisateurId) ??
                    []
                  }
                  habilitations={habilitationsActives}
                  aujourdHui={aujourdHui}
                />
              </div>
            </details>
          ))}
        </>
      ) : (
        <>
          <section className="bg-app-surface border-app-bord overflow-hidden rounded-lg border">
            <Tableau colonnes={colonnesBureau()} minimum="760px">
              {comptesBureauTries.length === 0 ? (
                <LignePleine colonnes={5}>
                  {t("equipe.bureau.aucun")}
                </LignePleine>
              ) : null}
              {comptesBureauTries.map((compte) => (
                <LigneCompteBureau
                  key={compte.utilisateurId}
                  compte={compte}
                  etat={
                    etatsAccesBureau.get(compte.utilisateurId) ?? {
                      etat: "aucun",
                    }
                  }
                  fuseau={fuseau}
                />
              ))}
            </Tableau>
          </section>
          <p className="text-app-encre-faible text-12 font-bold">
            {t("equipe.pied.bureau")}
          </p>
        </>
      )}

      {ajouterOuvert ? (
        <Volet
          surtitre={t("equipe.titre_ecran")}
          titre={t("equipe.volet.titre")}
          hrefFermer={hrefFermerVolet(ongletActif, filtres)}
        >
          <SelecteurTypePersonne
            ongletActif={ongletActif}
            type={typePersonneAjoutee}
            filtres={filtres}
          />
          {typePersonneAjoutee === "technicien" ? (
            <FormulaireAjouterTechnicien
              agences={agences}
              hrefAnnuler={hrefFermerVolet(ongletActif, filtres)}
            />
          ) : typePersonneAjoutee === "bureau" ? (
            <FormulaireAjouterCompteDeBureau
              hrefAnnuler={hrefFermerVolet(ongletActif, filtres)}
            />
          ) : null}
        </Volet>
      ) : null}
    </Page>
  );
}

const TIRET = " — ";

/**
 * La composition est faite HORS du JSX — un littéral n'y est pas admis, fût-il
 * le tiret d'un titre (L0-11).
 */
function titreDeModification(nom: string): string {
  return `${t("equipe.modifier")}${TIRET}${nom}`;
}

/**
 * L'ANCRE DU REPLI (ERGO-1) — jamais posée sur le `<details>` ni sur le
 * `<summary>`, mesuré sur `/parametres/habilitations` : seul un élément DANS
 * le contenu replié fait ouvrir le `<details>` à la navigation par ancre.
 */
function ancreModification(utilisateurId: string): string {
  return `technicien-${utilisateurId}`;
}

/** « Agence de rattachement » — le mot imposé, composé hors du JSX (L0-11). */
function libelleAgence(): string {
  return `${mot("agence")} ${t("equipe.agence_suffixe")}`;
}

/**
 * « N intervention(s) à venir » — composée hors du JSX, même discipline que
 * `decompteModeles` de `/parametres/materiel` : aucun nombre n'est écrit au
 * dictionnaire (D26), seul l'accord singulier/pluriel y vit.
 */
function decompteInterventionsAVenir(nombre: number): string {
  return `${nombre} ${
    nombre === 1
      ? t("equipe.interventions_a_venir.compte_un")
      : t("equipe.interventions_a_venir.compte")
  }`;
}

/** « Lien envoyé à <courriel> » — composé hors du JSX (L0-11, D162). */
function libelleAccesEnvoye(destinataire: string): string {
  return `${t("equipe.acces.envoye")} ${destinataire}`;
}

/**
 * « Le lien n'est pas parti : <motif> » — le motif vient du PRESTATAIRE
 * (`lib/courriel/resend.ts`), jamais du dictionnaire : c'est une DONNÉE,
 * comme `decompte.motif` de `/sante` (D162).
 */
function libelleAccesNonParti(raison: string): string {
  return `${t("equipe.acces.non_parti")} ${raison}`;
}

/** L'état d'accès d'un technicien, en clair (D162). */
function libelleEtatAcces(etat: EtatAcces, fuseau: Fuseau): string {
  if (etat.etat === "aucun") {
    return t("equipe.acces.aucun");
  }
  if (etat.etat === "actif") {
    return t("equipe.acces.actif");
  }
  return `${t("equipe.acces.lien_envoye_prefixe")} ${dateHeureCourte(etat.horodatage, fuseau)}`;
}

/**
 * LE LIEN VERS LE REGISTRE, FILTRÉ SUR CE TECHNICIEN — sans `vue` : aucune des
 * six vues existantes (`lib/interventions/saisie.ts`) ne porte « aujourd'hui
 * ou plus tard, hors terminée/clôturée/annulée » — `aujourdhui` s'arrête à ce
 * jour, les autres portent un statut. « Toutes » (l'absence de `vue`) est le
 * seul sur-ensemble sûr : il ne peut jamais masquer une intervention que le
 * compte a comptée.
 */
function lienInterventionsAVenir(utilisateurId: string): string {
  // `vue=toutes` (TP-UX3-1-REGISTRE-1, décision 13 d'Alexis du 05/10/2026) —
  // sans elle, ce lien ouvrirait l'onglet par défaut « À planifier », qui ne
  // couvre pas le compte annoncé (aucune des huit vues ne porte « aujourd'hui
  // ou plus tard, hors terminée/clôturée/annulée », voir ci-dessus).
  return `/interventions?technicien=${utilisateurId}&vue=toutes`;
}

/** Le texte du lien de l'avertissement de désactivation — décompte puis appel à l'action. */
function libelleLienInterventionsAVenir(nombre: number): string {
  return `${decompteInterventionsAVenir(nombre)}${TIRET}${t("equipe.interventions_a_venir.lien")}`;
}

/** La note qui suit le lien, dans la fiche de modification. */
function noteInterventionsAVenir(): string {
  return `${TIRET}${t("equipe.interventions_a_venir.note")}`;
}

/** Les colonnes du tableau de l'onglet Techniciens, à la maquette (point 2). */
function colonnes(): readonly Colonne[] {
  return [
    { cle: "technicien", libelle: t("equipe.tableau.colonne.technicien") },
    { cle: "habilitations", libelle: t("habilitations.technicien.titre") },
    {
      cle: "a_venir",
      libelle: t("equipe.tableau.colonne.a_venir"),
      largeur: "150px",
    },
    {
      cle: "acces",
      libelle: t("equipe.bureau.colonne.acces"),
      largeur: "240px",
    },
    { cle: "gestes", libelle: "", largeur: "190px" },
  ];
}

/** « Non renseigné » tant que la question n'a jamais été posée (QG-9, D163). */
function libelleStatutRessource(statut: StatutRessource | null): string {
  if (statut === "salarie") return t("equipe.statut.salarie");
  if (statut === "patente") return t("equipe.statut.patente");
  return t("equipe.statut.non_renseigne");
}

function SelectAgence({
  id,
  valeur,
  agences,
}: {
  readonly id: string;
  readonly valeur?: string;
  readonly agences: readonly AgenceOption[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-app-encre-faible text-12 font-bold">
        {libelleAgence()}
      </label>
      <select
        id={id}
        name="agence_id"
        defaultValue={valeur ?? ""}
        required
        className="border-app-bord bg-app-surface min-w-44 rounded-md border px-2 py-1 text-13 font-bold"
      >
        <option value="" disabled>
          {t("equipe.choisir_rattachement")}
        </option>
        <OptionsAgence agences={agences} />
      </select>
    </div>
  );
}

/**
 * LE STATUT DE RESSOURCE (QG-9, D163) — OBLIGATOIRE À LA CRÉATION, SANS
 * VALEUR CHOISIE D'AVANCE : le placeholder est `disabled`, exactement comme
 * `SelectAgence`. À LA MODIFICATION, « non renseigné » n'est une option QUE
 * si la fiche n'a jamais répondu — une fois posé, le menu ne propose plus
 * que les deux valeurs réelles, et `modifierTechnicien` tient la même porte
 * côté serveur (motif `statut_deja_pose`).
 */
function SelectStatutRessource({
  id,
  valeur,
  permettreNonRenseigne,
}: {
  readonly id: string;
  readonly valeur?: StatutRessource | null;
  readonly permettreNonRenseigne: boolean;
}) {
  const defaut = valeur ?? (permettreNonRenseigne ? "non_renseigne" : "");
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-app-encre-faible text-12 font-bold">
        {t("equipe.statut")}
      </label>
      <select
        id={id}
        name="statut_ressource"
        defaultValue={defaut}
        required
        className="border-app-bord bg-app-surface min-w-44 rounded-md border px-2 py-1 text-13 font-bold"
      >
        {permettreNonRenseigne ? (
          <option value="non_renseigne">
            {t("equipe.statut.non_renseigne")}
          </option>
        ) : (
          <option value="" disabled>
            {t("equipe.statut.choisir")}
          </option>
        )}
        {STATUTS_RESSOURCE.map((statut) => (
          <option key={statut} value={statut}>
            {libelleStatutRessource(statut)}
          </option>
        ))}
      </select>
    </div>
  );
}

function Champ({
  id,
  nom,
  libelle,
  valeur,
  type,
}: {
  readonly id: string;
  readonly nom: string;
  readonly libelle: string;
  readonly valeur?: string;
  readonly type: "text" | "email";
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-app-encre-faible text-12 font-bold">
        {libelle}
      </label>
      <input
        id={id}
        name={nom}
        type={type}
        required
        defaultValue={valeur}
        className="border-app-bord bg-app-surface min-w-56 rounded-md border px-2 py-1 text-13 font-bold"
      />
    </div>
  );
}

/**
 * LES TROIS FILTRES DU TABLEAU DE BORD (`?etat=`, `?acces=`, `?echeance=`)
 * — portés par les hrefs ci-dessous (solde 185), jamais réécrits ailleurs.
 */
type FiltresEquipe = {
  readonly etat?: string;
  readonly acces?: string;
  readonly echeance?: string;
};

/** Le préfixe de requête commun — garde l'onglet visé ET les filtres actifs. */
function paramsAvecOnglet(
  onglet: OngletEquipe,
  filtres: FiltresEquipe,
): URLSearchParams {
  const params = new URLSearchParams();
  if (onglet === "bureau") {
    params.set("onglet", "bureau");
  }
  if (filtres.etat !== undefined) {
    params.set("etat", filtres.etat);
  }
  if (filtres.acces !== undefined) {
    params.set("acces", filtres.acces);
  }
  if (filtres.echeance !== undefined) {
    params.set("echeance", filtres.echeance);
  }
  return params;
}

/** `?onglet=` — absent pour « techniciens », le défaut (9ET-COMPTES-BUREAU-2). */
function hrefOnglet(onglet: OngletEquipe, filtres: FiltresEquipe): string {
  const params = paramsAvecOnglet(onglet, filtres);
  const requete = params.toString();
  return requete === ""
    ? "/parametres/equipe"
    : `/parametres/equipe?${requete}`;
}

/** Le bouton d'en-tête « Ajouter une personne » — ouvre le volet, sans type choisi. */
function hrefOuvrirVolet(
  ongletActif: OngletEquipe,
  filtres: FiltresEquipe,
): string {
  const params = paramsAvecOnglet(ongletActif, filtres);
  params.set("ajouter", "1");
  return `/parametres/equipe?${params.toString()}`;
}

/** Le choix « Technicien » / « Compte de bureau », DANS le volet déjà ouvert. */
function hrefChoisirType(
  ongletActif: OngletEquipe,
  type: TypePersonneAjoutee,
  filtres: FiltresEquipe,
): string {
  const params = paramsAvecOnglet(ongletActif, filtres);
  params.set("ajouter", "1");
  params.set("type", type);
  return `/parametres/equipe?${params.toString()}`;
}

/** La fermeture du volet — jamais `ajouter`/`type`, l'onglet et les filtres survivent. */
function hrefFermerVolet(
  ongletActif: OngletEquipe,
  filtres: FiltresEquipe,
): string {
  const params = paramsAvecOnglet(ongletActif, filtres);
  const requete = params.toString();
  return requete === ""
    ? "/parametres/equipe"
    : `/parametres/equipe?${requete}`;
}

/**
 * LE CHOIX « ELLE TRAVAILLE COMME » (maquette :4709) — deux liens, jamais une
 * case radio : le volet est un composant SERVEUR, sans JavaScript, et l'état
 * « type choisi » vit dans l'URL comme le reste de cet écran.
 */
function SelecteurTypePersonne({
  ongletActif,
  type,
  filtres,
}: {
  readonly ongletActif: OngletEquipe;
  readonly type: TypePersonneAjoutee | undefined;
  readonly filtres: FiltresEquipe;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-app-encre-faible text-12 font-bold">
        {t("equipe.volet.elle_travaille_comme")}
      </span>
      <div className="flex gap-2">
        <ChoixTypePersonne
          href={hrefChoisirType(ongletActif, "technicien", filtres)}
          choisi={type === "technicien"}
        >
          {t("equipe.volet.technicien")}
        </ChoixTypePersonne>
        <ChoixTypePersonne
          href={hrefChoisirType(ongletActif, "bureau", filtres)}
          choisi={type === "bureau"}
        >
          {t("equipe.volet.compte_bureau")}
        </ChoixTypePersonne>
      </div>
    </div>
  );
}

function ChoixTypePersonne({
  href,
  choisi,
  children,
}: {
  readonly href: string;
  readonly choisi: boolean;
  readonly children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={choisi ? "true" : undefined}
      className={cn(
        "rounded-md border px-3 py-1.5 text-13 font-bold",
        choisi
          ? "border-app-bleu-plein bg-app-bleu-fond text-app-bleu-encre"
          : "border-app-bord",
      )}
    >
      {children}
    </Link>
  );
}

/** Le champ « Courriel », avec l'aide de la maquette (:4713) — partagée par les deux types. */
function ChampCourriel({
  id,
  nom,
}: {
  readonly id: string;
  readonly nom: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Champ id={id} nom={nom} libelle={t("equipe.email")} type="email" />
      <p className="text-app-encre-faible text-12 font-bold">
        {t("equipe.volet.courriel_aide")}
      </p>
    </div>
  );
}

/** Les deux boutons du pied du volet — communs aux deux types de personne. */
function PiedDuVolet({ hrefAnnuler }: { readonly hrefAnnuler: string }) {
  return (
    <div className="flex justify-end gap-2">
      <Link
        href={hrefAnnuler}
        className="border-app-bord rounded-md border px-3 py-1.5 text-13 font-bold"
      >
        {t("equipe.volet.annuler")}
      </Link>
      <Button type="submit" variant="default" size="sm">
        {t("equipe.creer_action")}
      </Button>
    </div>
  );
}

function FormulaireAjouterTechnicien({
  agences,
  hrefAnnuler,
}: {
  readonly agences: readonly AgenceOption[];
  readonly hrefAnnuler: string;
}) {
  return (
    <form
      action="/api/techniciens/creer"
      method="post"
      className="flex flex-col gap-3"
    >
      {/* Un technicien ajouté ici naît actif — aucun champ d'activité dans
          la maquette du volet (:4709-4716) : « Actif » reste une bascule de
          la fiche de modification, jamais une question à l'ajout. */}
      <input type="hidden" name="actif" value="on" />
      <Champ
        id="ajout-technicien-nom"
        nom="nom"
        libelle={t("equipe.nom")}
        type="text"
      />
      <ChampCourriel id="ajout-technicien-email" nom="email" />
      <SelectStatutRessource
        id="ajout-technicien-statut"
        permettreNonRenseigne={false}
      />
      <SelectAgence id="ajout-technicien-agence" agences={agences} />
      <CaseACocher
        name="envoyer_acces"
        libelle={t("equipe.volet.envoyer_en_ajoutant")}
        className="flex items-center gap-1.5"
      />
      <p className="text-app-encre-faible text-12 font-bold">
        {t("equipe.creer_aide")}
      </p>
      <PiedDuVolet hrefAnnuler={hrefAnnuler} />
    </form>
  );
}

function SelectRoleDeBureau({ id }: { readonly id: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-app-encre-faible text-12 font-bold">
        {t("equipe.bureau.colonne.role")}
      </label>
      <select
        id={id}
        name="role"
        defaultValue=""
        required
        className="border-app-bord bg-app-surface min-w-44 rounded-md border px-2 py-1 text-13 font-bold"
      >
        <option value="" disabled>
          {t("equipe.volet.role_choisir")}
        </option>
        {ROLES_DE_BUREAU.map((role) => (
          <option key={role} value={role}>
            {t(`role.${role}`)}
          </option>
        ))}
      </select>
      <p className="text-app-encre-faible text-12 font-bold">
        {t("equipe.volet.role_aide")}
      </p>
    </div>
  );
}

function FormulaireAjouterCompteDeBureau({
  hrefAnnuler,
}: {
  readonly hrefAnnuler: string;
}) {
  return (
    <form
      action="/api/equipe/bureau/creer"
      method="post"
      className="flex flex-col gap-3"
    >
      <Champ
        id="ajout-bureau-nom"
        nom="nom"
        libelle={t("equipe.nom")}
        type="text"
      />
      <ChampCourriel id="ajout-bureau-courriel" nom="courriel" />
      <SelectRoleDeBureau id="ajout-bureau-role" />
      <CaseACocher
        name="envoyer_acces"
        libelle={t("equipe.volet.envoyer_en_ajoutant")}
        className="flex items-center gap-1.5"
      />
      <p className="text-app-encre-faible text-12 font-bold">
        {t("equipe.creer_aide")}
      </p>
      <PiedDuVolet hrefAnnuler={hrefAnnuler} />
    </form>
  );
}

function colonnesBureau(): readonly Colonne[] {
  return [
    { cle: "personne", libelle: t("equipe.bureau.colonne.personne") },
    {
      cle: "role",
      libelle: t("equipe.bureau.colonne.role"),
      largeur: "190px",
    },
    {
      cle: "second_facteur",
      libelle: t("equipe.bureau.colonne.second_facteur"),
      largeur: "190px",
    },
    {
      cle: "acces",
      libelle: t("equipe.bureau.colonne.acces"),
      largeur: "220px",
    },
    { cle: "gestes", libelle: "", largeur: "190px" },
  ];
}

function tonAccesBureau(etat: EtatAccesBureau): TonBadge {
  if (etat.etat === "actif") return "vert";
  if (etat.etat === "lien_envoye") return "bleu";
  return "orange";
}

/** Le libellé du badge d'accès — les quatre états de la maquette (:4612). */
function libelleAccesBureau(etat: EtatAccesBureau): string {
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
 * La seconde ligne du badge d'accès — `null` pour « actif » : la « dernière
 * connexion » de la maquette est OMISE (décision 80 d'Alexis).
 */
function sousTexteAccesBureau(
  etat: EtatAccesBureau,
  fuseau: Fuseau,
): string | null {
  switch (etat.etat) {
    case "actif":
      return null;
    case "aucun":
      return t("equipe.acces.badge.aucun_lien_envoye");
    case "lien_expire":
      return `${t("equipe.acces.badge.envoye_le")} ${dateHeureCourte(etat.horodatage, fuseau)}, ${t("equipe.acces.badge.jamais_ouvert")}`;
    case "lien_envoye":
      return `${t("equipe.acces.badge.le")} ${dateHeureCourte(etat.horodatage, fuseau)}, ${t("equipe.acces.badge.valable_une_heure")}`;
  }
}

function BadgeAccesBureau({
  etat,
  fuseau,
}: {
  readonly etat: EtatAccesBureau;
  readonly fuseau: Fuseau;
}) {
  const sousTexte = sousTexteAccesBureau(etat, fuseau);
  return (
    <div className="flex flex-col gap-0.5">
      <Badge ton={tonAccesBureau(etat)}>{libelleAccesBureau(etat)}</Badge>
      {sousTexte === null ? null : (
        <span className="text-app-encre-faible text-12 font-bold">
          {sousTexte}
        </span>
      )}
    </div>
  );
}

/**
 * LE SECOND FACTEUR, LU À L'ÉTAT RÉEL (`mfaActif`, `lib/auth/acces-bureau.ts`)
 * — jamais inventé : « exigé »/« non exigé » vient de `secondFacteurExige`
 * (`exigeSecondFacteur`, `lib/auth/roles.ts`), déjà posé par ce module.
 */
function SecondFacteurBureau({
  compte,
}: {
  readonly compte: LigneCompteDeBureau;
}) {
  if (compte.mfaActif) {
    return (
      <div className="flex flex-col gap-0.5">
        <Badge ton="vert">{t("equipe.bureau.second_facteur.actif")}</Badge>
        {compte.secondFacteurExige ? (
          <span className="text-app-encre-faible text-12 font-bold">
            {t("equipe.bureau.second_facteur.exige_pour_ce_role")}
          </span>
        ) : null}
      </div>
    );
  }
  if (compte.secondFacteurExige) {
    return (
      <div className="flex flex-col gap-0.5">
        <Badge ton="rouge">
          {t("equipe.bureau.second_facteur.pas_encore_actif")}
        </Badge>
        <span className="text-app-encre-faible text-12 font-bold">
          {t("equipe.bureau.second_facteur.exige_a_la_connexion")}
        </span>
      </div>
    );
  }
  return (
    <span className="text-app-encre-faible text-13 font-bold">
      {t("equipe.bureau.second_facteur.non_exige")}
    </span>
  );
}

/** Le geste de la ligne — même règle que `BlocAcces` : rien quand l'accès est déjà actif. */
function GesteAccesBureau({
  compte,
  etat,
}: {
  readonly compte: LigneCompteDeBureau;
  readonly etat: EtatAccesBureau;
}) {
  if (etat.etat === "actif") {
    return (
      <MenuGestesAccesActif
        nom={compte.nom}
        courriel={compte.email}
        action={`/api/equipe/bureau/${compte.utilisateurId}/nouveau-lien`}
      />
    );
  }
  return (
    <form
      action={`/api/equipe/bureau/${compte.utilisateurId}/envoyer-acces`}
      method="post"
    >
      <Button type="submit" variant="outline" size="sm">
        {etat.etat === "aucun"
          ? t("equipe.acces.envoyer")
          : t("equipe.acces.renvoyer")}
      </Button>
    </form>
  );
}

function LigneCompteBureau({
  compte,
  etat,
  fuseau,
}: {
  readonly compte: LigneCompteDeBureau;
  readonly etat: EtatAccesBureau;
  readonly fuseau: Fuseau;
}) {
  return (
    <tr>
      <Cellule fort>
        <div className="flex flex-col">
          <span>{compte.nom}</span>
          <span className="text-app-encre-faible text-12 font-bold">
            {compte.email}
          </span>
        </div>
      </Cellule>
      <Cellule>{t(`role.${compte.role}`)}</Cellule>
      <Cellule>
        <SecondFacteurBureau compte={compte} />
      </Cellule>
      <Cellule>
        <BadgeAccesBureau etat={etat} fuseau={fuseau} />
      </Cellule>
      <Cellule>
        <GesteAccesBureau compte={compte} etat={etat} />
      </Cellule>
    </tr>
  );
}

/**
 * LES TAGS D'HABILITATION, TRIÉS PAR CODE (point 2, maquette `habCell`,
 * `maquette-toutes-pages.html:4635`) — jamais le libellé complet (voir
 * `texteTagHabilitation`, `presentation.ts`). PAS de « Renouveler » ici (lot
 * 9EY) : seul `BlocHabilitations`, dans le `<details>`, le fera.
 */
function CelluleHabilitationsTableau({
  attributions,
  aujourdHui,
}: {
  readonly attributions: readonly LigneAttribution[];
  readonly aujourdHui: JourLocal;
}) {
  if (attributions.length === 0) {
    return (
      <span className="text-app-encre-faible text-12 font-bold">
        {t("equipe.tableau.aucune")}
      </span>
    );
  }
  const triees = trierAlphanumeriquement(attributions, (a) => a.code);
  return (
    <div className="flex flex-wrap gap-1.5">
      {triees.map((attribution) => (
        <Badge
          key={attribution.id}
          ton={tonTagHabilitation(attribution, aujourdHui)}
        >
          {texteTagHabilitation(attribution, aujourdHui)}
        </Badge>
      ))}
    </div>
  );
}

/**
 * « À VENIR » (point 2, maquette `aVenirCell`) — 0 → « aucune » grisé ; un
 * accès déjà ACTIF rend le décompte en neutre ; sinon en orange, avec
 * « sans accès à l'application » dessous — la définition du décompte
 * lui-même reste celle du serveur (`compterInterventionsAVenirParTechnicien`,
 * `lib/techniciens/depot.ts`), jamais recalculée ici (écart nommé avec la
 * maquette, voir la passation).
 */
function CelluleAVenirTableau({
  nombre,
  etat,
}: {
  readonly nombre: number;
  readonly etat: EtatAcces;
}) {
  if (nombre === 0) {
    return (
      <span className="text-app-encre-faible text-12 font-bold">
        {t("equipe.tableau.aucune")}
      </span>
    );
  }
  if (etat.etat === "actif") {
    return (
      <span className="text-13 font-bold">{decompteInterventions(nombre)}</span>
    );
  }
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-app-orange-encre text-13 font-bold">
        {decompteInterventions(nombre)}
      </span>
      <span className="text-app-orange-encre text-12 font-bold">
        {t("equipe.tableau.sans_acces_application")}
      </span>
    </div>
  );
}

/**
 * LE GESTE DE LA LIGNE — même règle que `GesteAccesBureau` : rien quand
 * l'accès est déjà ACTIF (point 3 y posera le menu « … », D86).
 */
function GesteAccesTechnicien({
  technicien,
  etat,
}: {
  readonly technicien: LigneTechnicien;
  readonly etat: EtatAcces;
}) {
  if (etat.etat === "actif") {
    return (
      <MenuGestesAccesActif
        nom={technicien.nom}
        courriel={technicien.email}
        action={`/api/equipe/${technicien.utilisateurId}/nouveau-lien`}
      />
    );
  }
  return (
    <form
      action={`/api/equipe/${technicien.utilisateurId}/envoyer-acces`}
      method="post"
    >
      <Button type="submit" variant="outline" size="sm">
        {etat.etat === "aucun"
          ? t("equipe.acces.envoyer")
          : t("equipe.acces.renvoyer")}
      </Button>
    </form>
  );
}

/** La ligne du tableau de l'onglet Techniciens, à la maquette (point 2, `rowTech`). */
function LigneTechnicienTableau({
  technicien,
  etat,
  attributions,
  interventionsAVenir,
  aujourdHui,
  fuseau,
}: {
  readonly technicien: LigneTechnicien;
  readonly etat: EtatAcces;
  readonly attributions: readonly LigneAttribution[];
  readonly interventionsAVenir: number;
  readonly aujourdHui: JourLocal;
  readonly fuseau: Fuseau;
}) {
  return (
    <tr>
      <Cellule fort>
        <div className="flex flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span>{technicien.nom}</span>
            {technicien.actif ? null : (
              <Badge ton="gris">{t("equipe.inactif")}</Badge>
            )}
          </div>
          <div className="text-app-encre-faible text-12 font-bold">
            <span>{libelleStatutRessource(technicien.statutRessource)}</span>
            {t("ponctuation.point_median")}
            <span>{technicien.email}</span>
          </div>
          <a
            href={`#${ancreModification(technicien.utilisateurId)}`}
            className="text-app-marque text-[12px] font-bold underline"
          >
            {t("equipe.modifier")}
          </a>
        </div>
      </Cellule>
      <Cellule>
        <CelluleHabilitationsTableau
          attributions={attributions}
          aujourdHui={aujourdHui}
        />
      </Cellule>
      <Cellule>
        <CelluleAVenirTableau nombre={interventionsAVenir} etat={etat} />
      </Cellule>
      <Cellule>
        <BadgeAccesBureau etat={etat} fuseau={fuseau} />
      </Cellule>
      <Cellule>
        <GesteAccesTechnicien technicien={technicien} etat={etat} />
      </Cellule>
    </tr>
  );
}

function FormulaireModification({
  agences,
  technicien,
  interventionsAVenir,
}: {
  readonly agences: readonly AgenceOption[];
  readonly technicien: LigneTechnicien;
  readonly interventionsAVenir: number;
}) {
  return (
    <form
      action={`/api/techniciens/${technicien.utilisateurId}/modifier`}
      method="post"
      className="flex flex-wrap items-end gap-2"
    >
      <SelectAgence
        id={`${technicien.utilisateurId}-agence`}
        valeur={technicien.agenceId}
        agences={agences}
      />
      <SelectStatutRessource
        id={`${technicien.utilisateurId}-statut`}
        valeur={technicien.statutRessource}
        permettreNonRenseigne={technicien.statutRessource === null}
      />
      <CaseACocher
        name="actif"
        defaultChecked={technicien.actif}
        libelle={t("equipe.actif")}
        className="flex items-center gap-1.5 pb-1 text-13 font-bold"
      />
      <Button type="submit" variant="outline" size="sm">
        {t("equipe.enregistrer")}
      </Button>
      {interventionsAVenir > 0 ? (
        <p className="text-app-encre-faible basis-full text-12 font-bold">
          <a
            href={lienInterventionsAVenir(technicien.utilisateurId)}
            className="text-app-marque font-bold underline"
          >
            {decompteInterventionsAVenir(interventionsAVenir)}
          </a>
          {noteInterventionsAVenir()}
        </p>
      ) : null}
    </form>
  );
}

/**
 * L'ACCÈS D'UN TECHNICIEN — l'état en clair, et le geste qui l'ouvre (D162,
 * 9DJ-TP-ACC1-DONNER-ACCES).
 *
 * Aucun bouton quand l'accès est déjà ACTIF (`compte.mot_de_passe` non nul) :
 * le cliquet de D65 ferme cette voie pour toujours, et un bouton qui
 * échouerait systématiquement ne serait qu'une fausse promesse.
 */
function BlocAcces({
  technicien,
  etat,
  fuseau,
}: {
  readonly technicien: LigneTechnicien;
  readonly etat: EtatAcces;
  readonly fuseau: Fuseau;
}) {
  return (
    <div className="border-app-bord mt-2 flex flex-wrap items-center gap-2 border-t pt-3">
      <span className="text-app-encre-faible text-[12px] font-bold">
        {libelleEtatAcces(etat, fuseau)}
      </span>
      {etat.etat === "actif" ? null : (
        <form
          action={`/api/equipe/${technicien.utilisateurId}/envoyer-acces`}
          method="post"
        >
          <Button type="submit" variant="outline" size="sm">
            {etat.etat === "aucun"
              ? t("equipe.acces.envoyer")
              : t("equipe.acces.renvoyer")}
          </Button>
        </form>
      )}
    </div>
  );
}

/**
 * L'HABILITATION D'UN TECHNICIEN — l'attribution, datée, et son retrait
 * (ÉQUIPE-2).
 *
 * **Une habilitation expirée reste visible et se voit comme expirée, elle ne
 * disparaît pas** — même intention que `Technicien.actif` en tête de fichier :
 * elle cesse d'être VALABLE, elle ne cesse pas d'avoir existé.
 *
 * Le jugement « expirée » compare le jour de `date_expiration` au jour civil
 * courant — `aujourdHui` vient de `maintenant(fuseau)` (L0-08), le fuseau de
 * la société active, exactement comme `/vgp` et `/parc/[id]`. C'est un
 * affichage, pas la décision qui bloque une affectation : celle-ci reste
 * entièrement à `lib/habilitations/affectation.ts` (RG-PLA-04), qui juge à la
 * date de l'intervention et non à aujourd'hui.
 */
function BlocHabilitations({
  technicien,
  attributions,
  habilitations,
  aujourdHui,
}: {
  readonly technicien: LigneTechnicien;
  readonly attributions: readonly LigneAttribution[];
  readonly habilitations: readonly LigneHabilitation[];
  readonly aujourdHui: JourLocal;
}) {
  return (
    <div className="border-app-bord mt-2 flex flex-col gap-2 border-t pt-3">
      <h3 className="text-app-encre-faible text-12 font-bold tracking-[0.4px] uppercase">
        {t("habilitations.technicien.titre")}
      </h3>
      {attributions.length === 0 ? (
        <p className="text-app-encre-faible text-[12px] font-bold">
          {t("habilitations.technicien.aucune")}
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {attributions.map((attribution) => (
            <li
              key={attribution.id}
              className="flex flex-wrap items-center gap-2 text-13 font-bold"
            >
              <span className="font-mono font-bold">{attribution.code}</span>
              <span className="text-app-encre-faible">
                {attribution.libelle}
              </span>
              <span className="text-app-encre-faible">
                {expirationAffichee(attribution)}
              </span>
              {estExpiree(attribution, aujourdHui) ? (
                <Badge ton="rouge">{t("habilitations.expiree")}</Badge>
              ) : null}
              <form
                action={`/api/habilitations/attributions/${attribution.id}/retirer`}
                method="post"
              >
                <Button type="submit" variant="outline" size="sm">
                  {t("habilitations.retirer")}
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {habilitations.length === 0 ? (
        <p className="text-app-encre-faible text-[12px] font-bold">
          {t("habilitations.technicien.rien_a_attribuer")}
        </p>
      ) : (
        <form
          action="/api/habilitations/attributions/creer"
          method="post"
          className="flex flex-wrap items-end gap-2"
        >
          <input
            type="hidden"
            name="utilisateur_id"
            value={technicien.utilisateurId}
          />
          <div className="flex flex-col gap-1">
            <label
              htmlFor={`${technicien.utilisateurId}-habilitation`}
              className="text-app-encre-faible text-12 font-bold"
            >
              {t("habilitations.technicien.attribuer")}
            </label>
            <select
              id={`${technicien.utilisateurId}-habilitation`}
              name="habilitation_id"
              required
              defaultValue=""
              className="border-app-bord bg-app-surface min-w-44 rounded-md border px-2 py-1 text-13 font-bold"
            >
              <option value="" disabled>
                {t("habilitations.technicien.choisir")}
              </option>
              {habilitations.map((habilitation) => (
                <option key={habilitation.id} value={habilitation.id}>
                  {habilitation.code}
                </option>
              ))}
            </select>
          </div>
          <ChampDate
            id={`${technicien.utilisateurId}-obtention`}
            nom="date_obtention"
            libelle={t("habilitations.date_obtention")}
            requis
          />
          <ChampDate
            id={`${technicien.utilisateurId}-expiration`}
            nom="date_expiration"
            libelle={t("habilitations.date_expiration")}
          />
          <Button type="submit" variant="outline" size="sm">
            {t("habilitations.technicien.attribuer_action")}
          </Button>
        </form>
      )}
    </div>
  );
}

function ChampDate({
  id,
  nom,
  libelle,
  requis,
}: {
  readonly id: string;
  readonly nom: string;
  readonly libelle: string;
  readonly requis?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-app-encre-faible text-12 font-bold">
        {libelle}
      </label>
      <input
        id={id}
        name={nom}
        type="date"
        required={requis === true}
        className="border-app-bord bg-app-surface rounded-md border px-2 py-1 text-13 font-bold"
      />
    </div>
  );
}

/** `null` = n'expire pas — jamais affiché comme une absence de valeur (D88). */
function expirationAffichee(attribution: LigneAttribution): string {
  return attribution.date_expiration === null
    ? t("habilitations.expire_jamais")
    : dateCivile(attribution.date_expiration);
}
