import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { obtenirSession } from "@/lib/auth/session";
import { dateCivile } from "@/lib/calendar/fuseau";
import type { VerdictAffectation } from "@/lib/habilitations/affectation";
import {
  peutAffecter,
  peutAnnuler,
  peutCloturer,
  peutDeplacer,
  peutReprendre,
  peutSuspendre,
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
import { formatMoney } from "@/lib/money";

import { CLASSES_STATUT } from "@/lib/theme/statuts";

import { referenceAffichee, retourPlanning } from "../presentation";
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

  return (
    <main className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <Link
          href={retourPlanning(ligne.date_planifiee)}
          className="text-app-encre-faible text-[12.5px]"
        >
          {t("planning.retour_fleche")}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[22px] font-extrabold tracking-tight">
            {t("intervention.titre")} {referenceAffichee(ligne)}
          </h1>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${CLASSES_STATUT[statut]}`}
          >
            {t(`statut.${statut}`)}
          </span>
        </div>
        {ligne.numero === null ? (
          <p className="text-app-encre-faible text-[11.5px]">
            {t("intervention.sans_numero")}
          </p>
        ) : null}
      </header>

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
          <section className="bg-app-surface border-app-bord rounded-[10px] border px-4 py-3.5">
            <dl className="grid grid-cols-[132px_1fr] gap-x-3 gap-y-2.5 text-[13px]">
              <Ligne
                libelle={t("intervention.type")}
                valeur={t(`type_intervention.${ligne.type}`)}
              />
              <Ligne
                libelle={t("intervention.priorite")}
                valeur={t(`priorite.${ligne.priorite}`)}
              />
              <Ligne
                libelle={t("intervention.client")}
                valeur={fiche.client ?? TIRET}
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
                valeur={
                  ligne.technicien_id ?? t("intervention.aucun_technicien")
                }
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
            verdict={peutAffecter(statut)}
            action={`/api/interventions/${ligne.id}/affecter`}
          >
            <Saisie
              nom="technicien_id"
              libelle={t("intervention.technicien")}
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
            <Saisie
              nom="technicien_id"
              libelle={t("intervention.technicien")}
            />
          </Action>

          {/* LA GARDE JUGE LE TEMPS MESURÉ, jamais le validé (D120) : le champ
              de l'action est pré-rempli depuis le mesuré, et une garde qui juge
              ce qu'elle vient d'écrire ne juge rien. */}
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

          {/*
        LA SUSPENSION ET SA REPRISE (L2-10, RG-INT-06).

        *Une seule des deux s'offre à la fois*, et ce n'est pas une commodité
        d'affichage : le verdict de chacune refuse l'état de l'autre, et un
        refus prend la place de l'action avec sa raison — jamais un bouton
        grisé, qui laisse croire qu'il suffirait d'insister.

        La référence de pièce et sa date sont dans le MÊME formulaire, parce
        qu'elles se saisissent ensemble ou pas du tout.
      */}
          {statut === "suspendue" ? (
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

          <Action
            titre={t("intervention.action.annuler")}
            verdict={peutAnnuler(statut)}
            action={`/api/interventions/${ligne.id}/annuler`}
            note={t("intervention.annulation.obligatoire")}
          >
            <Saisie nom="motif" libelle={t("intervention.annulation.motif")} />
          </Action>
        </aside>
      </div>
    </main>
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
    <section className="bg-app-surface border-app-bord rounded-[10px] border px-4 py-3.5">
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
    <section className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-[10px] border px-4 py-3.5">
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

function Saisie({
  nom,
  libelle,
  type = "text",
  valeurParDefaut,
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
}) {
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
      <section className="border-app-rouge-bord bg-app-rouge-fond flex flex-col gap-1 rounded-[10px] border px-4 py-3">
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
      className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-[10px] border px-4 py-3"
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
