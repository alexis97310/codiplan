import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Page } from "@/components/mise-en-page/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Cellule, LignePleine, Tableau } from "@/components/ui/tableau";
import { obtenirSession } from "@/lib/auth/session";
import { dateCivile, maintenant, schemaFuseau } from "@/lib/calendar/fuseau";
import { avecContexteApplicatif } from "@/lib/db/client";
import {
  habilitationsDesTechniciens,
  listerHabilitations,
  type LigneAttribution,
  type LigneHabilitation,
} from "@/lib/habilitations/depot";
import {
  agencesDisponibles,
  listerLesTechniciens,
  type LigneTechnicien,
} from "@/lib/techniciens/depot";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";

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
 * personne concernée. Ni la connexion de la personne créée non plus : créer un
 * technicien crée son identité, pas son accès (voir `lib/techniciens/depot.ts`).
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
  const params = await searchParams;
  const motif = params.motif;
  const montrerInactifs = params.etat === "tous";

  const techniciens = await listerLesTechniciens(session.contexte);
  const agences = await agencesDisponibles(session.contexte);
  const affiches = montrerInactifs
    ? techniciens
    : techniciens.filter((technicien) => technicien.actif);

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
  const aujourdHui = maintenant(fuseau).instant;

  return (
    <Page
      chemin="/parametres/equipe"
      titre={t("equipe.titre")}
      sousTitre={t("equipe.sous_titre")}
    >
      {typeof motif === "string" && estCleTraduction(motif) ? (
        <p
          role="status"
          className="border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre rounded-md border px-3.5 py-2.5 text-[12.5px]"
        >
          {t(motif)}
        </p>
      ) : null}

      <section className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-lg border px-4 py-3.5">
        <h2 className="text-[14px] font-bold">{t("equipe.creer")}</h2>
        <FormulaireCreation
          agences={agences}
          soumettre={t("equipe.creer_action")}
        />
        <p className="text-app-encre-faible text-[11.5px]">
          {t("equipe.creer_aide")}
        </p>
      </section>

      <section className="bg-app-surface border-app-bord overflow-hidden rounded-lg border">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <h2 className="text-[14px] font-bold">{t("equipe.liste_titre")}</h2>
          <a
            href={
              montrerInactifs
                ? "/parametres/equipe"
                : "/parametres/equipe?etat=tous"
            }
            className="text-app-marque text-[12px] font-semibold underline"
          >
            {montrerInactifs
              ? t("equipe.filtre.masquer_inactifs")
              : t("equipe.filtre.montrer_inactifs")}
          </a>
        </div>
        <Tableau colonnes={colonnes()} minimum="760px">
          {affiches.length === 0 ? (
            <LignePleine colonnes={4}>{t("equipe.aucun")}</LignePleine>
          ) : null}
          {affiches.map((technicien) => (
            <tr key={technicien.utilisateurId}>
              <Cellule fort>{technicien.nom}</Cellule>
              <Cellule>{technicien.email}</Cellule>
              <Cellule>{technicien.agenceLibelle}</Cellule>
              <Cellule>
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={`#${ancreModification(technicien.utilisateurId)}`}
                    className="text-app-marque text-[12px] font-semibold underline"
                  >
                    {t("equipe.modifier")}
                  </a>
                  {technicien.actif ? (
                    <Badge ton="vert">{t("equipe.actif")}</Badge>
                  ) : (
                    <Badge ton="gris">{t("equipe.inactif")}</Badge>
                  )}
                </div>
              </Cellule>
            </tr>
          ))}
        </Tableau>
      </section>

      {/*
        REPLI PAR LIGNE (ERGO-1) — même raisonnement et même mesure que
        `/parametres/habilitations` (voir son commentaire). LE PANNEAU
        HABILITATIONS SUIT SON TECHNICIEN : il est posé DANS le même
        `<details>`, jamais à côté, pour rester replié avec lui.
      */}
      {affiches.map((technicien) => (
        <details
          key={technicien.utilisateurId}
          className="bg-app-surface border-app-bord flex flex-col gap-2 rounded-lg border px-4 py-3.5"
        >
          <summary className="cursor-pointer text-[13px] font-bold">
            {titreDeModification(technicien.nom)}
          </summary>
          <div id={ancreModification(technicien.utilisateurId)}>
            <FormulaireModification agences={agences} technicien={technicien} />

            <BlocHabilitations
              technicien={technicien}
              attributions={
                habilitationsParTechnicien.get(technicien.utilisateurId) ?? []
              }
              habilitations={habilitationsActives}
              aujourdHui={aujourdHui}
            />
          </div>
        </details>
      ))}
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

function colonnes() {
  return [
    { cle: "nom", libelle: t("equipe.nom") },
    { cle: "email", libelle: t("equipe.email") },
    { cle: "agence", libelle: libelleAgence() },
    { cle: "actif", libelle: t("equipe.activite"), largeur: "140px" },
  ];
}

type Agence = { readonly id: string; readonly libelle: string };

function SelectAgence({
  id,
  valeur,
  agences,
}: {
  readonly id: string;
  readonly valeur?: string;
  readonly agences: readonly Agence[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-app-encre-faible text-[11px]">
        {libelleAgence()}
      </label>
      <select
        id={id}
        name="agence_id"
        defaultValue={valeur ?? ""}
        required
        className="border-app-bord bg-app-surface min-w-44 rounded-md border px-2 py-1 text-[12.5px]"
      >
        <option value="" disabled>
          {t("equipe.choisir_rattachement")}
        </option>
        {agences.map((agence) => (
          <option key={agence.id} value={agence.id}>
            {agence.libelle}
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
      <label htmlFor={id} className="text-app-encre-faible text-[11px]">
        {libelle}
      </label>
      <input
        id={id}
        name={nom}
        type={type}
        required
        defaultValue={valeur}
        className="border-app-bord bg-app-surface min-w-56 rounded-md border px-2 py-1 text-[12.5px]"
      />
    </div>
  );
}

function FormulaireCreation({
  agences,
  soumettre,
}: {
  readonly agences: readonly Agence[];
  readonly soumettre: string;
}) {
  return (
    <form
      action="/api/techniciens/creer"
      method="post"
      className="flex flex-wrap items-end gap-2"
    >
      <Champ id="nouveau-nom" nom="nom" libelle={t("equipe.nom")} type="text" />
      <Champ
        id="nouveau-email"
        nom="email"
        libelle={t("equipe.email")}
        type="email"
      />
      <SelectAgence id="nouveau-agence" agences={agences} />
      <label className="flex items-center gap-1.5 pb-1 text-[12.5px]">
        <input type="checkbox" name="actif" defaultChecked />
        {t("equipe.actif")}
      </label>
      <Button type="submit" variant="outline" size="sm">
        {soumettre}
      </Button>
    </form>
  );
}

function FormulaireModification({
  agences,
  technicien,
}: {
  readonly agences: readonly Agence[];
  readonly technicien: LigneTechnicien;
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
      <label className="flex items-center gap-1.5 pb-1 text-[12.5px]">
        <input type="checkbox" name="actif" defaultChecked={technicien.actif} />
        {t("equipe.actif")}
      </label>
      <Button type="submit" variant="outline" size="sm">
        {t("equipe.enregistrer")}
      </Button>
    </form>
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
  readonly aujourdHui: Date;
}) {
  return (
    <div className="border-app-bord mt-2 flex flex-col gap-2 border-t pt-3">
      <h3 className="text-app-encre-faible text-[11.5px] font-bold tracking-[0.4px] uppercase">
        {t("habilitations.technicien.titre")}
      </h3>
      {attributions.length === 0 ? (
        <p className="text-app-encre-faible text-[12px]">
          {t("habilitations.technicien.aucune")}
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {attributions.map((attribution) => (
            <li
              key={attribution.id}
              className="flex flex-wrap items-center gap-2 text-[12.5px]"
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
        <p className="text-app-encre-faible text-[12px]">
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
              className="text-app-encre-faible text-[11px]"
            >
              {t("habilitations.technicien.attribuer")}
            </label>
            <select
              id={`${technicien.utilisateurId}-habilitation`}
              name="habilitation_id"
              required
              defaultValue=""
              className="border-app-bord bg-app-surface min-w-44 rounded-md border px-2 py-1 text-[12.5px]"
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
      <label htmlFor={id} className="text-app-encre-faible text-[11px]">
        {libelle}
      </label>
      <input
        id={id}
        name={nom}
        type="date"
        required={requis === true}
        className="border-app-bord bg-app-surface rounded-md border px-2 py-1 text-[12.5px]"
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

function estExpiree(attribution: LigneAttribution, aujourdHui: Date): boolean {
  if (attribution.date_expiration === null) {
    return false;
  }
  const expiration = Date.UTC(
    attribution.date_expiration.getUTCFullYear(),
    attribution.date_expiration.getUTCMonth(),
    attribution.date_expiration.getUTCDate(),
  );
  const jourCourant = Date.UTC(
    aujourdHui.getUTCFullYear(),
    aujourdHui.getUTCMonth(),
    aujourdHui.getUTCDate(),
  );
  return expiration < jourCourant;
}
