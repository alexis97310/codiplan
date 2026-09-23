import type { Metadata } from "next";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Page } from "@/components/mise-en-page/page";
import { Button } from "@/components/ui/button";
import { Cellule, LignePleine, Tableau } from "@/components/ui/tableau";
import { obtenirSession } from "@/lib/auth/session";
import {
  listerHabilitations,
  type LigneHabilitation,
} from "@/lib/habilitations/depot";
import { estCleTraduction, t } from "@/lib/i18n/fr";

export const metadata: Metadata = { title: t("habilitations.titre") };

/**
 * LE RÉFÉRENTIEL DES HABILITATIONS (ÉQUIPE-2 ; D9, D60).
 *
 * ## Pourquoi cet écran existe
 *
 * `lib/habilitations/affectation.ts` applique RG-PLA-04 depuis L1-04, et
 * `lib/interventions/depot.ts` l'appelle réellement à l'affectation comme au
 * déplacement — mesuré : ce chemin interroge `technicien_habilitation` et
 * `site_habilitation_requise` par de vraies requêtes. Mais rien ne pouvait
 * écrire ces tables hors du seed : ni référentiel, ni attribution, ni
 * exigence. Le verrou mordait sur des données qu'on ne pouvait alimenter qu'à
 * la main, en base.
 *
 * ## AUCUNE LISTE FERMÉE, ET C'EST D60
 *
 * Contrairement aux zones géographiques ou aux rôles de contact, le code
 * d'une habilitation est du texte libre : une société suivra des
 * qualifications qu'aucune nomenclature ne connaît — « formé sur telle
 * presse ». La liste réglementaire française n'est qu'un amorçage du seed.
 *
 * ## LA DURÉE DE VALIDITÉ NE CALCULE RIEN
 *
 * Elle aide la saisie d'une attribution ; la date qui DÉCIDE est celle portée
 * par chaque attribution (`technicien_habilitation.date_expiration`). Deux
 * sources d'un même fait divergent en silence — cet écran ne prétend donc
 * jamais dériver une échéance depuis cette colonne.
 *
 * ## Aucune SUPPRESSION, même raisonnement que les prestations
 *
 * Une attribution ou une exigence continuera de désigner une habilitation
 * retirée du choix ; `onDelete: Restrict` l'interdirait de toute façon. La
 * bascule d'activité retire du CHOIX sans toucher au passé.
 */
export default async function PageHabilitations({
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
  const motif = (await searchParams).motif;

  const habilitations = await listerHabilitations(session.contexte);

  return (
    <Page
      chemin="/parametres/habilitations"
      titre={t("habilitations.titre")}
      sousTitre={t("habilitations.sous_titre")}
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
        <h2 className="text-[14px] font-bold">{t("habilitations.creer")}</h2>
        <FormulaireHabilitation
          action="/api/habilitations/creer"
          soumettre={t("habilitations.creer_action")}
        />
        <p className="text-app-encre-faible text-[11.5px]">
          {t("habilitations.aide_duree")}
        </p>
      </section>

      <section className="bg-app-surface border-app-bord overflow-hidden rounded-lg border">
        <Tableau colonnes={colonnes()} minimum="820px">
          {habilitations.length === 0 ? (
            <LignePleine colonnes={4}>{t("habilitations.aucune")}</LignePleine>
          ) : null}
          {habilitations.map((habilitation) => (
            <tr key={habilitation.id}>
              <Cellule fort mono>
                {habilitation.code}
              </Cellule>
              <Cellule>{habilitation.libelle}</Cellule>
              <Cellule>{dureeAffichee(habilitation)}</Cellule>
              <Cellule>
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={`#${ancreModification(habilitation.id)}`}
                    className="text-app-marque text-[12px] font-semibold underline"
                  >
                    {t("habilitations.modifier")}
                  </a>
                  <span>
                    {habilitation.actif
                      ? t("habilitations.active")
                      : t("habilitations.inactive")}
                  </span>
                  <form
                    action={`/api/habilitations/${habilitation.id}/activite`}
                    method="post"
                  >
                    <input
                      type="hidden"
                      name="actif"
                      value={habilitation.actif ? INACTIF : ACTIF}
                    />
                    <Button type="submit" variant="outline" size="sm">
                      {habilitation.actif
                        ? t("habilitations.desactiver")
                        : t("habilitations.activer")}
                    </Button>
                  </form>
                </div>
              </Cellule>
            </tr>
          ))}
        </Tableau>
      </section>

      {/*
        REPLI PAR LIGNE (ERGO-1) — sur le modèle du motif VGP
        (`app/(back-office)/vgp/page.tsx`) : `<details>/<summary>` natif,
        replié par défaut, aucun JavaScript. Trente-sept formulaires ouverts
        en même temps sur cet écran (mesuré, `72dec66`, 1280×900 : 18 lignes
        → 37 <form>, 3 631 px) grossissaient linéairement avec le
        référentiel. Le lien « Modifier » du tableau cible un DIV posé DANS
        le contenu replié (jamais le <details> ni le <summary> eux-mêmes) :
        mesuré (script isolé, playwright, un <details> statique) — seule
        cette forme fait ouvrir le <details> tout seul à la navigation par
        ancre ; l'id posé sur le <details> ou sur le <summary> laisse le
        contenu caché.
      */}
      {habilitations.map((habilitation) => (
        <details
          key={habilitation.id}
          className="bg-app-surface border-app-bord flex flex-col gap-2 rounded-lg border px-4 py-3.5"
        >
          <summary className="cursor-pointer text-[13px] font-bold">
            {titreDeModification(habilitation.code)}
          </summary>
          <div id={ancreModification(habilitation.id)}>
            <FormulaireHabilitation
              action={`/api/habilitations/${habilitation.id}/modifier`}
              soumettre={t("habilitations.enregistrer")}
              valeurs={habilitation}
            />
          </div>
        </details>
      ))}
    </Page>
  );
}

const ACTIF = "oui";
const INACTIF = "non";
const TIRET = " — ";

/**
 * La composition est faite HORS du JSX — un littéral n'y est pas admis
 * (L0-11).
 */
function titreDeModification(code: string): string {
  return `${t("habilitations.modifier")}${TIRET}${code}`;
}

/**
 * L'ANCRE DU REPLI (ERGO-1) — jamais posée sur le `<details>` ni sur le
 * `<summary>` : voir le commentaire au-dessus de la liste des sections.
 */
function ancreModification(id: string): string {
  return `habilitation-${id}`;
}

function colonnes() {
  return [
    { cle: "code", libelle: t("habilitations.code"), largeur: "160px" },
    { cle: "libelle", libelle: t("habilitations.libelle") },
    { cle: "duree", libelle: t("habilitations.duree") },
    { cle: "actif", libelle: t("habilitations.activite"), largeur: "220px" },
  ];
}

/**
 * LE FORMULAIRE, ÉCRIT UNE FOIS ET RENDU DEUX — création et modification,
 * même raisonnement que `FormulairePrestation`.
 *
 * **La modification porte « Actif », la création ne le porte pas** :
 * `schemaCreationHabilitation` n'a pas ce champ — une habilitation naît
 * active, la base le décide par défaut. Recopier le champ en création aurait
 * inventé une saisie que le schéma refuse.
 */
function FormulaireHabilitation({
  action,
  soumettre,
  valeurs,
}: {
  readonly action: string;
  readonly soumettre: string;
  readonly valeurs?: LigneHabilitation;
}) {
  const prefixe = valeurs?.id ?? NOUVELLE;
  const modification = valeurs !== undefined;
  return (
    <form
      action={action}
      method="post"
      className="flex flex-wrap items-end gap-2"
    >
      <Champ
        id={`${prefixe}-code`}
        nom="code"
        libelle={t("habilitations.code")}
        valeur={valeurs?.code}
      />
      <Champ
        id={`${prefixe}-libelle`}
        nom="libelle"
        libelle={t("habilitations.libelle")}
        valeur={valeurs?.libelle}
        large
      />
      <Champ
        id={`${prefixe}-duree`}
        nom="duree_validite_mois"
        libelle={t("habilitations.duree_mois")}
        valeur={
          valeurs?.duree_validite_mois === null ||
          valeurs?.duree_validite_mois === undefined
            ? undefined
            : String(valeurs.duree_validite_mois)
        }
        nombre
      />
      {modification ? (
        <label className="flex items-center gap-1.5 pb-1 text-[12.5px]">
          <input type="checkbox" name="actif" defaultChecked={valeurs.actif} />
          {t("habilitations.active")}
        </label>
      ) : null}
      <Button type="submit" variant="outline" size="sm">
        {soumettre}
      </Button>
    </form>
  );
}

const NOUVELLE = "nouvelle";

function Champ({
  id,
  nom,
  libelle,
  valeur,
  large,
  nombre,
}: {
  readonly id: string;
  readonly nom: string;
  readonly libelle: string;
  readonly valeur?: string;
  readonly large?: boolean;
  readonly nombre?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-app-encre-faible text-[11px]">
        {libelle}
      </label>
      <input
        id={id}
        name={nom}
        type={nombre === true ? "number" : "text"}
        min={nombre === true ? 1 : undefined}
        defaultValue={valeur}
        className={`border-app-bord bg-app-surface rounded-md border px-2 py-1 text-[12.5px] ${large === true ? "min-w-64" : "w-36"}`}
      />
    </div>
  );
}

/**
 * LA DURÉE AFFICHÉE — une absence s'affiche comme une absence, jamais comme
 * zéro (même raisonnement que le catalogue des prestations, D76, D88).
 */
function dureeAffichee(habilitation: LigneHabilitation): string {
  return habilitation.duree_validite_mois === null
    ? t("habilitations.duree_illimitee")
    : `${habilitation.duree_validite_mois}${MOIS}`;
}

const MOIS = " mois";
