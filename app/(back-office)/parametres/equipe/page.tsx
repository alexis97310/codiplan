import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Page } from "@/components/mise-en-page/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Cellule, LignePleine, Tableau } from "@/components/ui/tableau";
import { obtenirSession } from "@/lib/auth/session";
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
 * Ni le référentiel d'habilitations, ni leur attribution, ni les exigences
 * de site — ÉQUIPE-2. Ni la connexion de la personne créée : créer un
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
              montrerInactifs ? "/parametres/equipe" : "/parametres/equipe?etat=tous"
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
                {technicien.actif ? (
                  <Badge ton="vert">{t("equipe.actif")}</Badge>
                ) : (
                  <Badge ton="gris">{t("equipe.inactif")}</Badge>
                )}
              </Cellule>
            </tr>
          ))}
        </Tableau>
      </section>

      {affiches.map((technicien) => (
        <section
          key={technicien.utilisateurId}
          className="bg-app-surface border-app-bord flex flex-col gap-2 rounded-lg border px-4 py-3.5"
        >
          <h2 className="text-[13px] font-bold">
            {titreDeModification(technicien.nom)}
          </h2>
          <FormulaireModification agences={agences} technicien={technicien} />
        </section>
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
          {t("equipe.choisir_agence")}
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
        <input
          type="checkbox"
          name="actif"
          defaultChecked={technicien.actif}
        />
        {t("equipe.actif")}
      </label>
      <Button type="submit" variant="outline" size="sm">
        {t("equipe.enregistrer")}
      </Button>
    </form>
  );
}
