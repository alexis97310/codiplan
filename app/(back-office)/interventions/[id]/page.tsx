import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { Page } from "@/components/mise-en-page/page";
import { Button } from "@/components/ui/button";
import { absencesDeLaPeriode } from "@/lib/absences/depot";
import { annuaireDesPersonnes } from "@/lib/auth/annuaire";
import { type ContexteActif } from "@/lib/auth/contexte";
import { peut } from "@/lib/auth/habilitations";
import { obtenirSession } from "@/lib/auth/session";
import { dateCivile } from "@/lib/calendar/fuseau";
import { avecContexteApplicatif } from "@/lib/db/client";
import type { VerdictAffectation } from "@/lib/habilitations/affectation";
import {
  peutAffecter,
  peutAnnuler,
  peutCloturer,
  peutDeplacer,
  peutReprendre,
  peutSuspendre,
  type Verdict,
} from "@/lib/interventions/cycle-de-vie";
import {
  lireFicheIntervention,
  type ValorisationAffichee,
} from "@/lib/interventions/depot";
import type { StatutIntervention } from "@/lib/interventions/saisie";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";
import {
  accesAuxMontants,
  type AccesAuxMontants,
} from "@/lib/interventions/montants-visibles";
import { optionsDAffectation } from "@/lib/interventions/personnes";
import { accesSurCetteIntervention } from "@/lib/interventions/perimetre-technicien";
import { libellesDesMachines, machinesDesSites } from "@/lib/machines/depot";
import { formatMoney } from "@/lib/money";

import { CLASSES_STATUT } from "@/lib/theme/statuts";

import {
  machinesIdentifiees,
  referenceAffichee,
  retourPlanning,
  technicienAfficheSurLaFiche,
} from "../presentation";
import { CLASSES_LIEN } from "@/lib/theme/apparence";

/**
 * LA FICHE D'INTERVENTION (lot 2, D84) — et les quatre actions.
 *
 * ## Le refus s'affiche À LA PLACE de l'action, avec sa raison
 *
 * C'est la consigne d'exploitation, et elle change la forme de cet écran : un
 * bouton refusé n'est pas grisé avec une infobulle, il est **remplacé** par le
 * motif du refus, en oxyde. *Il ne disparaît jamais en silence et ne se
 * contourne pas depuis l'écran.*
 *
 * Et il ne se contourne pas non plus par une requête : les mêmes refus sont
 * tenus par `intervention_cycle_de_vie` en base. Cet écran DIT ce que la base
 * ferait ; il ne le décide pas.
 *
 * ## R2-08 — LA FORME DE FICHE DE LA MAQUETTE, LUE ET NON APPROCHÉE
 *
 * *Mesuré le 11/09/2026 : `max-w-3xl` — 768 px dans une fenêtre de 1700*, et
 * cinq actions empilées à la file sous l'identification. La maquette ne décrit
 * aucune fiche d'intervention, mais elle décrit **une fiche** : `.mach`, deux
 * colonnes `1fr 300px` ; `.dl`, une grille `132px 1fr` à 13 px, étiquettes
 * grises en 12 px et valeurs en demi-gras. *C'est cette FORME qui se reprend,
 * pas son contenu* — l'acceptation du ticket l'écrit ainsi.
 *
 * **Les cinq actions passent en colonne latérale**, et cela ne change rien à
 * leur régime : un refus reste affiché À LA PLACE de l'action, avec sa raison.
 * Ce qui change est qu'on voit désormais l'identification et les actions
 * ENSEMBLE — *on décide d'annuler une intervention en regardant ce qu'elle est,
 * pas en s'en souvenant après avoir défilé.*
 *
 * ## LA MACHINE ÉTAIT ABSENTE DE CETTE FICHE — GAP COMBLÉ (audit du 19/09/2026)
 *
 * *Mesuré : le mot « machine » n'apparaissait nulle part dans ce fichier — pas
 * une donnée vide, un champ qui n'existait pas.* `CHAMPS_LIGNE`
 * (`lib/interventions/depot.ts`) lit pourtant `machines` depuis L2-08a, et
 * `/interventions` les affiche depuis le 18/09/2026. La maquette ne dessine
 * aucune fiche d'intervention (voir R2-08 ci-dessus) : elle ne dit donc rien
 * de ce bloc non plus, et la forme retenue est celle que le registre porte
 * déjà — `machinesAffichees`, reprise telle quelle depuis
 * `../presentation.ts` plutôt que réécrite une troisième fois. Une
 * intervention pouvant porter plusieurs machines (`intervention_machine`),
 * la ligne les joint par une virgule ; aucune ne se dit par le tiret
 * (RG-INT-01 : aucune machine rattachée signifie le site entier, jamais un
 * oubli d'écran).
 */
export default async function PageIntervention({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await obtenirSession(await headers());
  if (session === null) {
    redirect("/connexion");
  }
  if (session.contexte.societeId === null) {
    redirect("/arrivee");
  }

  const { id } = await params;
  const motif = (await searchParams).motif;
  const fiche = await lireFicheIntervention(session.contexte, id);
  if (fiche === null) {
    // Hors périmètre et inexistante rendent LA MÊME chose : les distinguer
    // ferait un oracle (D35, D50).
    notFound();
  }

  const ligne = fiche.ligne;
  const statut = ligne.statut as StatutIntervention;
  // LA DÉCISION EST PRISE ICI, UNE FOIS, et le bloc plus bas ne fait que la
  // rendre — *une règle écrite dans le JSX ne s'éprouve qu'en montant un
  // rendu*, et c'est la raison pour laquelle ce critère vit dans un module.
  const montants = accesAuxMontants(session.contexte.role);
  // LE DROIT D'AFFECTER / DE DÉPLACER (extension de la revue Codex de la PR
  // #267, de ma propre initiative, 20/09/2026) — la remarque ne citait que
  // `/interventions/nouvelle`, mais le MÊME défaut existe ici : les deux
  // sélecteurs technicien de cette fiche ont été introduits par LE MÊME LOT
  // (chantier TECH-1), sur du code que cette PR touche déjà — ce n'est donc
  // pas un défaut préexistant hors périmètre. Lu depuis la matrice
  // (`peut(role, capacité)`), la MÊME capacité que celle que les routes
  // `/api/interventions/[id]/affecter` et `.../deplacer` exigent déjà
  // côté serveur — jamais une comparaison de rôle inventée ici.
  const peutQualifierAffecter =
    session.contexte.role !== null &&
    peut(session.contexte.role, "qualifier_affecter");
  const peutModifierLePlanning =
    session.contexte.role !== null &&
    peut(session.contexte.role, "modifier_planning");
  // ── D131 (23/09/2026, DROITS-1) — LE BLOC QUI NE S'AFFICHE PAS ──────────
  //
  // *Un bloc que le rôle courant ne peut pas accomplir ne s'affiche pas*,
  // plutôt qu'un bouton qui mène à un refus — c'est la consigne du ticket, et
  // elle change le RÉGIME de ces trois blocs par rapport aux autres : un
  // refus de STATUT (intervention clôturée, par exemple) continue de
  // s'afficher en oxyde à la place de l'action ; un refus de CAPACITÉ ou de
  // PÉRIMÈTRE fait disparaître le bloc entier — la même distinction que
  // « Affecter » applique déjà à `qualification_requise`.
  //
  // Lu depuis la matrice (`accesSurCetteIntervention`, qui compose `niveau`
  // et le technicien affecté de CETTE ligne), jamais une seconde liste de
  // rôles écrite ici.
  const contexteActif: ContexteActif | null =
    session.contexte.role === null ? null : (session.contexte as ContexteActif);
  const peutClore =
    contexteActif !== null &&
    accesSurCetteIntervention(
      contexteActif,
      "cloturer_intervention",
      ligne.technicien_id,
    );
  const peutSuspendreOuReprendre =
    contexteActif !== null &&
    accesSurCetteIntervention(
      contexteActif,
      "suspendre_reprendre_intervention",
      ligne.technicien_id,
    );
  const peutAnnulerCetteIntervention =
    contexteActif !== null &&
    accesSurCetteIntervention(
      contexteActif,
      "annuler_intervention",
      ligne.technicien_id,
    );
  // LA LISTE NOMINATIVE N'EST DEMANDÉE À L'ANNUAIRE QUE SI UN FORMULAIRE EN A
  // L'USAGE — jamais par défaut : c'est la lecture, pas seulement le rendu,
  // qui fuyait (même raisonnement qu'à la création).
  const proposerUneListeDeTechniciens =
    peutQualifierAffecter || peutModifierLePlanning;
  // LE NOM, JAMAIS L'IDENTIFIANT (I10, D-04) — voir `technicienAfficheSurLaFiche`.
  //
  // **DEPUIS LE CHANTIER TECH-1 (20/09/2026), CETTE LECTURE PORTE AUSSI LES
  // TECHNICIENS ACTIFS**, mais SEULEMENT quand `proposerUneListeDeTechniciens`
  // — pour remplir le `<select>` d'« Affecter » et de « Déplacer », qui
  // remplace un champ texte nu. *Un technicien inactif n'entre pas dans la
  // liste PROPOSÉE à une nouvelle saisie* — même règle que
  // `/interventions/nouvelle` —, **mais le technicien déjà affecté à cette
  // intervention garde sa colonne dans l'annuaire même s'il est devenu
  // inactif entre-temps** : sans quoi son nom, affiché juste au-dessus par
  // `technicienAfficheSurLaFiche`, disparaîtrait du `<select>` en dessous —
  // deux lectures d'un même fait qui se contrediraient sur le même écran.
  const techniciensActifs = proposerUneListeDeTechniciens
    ? await avecContexteApplicatif(session.contexte, (tx) =>
        tx.technicien.findMany({
          where: { actif: true },
          select: { utilisateur_id: true },
          orderBy: { utilisateur_id: "asc" },
        }),
      )
    : [];
  const annuaire = await avecContexteApplicatif(session.contexte, (tx) =>
    annuaireDesPersonnes(tx, [
      ...techniciensActifs.map((technicien) => technicien.utilisateur_id),
      ...(ligne.technicien_id === null ? [] : [ligne.technicien_id]),
    ]),
  );
  const nomTechnicien = technicienAfficheSurLaFiche(
    ligne.technicien_id,
    annuaire,
  );
  // ── « AFFECTER » DIT LE BLOCAGE AVANT LE CHOIX (PLANNING-1, RG-PLA-06,
  // 22/09/2026). *Mesuré* : la liste était nue, le refus n'arrivait qu'au
  // dépôt, après la tentative. Les blocages sont lus À LA DATE de
  // l'intervention — la seule que ce formulaire engage —, sous le contexte
  // cloisonné (forme « interne », D94, même lecture que `/absences`). La
  // borne SQL est le jour ; le critère est `absenceCouvrant`, dans
  // `optionsDAffectation`, et lui seul (§9, 01/09).
  //
  // « DÉPLACER » garde la liste NUE : sa date se saisit dans le même
  // formulaire, et un suffixe « à cette date » y parlerait d'une date que
  // l'utilisateur est en train de changer — une affirmation sur un état
  // qu'on n'a pas observé (§9, 07/09).
  const blocagesALaDate =
    proposerUneListeDeTechniciens && ligne.date_planifiee !== null
      ? await absencesDeLaPeriode(
          session.contexte,
          ligne.date_planifiee,
          ligne.date_planifiee,
        )
      : [];
  const optionsAffectation = optionsDAffectation(
    techniciensActifs,
    annuaire,
    blocagesALaDate,
    ligne.date_planifiee,
  );
  const optionsTechniciens = optionsDAffectation(
    techniciensActifs,
    annuaire,
    [],
    null,
  );
  // « AFFECTER » N'A QU'UN CHAMP, ET C'EST CELUI QUI FUYAIT : un rôle sans
  // `qualifier_affecter` verrait un bouton dont le seul champ est vide —
  // *un champ pré-rempli qu'on ne peut pas remplir est un affichage déguisé
  // en saisie*, la même réserve que D120 pose ailleurs sur cette fiche. Le
  // refus prend donc la place de TOUTE l'action, comme la consigne
  // d'exploitation le veut déjà pour un refus de statut.
  const verdictAffecter: Verdict = peutQualifierAffecter
    ? peutAffecter(statut)
    : { refuse: true, cle: "intervention.refus.qualification_requise" };
  // LES MACHINES DU SITE DE L'INTERVENTION (chantier INT-MACHINE 2.2) — connu
  // côté serveur, aucun filtrage JS n'est nécessaire ici (à la différence du
  // formulaire de création, où le site se choisit APRÈS le chargement de la
  // page).
  const machinesDuSite = await machinesDesSites(session.contexte, [
    ligne.site_id,
  ]);
  // LE OU LES MACHINES DE L'INTERVENTION (audit du 19/09/2026) — GAP COMBLÉ :
  // cette fiche ne portait aucun champ machine, alors que `CHAMPS_LIGNE` lit
  // déjà `ligne.machines` et que `/interventions` les affiche depuis le
  // 18/09/2026. `libellesDesMachines` et `machinesAffichees` sont les MÊMES
  // fonctions que la liste (`../presentation.ts`) : une seule écriture de
  // « quelles machines, avec quel mot pour zéro », jamais une troisième forme.
  const libellesMachines = await libellesDesMachines(
    session.contexte,
    ligne.machines.map((m) => m.machine_id),
  );

  return (
    <Page
      chemin="/interventions"
      titre={
        <span className="inline-flex flex-wrap items-center gap-3">
          <span>
            {t("intervention.titre")} {referenceAffichee(ligne)}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${CLASSES_STATUT[statut]}`}
          >
            {t(`statut.${statut}`)}
          </span>
        </span>
      }
      sousTitre={
        ligne.numero === null ? t("intervention.sans_numero") : undefined
      }
      actions={
        <span className="inline-flex items-center gap-3">
          {/*
            LE BON D'INTERVENTION IMPRIMABLE (lot 16, BON-1) — un lien, pas un
            bouton d'action : cette fiche ne décide de rien de plus, elle mène
            à l'écran qui imprime. Sans lui, le bon existerait sans aucun
            appelant (§9, la maladie que le portail a déjà soignée).
          */}
          <Link
            href={`/interventions/${ligne.id}/bon`}
            className={CLASSES_LIEN}
          >
            {t("intervention.bon.titre")}
          </Link>
          <Link
            href={retourPlanning(ligne.date_planifiee)}
            className="text-app-encre-faible text-[12.5px]"
          >
            {t("planning.retour_fleche")}
          </Link>
        </span>
      }
    >
      {typeof motif === "string" && estCleTraduction(motif) ? (
        <p
          role="status"
          className="border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre rounded-md border px-3.5 py-2.5 text-[12.5px]"
        >
          {t(motif)}
        </p>
      ) : null}

      {/* `.mach` de la maquette : deux colonnes, 1fr et 300 px. */}
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_300px]">
        <div className="flex flex-col gap-4">
          <section className="bg-app-surface border-app-bord rounded-lg border px-4 py-3.5">
            <dl className="grid grid-cols-[132px_1fr] gap-x-3 gap-y-2.5 text-[13px]">
              <Ligne
                libelle={t("intervention.type")}
                valeur={t(`type_intervention.${ligne.type}`)}
              />
              <Ligne
                libelle={t("intervention.priorite")}
                valeur={t(`priorite.${ligne.priorite}`)}
              />
              {/*
                LE CLIENT MÈNE À SA FICHE (LIENS-1). Même raisonnement que le
                lien du site juste en dessous : un client hors périmètre ne
                serait pas lu du tout (`fiche.client` resterait `null`), et le
                lien mènerait au même refus que partout ailleurs (D35, D50).
              */}
              <Ligne
                libelle={t("intervention.client")}
                valeur={fiche.client ?? TIRET}
                lien={`/clients/${ligne.client_id}`}
              />
              {/*
                LA MACHINE SUIT DIRECTEMENT LE CLIENT — même ordre que la
                colonne du registre (D125/D128) : « machine » y suit
                immédiatement « client ». Une ou plusieurs, chacune un LIEN
                vers sa fiche (LIENS-1) — `machinesAffichees` reste la forme
                CHAÎNE employée par la liste et le bon imprimable, que ce
                bloc ne touche pas.
              */}
              <LigneMachines
                libelle={t("intervention.machine")}
                machines={machinesIdentifiees(ligne, libellesMachines)}
              />
              {/*
                LE LIEU MÈNE À SA FICHE (L3-16). C'est ce lien qui donne un
                APPELANT à l'écran « Sites » : la maquette ne lui donne aucune
                entrée de barre — sa liste est close et un gardien la
                confronte —, et *une interface sans appelant est la maladie que
                le portail a soignée.*

                `lieu` est le libellé rendu par la lecture cloisonnée ; son
                identifiant est sur la ligne. Un site hors périmètre ne serait
                pas lu du tout, et le lien mènerait à un 404 — c'est-à-dire au
                même refus que partout ailleurs (D35, D50).
              */}
              <Ligne
                libelle={mot("site")}
                valeur={fiche.lieu ?? TIRET}
                lien={`/sites/${ligne.site_id}`}
              />
              <Ligne
                libelle={mot("agence")}
                valeur={fiche.rattachement ?? TIRET}
                note={t("intervention.deduit_du_lieu")}
              />
              <Ligne
                libelle={t("intervention.forfait_deplacement")}
                valeur={fiche.forfait ?? TIRET}
                note={t("intervention.deduit_du_lieu")}
              />
              <Ligne
                libelle={t("intervention.technicien")}
                valeur={nomTechnicien}
              />
              <Ligne
                libelle={t("intervention.mode_valorisation")}
                valeur={t(`mode_valorisation.${ligne.mode_valorisation}`)}
              />
              {ligne.motif_annulation !== null ? (
                <Ligne
                  libelle={t("intervention.annulation.motif")}
                  valeur={ligne.motif_annulation}
                />
              ) : null}
            </dl>
          </section>

          {fiche.habilitations === null ? null : (
            <Habilitations verdict={fiche.habilitations} />
          )}

          {/*
            AJOUTER UNE MACHINE APRÈS COUP (chantier INT-MACHINE 2.2,
            20/09/2026) — le dépôt sait déjà écrire `intervention_machine` à
            la CRÉATION ; ce mini-formulaire couvre le cas où le diagnostic
            arrive plus tard. La liste ne propose que les machines DU SITE de
            cette intervention (voir `ajouterMachineAIntervention`, qui tient
            la même règle côté serveur contre un formulaire forgé).
          */}
          <section className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-lg border px-4 py-3.5">
            <h2 className="text-[13px] font-bold">
              {t("intervention.machine.ajouter_titre")}
            </h2>
            {machinesDuSite.length === 0 ? (
              <p className="text-app-encre-faible text-[12px]">
                {t("intervention.machine.aucune_au_site")}
              </p>
            ) : (
              <form
                action={`/api/interventions/${ligne.id}/machine`}
                method="post"
                className="flex flex-col gap-3"
              >
                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  {t("intervention.machine")}
                  <select
                    name="machine_id"
                    required
                    className="border-input bg-background rounded-md border px-3 py-2 font-normal"
                  >
                    {machinesDuSite.map((machine) => (
                      <option key={machine.id} value={machine.id}>
                        {machine.libelle}
                      </option>
                    ))}
                  </select>
                </label>
                <Button type="submit" variant="outline" size="sm">
                  {t("intervention.machine.ajouter_action")}
                </Button>
              </form>
            )}
          </section>

          {fiche.valorisation !== null && fiche.devise !== null ? (
            <Valorisation
              valorisation={fiche.valorisation}
              devise={fiche.devise}
              montants={montants}
            />
          ) : null}
        </div>

        <aside className="flex flex-col gap-4">
          <Action
            titre={t("intervention.action.affecter")}
            verdict={verdictAffecter}
            action={`/api/interventions/${ligne.id}/affecter`}
          >
            <Saisie
              nom="technicien_id"
              libelle={t("intervention.technicien")}
              options={optionsAffectation}
              libelleOptionVide={t("intervention.aucun_technicien")}
              valeurParDefaut={ligne.technicien_id ?? undefined}
            />
          </Action>

          {/*
        LA VOIE SANS GLISSÉ (R2-19) — même route, même décision.

        *Une fonction qui n'existe qu'à la souris exclut le tactile et le
        clavier.* Ce formulaire fait exactement ce que le glisser-déposer du
        planning fait, aux mêmes refus près : chaque bloc du planning est un
        lien vers cette fiche, atteignable à la tabulation.

        L'heure se saisit en HEURE LOCALE, comme sur le planning : l'instant
        demande le fuseau de l'établissement, et c'est le dépôt qui le résout.
      */}
          <Action
            titre={t("intervention.action.deplacer")}
            verdict={peutDeplacer(statut)}
            action={`/api/interventions/${ligne.id}/deplacer`}
            note={t("intervention.deplacement.explication")}
          >
            <Saisie
              nom="date_planifiee"
              type="date"
              libelle={t("intervention.date")}
            />
            <Saisie
              nom="heure_debut"
              type="time"
              libelle={t("intervention.deplacement.heure")}
            />
            <Saisie
              nom="duree_min"
              type="number"
              libelle={t("intervention.deplacement.duree")}
            />
            {/*
              SEUL CE CHAMP DISPARAÎT, PAS LE FORMULAIRE ENTIER (extension de
              la revue Codex, 20/09/2026) : « Déplacer » restait déjà
              accessible, avant ce chantier, à un rôle sans `modifier_planning`
              — la route le refuse au SUBMIT, comme toujours. Ce que ce
              chantier ajoutait était la LISTE NOMINATIVE ; c'est elle, et
              elle seule, qui se retire ici. Date, heure et durée gardent le
              comportement PRÉEXISTANT, hors du périmètre de cette revue.
            */}
            {peutModifierLePlanning ? (
              <Saisie
                nom="technicien_id"
                libelle={t("intervention.technicien")}
                options={optionsTechniciens}
                libelleOptionVide={t("intervention.aucun_technicien")}
                valeurParDefaut={ligne.technicien_id ?? undefined}
              />
            ) : null}
          </Action>

          {/* LA GARDE JUGE LE TEMPS MESURÉ, jamais le validé (D120) : le champ
              de l'action est pré-rempli depuis le mesuré, et une garde qui juge
              ce qu'elle vient d'écrire ne juge rien. */}
          {peutClore ? (
            <Action
              titre={t("intervention.action.cloturer")}
              verdict={peutCloturer(statut, ligne.temps_mesure_min)}
              action={`/api/interventions/${ligne.id}/cloturer`}
              note={t("intervention.cloture.explication")}
            >
              {/* CE N'EST PLUS UNE SAISIE, C'EST UNE VALIDATION (D120). Le champ
                  arrive PRÉ-REMPLI avec ce que le compteur a compté : par défaut
                  le temps validé égale le temps mesuré, et il n'en diffère que
                  si quelqu'un l'a corrigé — on saura alors qui et quand. */}
              <Saisie
                nom="temps_valide_min"
                type="number"
                libelle={t("intervention.cloture.temps_valide")}
                valeurParDefaut={
                  ligne.temps_mesure_min === null
                    ? undefined
                    : String(ligne.temps_mesure_min)
                }
              />
            </Action>
          ) : null}

          {/*
        LA SUSPENSION ET SA REPRISE (L2-10, RG-INT-06).

        *Une seule des deux s'offre à la fois*, et ce n'est pas une commodité
        d'affichage : le verdict de chacune refuse l'état de l'autre, et un
        refus prend la place de l'action avec sa raison — jamais un bouton
        grisé, qui laisse croire qu'il suffirait d'insister.

        La référence de pièce et sa date sont dans le MÊME formulaire, parce
        qu'elles se saisissent ensemble ou pas du tout.
      */}
          {!peutSuspendreOuReprendre ? null : statut === "suspendue" ? (
            <Action
              titre={t("intervention.action.reprendre")}
              verdict={peutReprendre(statut)}
              action={`/api/interventions/${ligne.id}/reprendre`}
            />
          ) : (
            <Action
              titre={t("intervention.action.suspendre")}
              verdict={peutSuspendre(statut, "—")}
              action={`/api/interventions/${ligne.id}/suspendre`}
              note={t("intervention.suspension.piece_aide")}
            >
              <Saisie
                nom="motif"
                libelle={t("intervention.suspension.motif")}
              />
              <Saisie
                nom="piece_attendue_ref"
                libelle={t("intervention.suspension.piece")}
              />
              <Saisie
                nom="date_dispo_prevue"
                type="date"
                libelle={t("intervention.suspension.date_dispo")}
              />
            </Action>
          )}

          {peutAnnulerCetteIntervention ? (
            <Action
              titre={t("intervention.action.annuler")}
              verdict={peutAnnuler(statut)}
              action={`/api/interventions/${ligne.id}/annuler`}
              note={t("intervention.annulation.obligatoire")}
            >
              <Saisie
                nom="motif"
                libelle={t("intervention.annulation.motif")}
              />
            </Action>
          ) : null}
        </aside>
      </div>
    </Page>
  );
}

/** Ce qu'on affiche à la place d'une valeur qu'on n'a pas — jamais un vide. */
const TIRET = "—";

/**
 * RG-PLA-04 À L'ÉCRAN — **ce que le canal de refus ne peut pas dire** (L3-02,
 * D73).
 *
 * > « habilitation BR absente », « habilitation CACES expirée le 12/08/2026 » —
 * > jamais « impossible ».
 *
 * Le refus voyage en CLÉ de dictionnaire, et il le doit : *sans ce filtre, une
 * réponse forgée ferait écrire n'importe quoi à la page* (L1-02f). **Un code
 * d'habilitation ne peut donc pas voyager avec lui** — c'est une donnée de
 * société, et un paramètre d'URL recopié à l'écran est un canal d'écriture
 * (D50). Il est **lu en base**, sous le contexte cloisonné, par la même lecture
 * qui rend la fiche : le dépôt le résout, l'écran l'affiche.
 *
 * **Les deux moitiés de la règle sont ici, et la seconde n'avait aucun
 * appelant** : ce qui BLOQUE et ce qui AVERTIT. *Une règle dont une moitié est
 * calculée puis jetée n'est pas appliquée à moitié : elle n'est pas appliquée.*
 *
 * **Et ce n'est jamais un contrôle d'accès** : cette section affiche ce que la
 * politique a déjà laissé lire. Masquer une ligne ici serait une seconde
 * lecture d'un critère que la base porte, et c'est celle qui vieillit sans
 * rougir.
 */
function Habilitations({ verdict }: { verdict: VerdictAffectation }) {
  const manquantes = [
    ...verdict.bloquantes.map((exigence) => ({ exigence, bloquant: true })),
    ...verdict.avertissements.map((exigence) => ({
      exigence,
      bloquant: false,
    })),
  ];
  return (
    <section className="bg-app-surface border-app-bord rounded-lg border px-4 py-3.5">
      <h2 className="mb-2 text-[12.5px] font-bold">
        {t("intervention.habilitations.exigees")}
      </h2>
      {manquantes.length === 0 ? (
        // **« Rien à signaler » S'ÉCRIT, il ne se déduit pas d'une absence.**
        // Une section vide se lit comme une section qu'on n'a pas remplie —
        // c'est le défaut que D88 nomme sur le registre des VGP, et il vaut ici.
        <p className="text-app-encre-faible text-[12px]">
          {t("intervention.habilitations.satisfaites")}
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5 text-[12px]">
          {manquantes.map(({ exigence, bloquant }) => (
            <li
              key={exigence.habilitation_id}
              className={
                bloquant ? "text-app-rouge-encre" : "text-app-encre-faible"
              }
            >
              <span className="font-bold">{exigence.code}</span>{" "}
              {exigence.motif === "absente"
                ? t("intervention.habilitations.absente")
                : `${t("intervention.habilitations.expiree_le")} ${dateCivile(
                    exigence.expiraitLe,
                  )}`}
              {bloquant
                ? `${t("ponctuation.separateur")}${t(
                    "intervention.habilitations.bloquante",
                  )}`
                : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * LE CALCUL DE D83, SOUS LES YEUX.
 *
 * *Voir l'arrondi et le plancher s'appliquer* était la demande, et un total
 * seul ne la satisfait pas : il donne le résultat sans donner la raison, et
 * c'est exactement ce qui fait douter d'une facture. Les quatre lignes se
 * lisent dans l'ordre du calcul — réel, arrondi, plancher, facturé — et le
 * plancher n'est signalé que lorsqu'il a réellement mordu.
 *
 * Aucun de ces nombres n'est recalculé ici : ils viennent de la même fonction
 * que la clôture. Un écran qui referait le calcul serait une seconde lecture
 * d'un même critère.
 */
function Valorisation({
  valorisation,
  devise,
  montants,
}: {
  valorisation: ValorisationAffichee;
  devise: { code: string; decimales: number; symbole: string | null };
  montants: AccesAuxMontants;
}) {
  return (
    <section className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-lg border px-4 py-3.5">
      <h2 className="text-[14px] font-bold">
        {t("intervention.cloture.facture")}
      </h2>
      {/*
        LE BLOC NE DISPARAÎT PAS — il est remplacé par son motif, exactement
        comme un refus d'action l'est en colonne latérale. *Un bloc absent se
        lirait « cette intervention n'a pas de montant » là où il faut lire
        « ce n'est pas pour vous »* (le motif de D88), et le titre reste pour
        que la différence soit visible.
      */}
      {montants.montre ? null : (
        <p className="text-app-oxyde text-[12.5px]">{t(montants.cle)}</p>
      )}
      {!montants.montre ? null : (
        <>
          <p className="text-app-encre-faible text-[11.5px]">
            {t("intervention.cloture.explication")}
          </p>
          <dl className="grid grid-cols-[132px_1fr] gap-x-3 gap-y-2.5 text-[13px]">
            <Ligne
              libelle={t("intervention.cloture.temps_valide")}
              valeur={minutes(valorisation.minutesReelles)}
            />
            <Ligne
              libelle={t("intervention.cloture.arrondi")}
              valeur={minutes(valorisation.minutesArrondies)}
            />
            {valorisation.plancherApplique ? (
              <Ligne
                libelle={t("intervention.cloture.plancher")}
                valeur={minutes(valorisation.minutesFacturees)}
              />
            ) : null}
            <Ligne
              libelle={t("intervention.cloture.taux")}
              valeur={formatMoney(valorisation.tauxHoraire, devise)}
            />
            {valorisation.mainDoeuvre === null ? null : (
              <Ligne
                libelle={t("intervention.cloture.main_doeuvre")}
                valeur={formatMoney(valorisation.mainDoeuvre, devise)}
              />
            )}
            {/*
          LE FORFAIT DE DÉPLACEMENT S'AFFICHE, et il entre dans le total
          (RG-INT-07, D77). *Il n'y entrait pas : « Total hors taxes » portait
          la main-d'œuvre seule.* Absent, la ligne ne s'affiche pas — le
          déplacement n'est alors pas facturé (D11), et une ligne à zéro
          dirait le contraire de ce qu'elle vaut.
        */}
            {valorisation.forfaitDeplacement === null ? null : (
              <Ligne
                libelle={t("intervention.cloture.forfait_deplacement")}
                valeur={formatMoney(valorisation.forfaitDeplacement, devise)}
              />
            )}
            {/*
          UN TOTAL INCONNU SE DIT, IL NE S'AFFICHE PAS À ZÉRO. *Zéro se lit
          « gratuit ».* Le motif prend la place du montant, en oxyde, comme un
          refus prend la place d'une action sur cet écran.
        */}
            <Ligne
              libelle={t("intervention.cloture.total")}
              valeur={
                valorisation.totalHT === null
                  ? t("intervention.cloture.total_inconnu")
                  : formatMoney(valorisation.totalHT, devise)
              }
            />
            {valorisation.motifTotalInconnu !== null &&
            estCleTraduction(valorisation.motifTotalInconnu) ? (
              <Ligne
                libelle={t("intervention.cloture.total_motif")}
                valeur={t(valorisation.motifTotalInconnu)}
              />
            ) : null}
          </dl>
        </>
      )}
    </section>
  );
}

/** Des minutes en heures et minutes — `75` se lit « 1 h 15 », jamais « 75 ». */
function minutes(total: number): string {
  const heures = Math.floor(total / 60);
  const reste = String(total % 60).padStart(2, "0");
  return heures === 0 ? `${reste} min` : `${heures} h ${reste}`;
}

function Ligne({
  libelle,
  valeur,
  note,
  lien,
}: {
  libelle: string;
  valeur: string;
  note?: string;
  /** Vers où la valeur mène, quand elle mène quelque part. */
  lien?: string;
}) {
  // `.dl` de la maquette : étiquette grise en 12 px, valeur en demi-gras, sur
  // deux colonnes que le PARENT tient — d'où le fragment plutôt qu'un `div`,
  // sans quoi chaque ligne formerait sa propre grille et les étiquettes ne
  // s'aligneraient plus.
  return (
    <>
      <dt className="text-app-encre-faible text-[12px]">{libelle}</dt>
      <dd className="font-semibold break-all">
        {lien === undefined ? (
          valeur
        ) : (
          <Link href={lien} className={CLASSES_LIEN}>
            {valeur}
          </Link>
        )}
        {note === undefined ? null : (
          <span className="text-app-encre-faible block text-[11.5px] font-normal">
            {note}
          </span>
        )}
      </dd>
    </>
  );
}

/**
 * LES MACHINES, CHACUNE UN LIEN — même paire dt/dd que `Ligne`, mais `Ligne`
 * ne porte qu'UN `lien` : plusieurs machines veulent chacune le sien (LIENS-1).
 *
 * Une machine SANS libellé lu (hors périmètre, cas de bord) garde le signe
 * d'absence, en texte — jamais un lien mort vers une fiche qu'on ne peut pas
 * nommer.
 */
function LigneMachines({
  libelle,
  machines,
}: {
  libelle: string;
  machines: readonly {
    readonly machineId: string;
    readonly libelle: string | null;
  }[];
}) {
  return (
    <>
      <dt className="text-app-encre-faible text-[12px]">{libelle}</dt>
      <dd className="font-semibold break-all">{contenuMachines(machines)}</dd>
    </>
  );
}

/**
 * COMPOSÉ HORS DE L'ARBRE JSX DE `LigneMachines`, jamais dans son `return`
 * — même geste que `machinesAffichees` (`../presentation.ts`) qui compose sa
 * propre forme chaîne en dehors de tout JSX. Le signe d'absence et la
 * virgule qui sépare deux machines sont un FAIT DE STRUCTURE, au même titre
 * que le séparateur que ce fichier compose déjà pour la forme chaîne — pas
 * un libellé métier qui changerait de mot d'une langue à l'autre.
 */
function contenuMachines(
  machines: readonly {
    readonly machineId: string;
    readonly libelle: string | null;
  }[],
): React.ReactNode {
  if (machines.length === 0) {
    return TIRET;
  }
  const noeuds: React.ReactNode[] = [];
  machines.forEach((machine, index) => {
    if (index > 0) {
      noeuds.push(SEPARATEUR_MACHINES);
    }
    noeuds.push(
      machine.libelle === null ? (
        TIRET
      ) : (
        <Link
          key={machine.machineId}
          href={`/parc/${machine.machineId}`}
          className={CLASSES_LIEN}
        >
          {machine.libelle}
        </Link>
      ),
    );
  });
  return noeuds;
}

/** Le séparateur entre deux machines de la même ligne — recopié de `machinesAffichees`. */
const SEPARATEUR_MACHINES = ", ";

function Saisie({
  nom,
  libelle,
  type = "text",
  valeurParDefaut,
  options,
  libelleOptionVide,
}: {
  nom: string;
  libelle: string;
  type?: "text" | "number" | "date" | "time";
  /**
   * La valeur PRÉ-REMPLIE, quand il y en a une à proposer (D120).
   *
   * `defaultValue` et non `value` : le champ reste **modifiable**. *Un champ
   * pré-rempli qu'on ne peut pas changer est un affichage déguisé en saisie* —
   * et c'est précisément la correction que la validation doit permettre.
   */
  valeurParDefaut?: string;
  /**
   * UNE LISTE FERMÉE PLUTÔT QU'UNE SAISIE LIBRE (chantier TECH-1, 20/09/2026)
   * — rend un `<select>` au lieu d'un `<input>` quand elle est fournie.
   *
   * *Le champ technicien était un `<input type="text">` nu* : rien
   * n'empêchait d'y taper un UUID inventé, ni de deviner celui d'un
   * technicien qu'on n'a pas le droit de nommer. La liste vient TOUJOURS de
   * l'appelant, déjà résolue sous le contexte cloisonné (§9, 01/09 : ce
   * composant ne lit ni base ni politique).
   */
  options?: readonly {
    readonly valeur: string;
    readonly libelle: string;
    /**
     * L'option DIT que l'agenda est bloqué (PLANNING-1, RG-PLA-06) — elle
     * reste sélectionnable, le dépôt tranche. `data-agenda-bloque` est ce
     * qu'un scénario interroge, jamais le texte du libellé.
     */
    readonly bloque?: boolean;
  }[];
  /** L'option vide du `<select>`, quand `options` est fourni et qu'elle a un sens (ex. « Aucun technicien affecté »). */
  libelleOptionVide?: string;
}) {
  if (options !== undefined) {
    return (
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {libelle}
        <select
          name={nom}
          defaultValue={valeurParDefaut ?? ""}
          className="border-input bg-background rounded-md border px-3 py-2 font-normal"
        >
          {libelleOptionVide === undefined ? null : (
            <option value="">{libelleOptionVide}</option>
          )}
          {options.map((option) => (
            <option
              key={option.valeur}
              value={option.valeur}
              {...(option.bloque === true ? { "data-agenda-bloque": "" } : {})}
            >
              {option.libelle}
            </option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {libelle}
      <input
        name={nom}
        type={type}
        defaultValue={valeurParDefaut}
        className="border-input bg-background rounded-md border px-3 py-2 font-normal"
      />
    </label>
  );
}

/**
 * UNE ACTION, OU SON REFUS — jamais les deux, jamais un bouton grisé.
 *
 * *Le refus s'affiche à la place, en oxyde, avec sa raison écrite.* Un bouton
 * désactivé laisse croire qu'il suffirait d'insister ; un refus qui prend la
 * place de l'action dit ce qui bloque et pourquoi.
 */
function Action({
  titre,
  verdict,
  action,
  note,
  children,
}: {
  titre: string;
  verdict: { refuse: boolean; cle?: string };
  action: string;
  note?: string;
  /**
   * FACULTATIF depuis L2-10 : la reprise ne saisit rien — le statut retrouvé se
   * déduit du créneau, et le motif est effacé par la base. *Une action sans
   * champ n'est pas une action incomplète.*
   */
  children?: React.ReactNode;
}) {
  if (verdict.refuse) {
    const cle = verdict.cle;
    return (
      <section className="border-app-rouge-bord bg-app-rouge-fond flex flex-col gap-1 rounded-lg border px-4 py-3">
        <h2 className="text-[13px] font-bold">{titre}</h2>
        <p className="text-app-rouge-encre text-[12.5px]">
          {cle !== undefined && estCleTraduction(cle) ? t(cle) : ""}
        </p>
      </section>
    );
  }
  return (
    <form
      action={action}
      method="post"
      className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-lg border px-4 py-3"
    >
      <h2 className="text-[13px] font-bold">{titre}</h2>
      {note === undefined ? null : (
        <p className="text-app-encre-faible text-[11.5px]">{note}</p>
      )}
      {children}
      <Button type="submit" variant="outline" size="sm">
        {titre}
      </Button>
    </form>
  );
}
