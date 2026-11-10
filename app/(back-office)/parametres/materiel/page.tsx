import type { Metadata } from "next";

import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Badge, type TonBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarreDeFiltres } from "@/components/ui/barre-de-filtres";
import { Carte } from "@/components/ui/carte";
import { CaseACocher } from "@/components/ui/case-a-cocher";
import { Champ } from "@/components/ui/champ";
import { EtatVide } from "@/components/ui/etat-vide";
import { ActionPrimaire, LienPrimaire } from "@/components/ui/action-primaire";
import { ListeCartes } from "@/components/ui/liste-cartes";
import { ListeQuiFiltre } from "@/components/ui/liste-qui-filtre";
import { Onglets } from "@/components/ui/onglets";
import { Cellule, Tableau } from "@/components/ui/tableau";
import { Volet } from "@/components/ui/volet";
import { Page } from "@/components/mise-en-page/page";
import { RefusAcces } from "@/components/ui/refus-acces";
import { LigneReperee } from "@/components/materiel/ligne-reperee";
import { peutPleinement } from "@/lib/auth/habilitations";
import { Role } from "@/lib/auth/roles";
import { obtenirSession } from "@/lib/auth/session";
import { normaliserRaisonSociale } from "@/lib/excel/rapprochement";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import {
  listerLesFamilles,
  listerLesModeles,
  listerLesSousTypes,
  type LigneFamille,
  type LigneModele,
  type LigneSousType,
} from "@/lib/materiel/depot";
import { paramsDeLaSuite } from "@/lib/materiel/suite";
import type {
  EtatFiltre,
  Filtres,
  OngletMateriel,
  Suite,
  TypeVolet,
} from "@/lib/materiel/suite";
import { CLASSES_LIEN } from "@/lib/theme/apparence";

import { decompte } from "../../presentation";

export const metadata: Metadata = { title: t("materiel.titre") };

/**
 * LE RÉFÉRENTIEL MATÉRIEL (L1-05b, AT-04 ; L1-05, D4 amendé, D6).
 *
 * ## 9I95-REFONTE-PARAMETRES-MATERIEL — DEUX ONGLETS, UN VOLET, UNE RECHERCHE
 *
 * Trois gênes nommées par Alexis le 02/11/2026 (« Trop long, tout mélangé » ;
 * « Créer et modifier, pas clair » ; « Lecture des tableaux ») refaisaient
 * cet écran : familles et modèles vivaient sur la MÊME page, chaque ligne
 * portait un formulaire de modification replié (`<details>`), et aucune
 * recherche ni aucun filtre d'activité n'existaient. Familles et modèles
 * sont désormais deux onglets (`?onglet=`), « Ajouter » et « Modifier »
 * ouvrent le MÊME formulaire dans un volet latéral (`?volet=`, `?id=`,
 * jamais de formulaire déplié dans la liste), et chaque onglet porte sa
 * propre recherche (`?q=`) et son filtre d'activité (`?etat=`).
 *
 * **CONTRAT EXTERNE PRÉSERVÉ** : `/vgp/a-determiner` (route `vgp.indetermines.
 * decider`) lie toujours vers `/parametres/materiel?famille=<id>#modeles` —
 * un lien HORS de cet écran, hors du territoire de ce lot. `famille` seul,
 * SANS `onglet`, bascule donc implicitement sur l'onglet Modèles, filtré ; le
 * fragment `#modeles` devient inerte (plus aucune ancre de défilement, les
 * onglets ne scrollent pas), mais inoffensif.
 *
 * Le reste de ce commentaire — pourquoi cet écran existe, pourquoi aucune
 * énumération n'est inventée, le régime VGP, l'absence de suppression — n'a
 * pas changé et vit toujours ici, inchangé par ce lot :
 *
 * Ni les familles, ni les marques, ni les références ne sont des listes
 * closes : D4 rangeait ces tables parmi les référentiels de plateforme, et
 * l'amendement du 08/09/2026 a retiré le catalogue d'éditeur qui les
 * peuplait. Chaque famille porte son régime VGP, visible depuis AT-04. Quatre
 * clés étrangères retiennent une famille et deux un modèle, toutes en
 * `Restrict` : aucune suppression, seulement une bascule d'activité. Zéro
 * famille n'est pas une page vide muette : l'onglet Modèles dit pourquoi on
 * ne peut pas encore en créer.
 *
 * ## 9K17A-MATERIEL-SOUS-TYPE — UN TROISIÈME ONGLET (D238)
 *
 * « Sous-types », même patron que « Modèles » : une liste filtrable par
 * famille, un volet de création/modification, aucune suppression. Sur la
 * fiche d'un modèle, le choix « Sous-type » est LIMITÉ aux sous-types ACTIFS
 * de la famille DÉFAUT du formulaire (celle de `valeurs.famille_id` en
 * modification, la première famille en création) — **LIMITE CONNUE** :
 * changer la famille dans le `<select>` sans recharger ne met pas à jour
 * cette liste, ce formulaire n'ayant aucune interactivité côté client. La
 * base refuse par la clé un choix devenu incohérent (`sous_type_hors_famille`).
 *
 * ## 9K18A-MATERIEL-RETOUR-ONGLET — LE FORMULAIRE PORTE D'OÙ IL VIENT (10/11/2026)
 *
 * Signalé par Alexis : ajouter un sous-type depuis l'onglet « Modèles »
 * renvoyait systématiquement sur l'onglet « Familles », les filtres perdus
 * — la LIMITE CONNUE ci-dessus, maintenant close. Chaque formulaire du volet
 * et le bouton d'activité portent l'onglet, les filtres et la famille
 * filtrée en champs cachés (`suite_*`, `lib/materiel/suite.ts`) ;
 * `versLeReferentiel` (`app/api/parametres/materiel/saisie-recue.ts`) les
 * reporte à l'identique, au succès comme au refus. Le volet REROUVRE au
 * refus (même type, même `id` s'il y en a un) plutôt que de se fermer ; ce
 * qu'il ne fait pas, c'est reproposer les valeurs tapées — rouvrir affiche
 * les valeurs DE LA BASE (celles d'avant la tentative), jamais celles du
 * formulaire refusé, qu'aucun champ cached ne reporte. Un lot qui voudrait
 * les reporter devrait ajouter un champ caché par champ de saisie, pour les
 * trois formulaires (famille, modèle, sous-type) séparément.
 *
 * `OngletMateriel`, `EtatFiltre`, `Filtres` et `TypeVolet` vivent désormais
 * dans `lib/materiel/suite.ts`, PARTAGÉS avec les routes d'API : une
 * définition locale ici aurait divergé de la leur en silence (§9, 01/09).
 */
export default async function PageMateriel({
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

  // FERMÉ AU TECHNICIEN (QT-2, D152) — « Autres pages /parametres/* ».
  if (session.contexte.role === Role.technicien) {
    return (
      <Page chemin="/parametres/materiel" titre={t("materiel.titre")}>
        <RefusAcces />
      </Page>
    );
  }

  // D153 (03/10/2026, TP-S3, PA-02) — le ○ de la direction sur
  // `parametrer_societe` lit, il n'écrit plus (la route appelle désormais
  // `exigerCapaciteComplete`) : chaque formulaire d'écriture disparaît pour
  // qui n'a pas le ●, plutôt que de rester offert pour rien.
  const peutEcrire =
    session.contexte.role !== null &&
    peutPleinement(session.contexte.role, "parametrer_societe");

  const params = await searchParams;
  const motif = params.motif;
  const texteQ = typeof params.q === "string" ? params.q : "";
  const etat: EtatFiltre =
    params.etat === "tous" || params.etat === "inactifs"
      ? params.etat
      : "actifs";
  const filtres: Filtres = { q: texteQ, etat };
  const familleParam =
    typeof params.famille === "string" ? params.famille : undefined;
  // LA LIGNE REPÉRÉE au retour d'une création ou d'une modification
  // (9K18A-MATERIEL-RETOUR-ONGLET, point 3) — un identifiant inconnu ne
  // repère rien, même discipline que `familleParam` ci-dessus.
  const ligneCiblee =
    typeof params.ligne === "string" ? params.ligne : undefined;

  // `famille` SEUL, SANS `onglet` EXPLICITE, BASCULE SUR MODÈLES — le lien
  // externe `vgp.indetermines.decider` ne connaît que ce paramètre (voir
  // l'en-tête de ce fichier).
  const ongletActif: OngletMateriel =
    params.onglet === "modeles"
      ? "modeles"
      : params.onglet === "sous-types"
        ? "sous-types"
        : params.onglet === "familles"
          ? "familles"
          : familleParam !== undefined
            ? "modeles"
            : "familles";

  const familles = await listerLesFamilles(session.contexte);
  const modeles = await listerLesModeles(session.contexte);
  const sousTypes = await listerLesSousTypes(session.contexte);
  const nomDeFamille = new Map(familles.map((f) => [f.id, f.libelle]));
  const nomDeSousType = new Map(sousTypes.map((s) => [s.id, s.libelle]));

  // Un identifiant inconnu ou hors périmètre reste invisible : `familles` est
  // déjà filtrée par la session, donc l'absence ici couvre les deux cas d'un
  // seul geste (jamais d'erreur, jamais l'identifiant affiché).
  const familleActive =
    familleParam === undefined
      ? undefined
      : familles.find((f) => f.id === familleParam);

  const famillesAffichees = familles.filter(
    (f) =>
      etatCorrespond(f.actif, etat) && correspond([f.code, f.libelle], texteQ),
  );

  const modelesDeLaFamille =
    familleActive === undefined
      ? modeles
      : modeles.filter((m) => m.famille_id === familleActive.id);
  const modelesAffiches = modelesDeLaFamille.filter(
    (m) =>
      etatCorrespond(m.actif, etat) &&
      correspond(
        [m.marque, m.reference, nomDeFamille.get(m.famille_id)],
        texteQ,
      ),
  );

  const sousTypesDeLaFamille =
    familleActive === undefined
      ? sousTypes
      : sousTypes.filter((s) => s.famille_id === familleActive.id);
  const sousTypesAffiches = sousTypesDeLaFamille.filter(
    (s) =>
      etatCorrespond(s.actif, etat) &&
      correspond([s.code, s.libelle, nomDeFamille.get(s.famille_id)], texteQ),
  );

  const titreModeles =
    familleActive === undefined
      ? t("materiel.modeles")
      : titreFamilleFiltree(familleActive.libelle);
  const titreSousTypes =
    familleActive === undefined
      ? t("materiel.sous_types")
      : titreFamilleFiltree(familleActive.libelle);

  // ── LE VOLET (création OU modification, un seul formulaire par entité) ──
  const voletType: TypeVolet | null =
    params.volet === "famille"
      ? "famille"
      : params.volet === "modele"
        ? "modele"
        : params.volet === "sous-type"
          ? "sous-type"
          : null;
  const idEdite = typeof params.id === "string" ? params.id : undefined;
  const familleEditee =
    voletType === "famille" && idEdite !== undefined
      ? familles.find((f) => f.id === idEdite)
      : undefined;
  const modeleEdite =
    voletType === "modele" && idEdite !== undefined
      ? modeles.find((m) => m.id === idEdite)
      : undefined;
  const sousTypeEdite =
    voletType === "sous-type" && idEdite !== undefined
      ? sousTypes.find((s) => s.id === idEdite)
      : undefined;
  // UN IDENTIFIANT INCONNU NE ROUVRE RIEN (même discipline que `famille`
  // ci-dessus) ; CRÉER UN MODÈLE OU UN SOUS-TYPE SANS AUCUNE FAMILLE EST
  // IMPOSSIBLE (le formulaire exige un parent) : le volet reste fermé plutôt
  // que d'ouvrir un `<select>` vide.
  const voletOuvert =
    peutEcrire &&
    voletType !== null &&
    (idEdite === undefined
      ? voletType === "famille" || familles.length > 0
      : voletType === "famille"
        ? familleEditee !== undefined
        : voletType === "modele"
          ? modeleEdite !== undefined
          : sousTypeEdite !== undefined);

  return (
    <Page
      chemin="/parametres/materiel"
      titre={t("materiel.titre")}
      filAriane={[
        { libelle: t("nav.societes_tarifs"), href: "/parametres" },
        { libelle: t("materiel.titre") },
      ]}
      sousTitre={t("materiel.sous_titre")}
    >
      <LigneReperee id={ligneCiblee} />
      {typeof motif === "string" && estCleTraduction(motif) ? (
        <p
          role="status"
          className="border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre rounded-md border px-3.5 py-2.5 text-13 font-bold"
        >
          {t(motif)}
        </p>
      ) : null}

      <Onglets
        libelleAria={t("materiel.titre")}
        dataNav="materiel"
        elements={[
          {
            libelle: t("materiel.familles"),
            href: hrefEcran("familles", filtres),
            compte: famillesAffichees.length,
            actif: ongletActif === "familles",
          },
          {
            libelle: t("materiel.modeles"),
            href: hrefEcran("modeles", filtres),
            compte: modelesAffiches.length,
            actif: ongletActif === "modeles",
          },
          {
            libelle: t("materiel.sous_types"),
            href: hrefEcran("sous-types", filtres),
            compte: sousTypesAffiches.length,
            actif: ongletActif === "sous-types",
          },
        ]}
      />

      {ongletActif === "familles" ? (
        <OngletFamilles
          familles={famillesAffichees}
          nombreTotal={familles.length}
          peutEcrire={peutEcrire}
          filtres={filtres}
        />
      ) : ongletActif === "modeles" ? (
        <OngletModeles
          titre={titreModeles}
          modeles={modelesAffiches}
          nombreTotal={modelesDeLaFamille.length}
          familles={familles}
          familleActive={familleActive}
          nomDeFamille={nomDeFamille}
          nomDeSousType={nomDeSousType}
          peutEcrire={peutEcrire}
          filtres={filtres}
        />
      ) : (
        <OngletSousTypes
          titre={titreSousTypes}
          sousTypes={sousTypesAffiches}
          nombreTotal={sousTypesDeLaFamille.length}
          familles={familles}
          familleActive={familleActive}
          nomDeFamille={nomDeFamille}
          peutEcrire={peutEcrire}
          filtres={filtres}
        />
      )}

      <p className="text-app-encre-faible text-12 font-bold">
        {t("materiel.aucune_suppression")}
      </p>

      {voletOuvert ? (
        <VoletMateriel
          type={voletType as TypeVolet}
          famille={familleEditee}
          modele={modeleEdite}
          sousType={sousTypeEdite}
          familles={familles}
          sousTypes={sousTypes}
          ongletActif={ongletActif}
          filtres={filtres}
          familleFiltre={familleActive?.id}
        />
      ) : null}
    </Page>
  );
}

/** Une recherche vide ne filtre rien ; sinon, accents et casse sont ignorés. */
function correspond(
  champs: readonly (string | null | undefined)[],
  recherche: string,
): boolean {
  if (recherche.trim() === "") {
    return true;
  }
  const cible = normaliserRaisonSociale(recherche);
  return champs.some(
    (champ) =>
      champ !== null &&
      champ !== undefined &&
      normaliserRaisonSociale(champ).includes(cible),
  );
}

function etatCorrespond(actif: boolean, etat: EtatFiltre): boolean {
  if (etat === "tous") {
    return true;
  }
  return etat === "actifs" ? actif : !actif;
}

/**
 * L'ADRESSE D'UN ONGLET, avec ses filtres — `paramsDeLaSuite`
 * (`lib/materiel/suite.ts`) PARTAGÉE avec `versLeReferentiel` : une seconde
 * composition ici aurait divergé de la sienne en silence (§9, 01/09).
 */
function hrefEcran(
  onglet: OngletMateriel,
  filtres: Filtres,
  familleFiltre?: string,
): string {
  const params = paramsDeLaSuite({ onglet, filtres, familleFiltre });
  const requete = params.toString();
  return requete === ""
    ? "/parametres/materiel"
    : `/parametres/materiel?${requete}`;
}

/** Depuis une famille : ses modèles, et rien d'autre (jamais la recherche en cours). */
function hrefVoirModeles(familleId: string): string {
  return hrefEcran("modeles", { q: "", etat: "actifs" }, familleId);
}

/** Retire le filtre « famille » — garde la recherche et l'état en cours. */
function hrefToutAfficher(filtres: Filtres): string {
  return hrefEcran("modeles", filtres);
}

function hrefOuvrirVolet(
  onglet: OngletMateriel,
  filtres: Filtres,
  familleFiltre: string | undefined,
  type: TypeVolet,
  id?: string,
): string {
  const base = hrefEcran(onglet, filtres, familleFiltre);
  const separateur = base.includes("?") ? "&" : "?";
  const idSuffixe = id === undefined ? "" : `&id=${encodeURIComponent(id)}`;
  return `${base}${separateur}volet=${type}${idSuffixe}`;
}

function hrefFermerVolet(
  onglet: OngletMateriel,
  filtres: Filtres,
  familleFiltre: string | undefined,
): string {
  return hrefEcran(onglet, filtres, familleFiltre);
}

const TIRET = " — ";
const ESPACE = " ";
const DEUX_POINTS = " : ";
const JOURS = " j";
const COMPTEUR = " h";
const SEPARATEUR = " / ";
const NOUVEAU = "nouveau";

/**
 * La composition est faite HORS du JSX — un littéral n'y est pas admis, fût-il
 * le tiret d'un titre (L0-11).
 */
function titreDe(prefixe: string, suffixe: string): string {
  return `${prefixe}${TIRET}${suffixe}`;
}

function designation(modele: LigneModele): string {
  return `${modele.marque}${ESPACE}${modele.reference}`;
}

/** Le titre de la carte des modèles quand elle est filtrée sur une famille. */
function titreFamilleFiltree(libelleFamille: string): string {
  return `${t("materiel.famille")}${DEUX_POINTS}${libelleFamille}`;
}

/** L'ONGLET « FAMILLES » — son titre, son décompte, son bouton, son tableau. */
function OngletFamilles({
  familles,
  nombreTotal,
  peutEcrire,
  filtres,
}: {
  readonly familles: readonly LigneFamille[];
  readonly nombreTotal: number;
  readonly peutEcrire: boolean;
  readonly filtres: Filtres;
}) {
  const suite: Suite = { onglet: "familles", filtres };
  return (
    <section className="flex flex-col gap-3">
      <EnTeteOnglet
        titre={decompteFamilles(familles.length)}
        action={
          peutEcrire ? (
            <LienPrimaire
              href={hrefOuvrirVolet("familles", filtres, undefined, "famille")}
            >
              {t("materiel.creer_famille")}
            </LienPrimaire>
          ) : undefined
        }
      />
      <FormulaireRecherche
        onglet="familles"
        filtres={filtres}
        libelleChamp={t("materiel.recherche_familles")}
        familleFiltre={undefined}
      />

      {nombreTotal === 0 ? (
        <p className="text-app-encre-faible text-13 font-bold">
          {t("materiel.aucune_famille")}
        </p>
      ) : familles.length === 0 ? (
        <EtatVide titre={t("materiel.recherche_aucun_resultat_titre")}>
          {t("materiel.recherche_aucun_resultat_detail")}
        </EtatVide>
      ) : (
        <>
          <Carte className="max-[900px]:hidden">
            <Tableau colonnes={colonnesFamilles()} minimum="960px">
              {familles.map((famille) => (
                <tr key={famille.id} data-ligne={famille.id}>
                  <Cellule fort>{famille.code}</Cellule>
                  <Cellule>{famille.libelle}</Cellule>
                  <Cellule>
                    <RegimeVgp famille={famille} />
                  </Cellule>
                  <Cellule droite>
                    <a
                      href={hrefVoirModeles(famille.id)}
                      className={CLASSES_LIEN}
                    >
                      {decompteModeles(famille._count.modeles)}
                    </a>
                  </Cellule>
                  <Cellule>
                    <ActionsLigne
                      peutEcrire={peutEcrire}
                      hrefModifier={hrefOuvrirVolet(
                        "familles",
                        filtres,
                        undefined,
                        "famille",
                        famille.id,
                      )}
                      action={`/api/parametres/materiel/familles/${famille.id}/activite`}
                      actif={famille.actif}
                      suite={suite}
                    />
                  </Cellule>
                </tr>
              ))}
            </Tableau>
          </Carte>

          <ListeCartes libelle={t("materiel.familles")}>
            {familles.map((famille) => (
              <CarteFamille
                key={famille.id}
                famille={famille}
                peutEcrire={peutEcrire}
                hrefModifier={hrefOuvrirVolet(
                  "familles",
                  filtres,
                  undefined,
                  "famille",
                  famille.id,
                )}
                suite={suite}
              />
            ))}
          </ListeCartes>
        </>
      )}
    </section>
  );
}

/** L'ONGLET « MODÈLES » — filtré par famille si `familleActive` est donnée. */
function OngletModeles({
  titre,
  modeles,
  nombreTotal,
  familles,
  familleActive,
  nomDeFamille,
  nomDeSousType,
  peutEcrire,
  filtres,
}: {
  readonly titre: string;
  readonly modeles: readonly LigneModele[];
  readonly nombreTotal: number;
  readonly familles: readonly LigneFamille[];
  readonly familleActive: LigneFamille | undefined;
  readonly nomDeFamille: ReadonlyMap<string, string>;
  readonly nomDeSousType: ReadonlyMap<string, string>;
  readonly peutEcrire: boolean;
  readonly filtres: Filtres;
}) {
  const suite: Suite = {
    onglet: "modeles",
    filtres,
    familleFiltre: familleActive?.id,
  };
  return (
    // `id="modeles"` SUR LA SECTION ENTIÈRE, jamais seulement sur le tableau
    // (9G2B-FINITIONS-CARTES-375) — le titre filtré et « Tout afficher »
    // doivent eux aussi se trouver SOUS cette ancre, et elle doit rester
    // visible quelle que soit la largeur.
    <section id="modeles" className="flex flex-col gap-3">
      <EnTeteOnglet
        titre={titre}
        action={
          familleActive === undefined ? undefined : (
            <a href={hrefToutAfficher(filtres)} className={CLASSES_LIEN}>
              {t("materiel.tout_afficher")}
            </a>
          )
        }
      />
      {peutEcrire ? (
        familles.length === 0 ? (
          <p className="text-app-encre-faible text-13 font-bold">
            {t("materiel.modele_sans_famille")}
          </p>
        ) : (
          <LienPrimaire
            href={hrefOuvrirVolet(
              "modeles",
              filtres,
              familleActive?.id,
              "modele",
            )}
          >
            {t("materiel.creer_modele")}
          </LienPrimaire>
        )
      ) : null}
      <FormulaireRecherche
        onglet="modeles"
        filtres={filtres}
        libelleChamp={t("materiel.recherche_modeles")}
        familleFiltre={familleActive?.id}
      />

      {nombreTotal === 0 ? (
        <p className="text-app-encre-faible text-13 font-bold">
          {familles.length === 0
            ? t("materiel.modele_sans_famille")
            : t("materiel.aucun_modele")}
        </p>
      ) : modeles.length === 0 ? (
        <EtatVide titre={t("materiel.recherche_aucun_resultat_titre")}>
          {t("materiel.recherche_aucun_resultat_detail")}
        </EtatVide>
      ) : (
        <div className="flex flex-col gap-3">
          <Carte className="max-[900px]:hidden">
            <Tableau colonnes={colonnesModeles()} minimum="1000px">
              {modeles.map((modele) => (
                <tr key={modele.id} data-ligne={modele.id}>
                  <Cellule fort>{modele.marque}</Cellule>
                  <Cellule>{modele.reference}</Cellule>
                  <Cellule>
                    {nomDeFamille.get(modele.famille_id) ??
                      t("materiel.famille_inconnue")}
                  </Cellule>
                  <Cellule>{sousTypeAffiche(modele, nomDeSousType)}</Cellule>
                  <Cellule>{entretienAffiche(modele)}</Cellule>
                  <Cellule>
                    <ActionsLigne
                      peutEcrire={peutEcrire}
                      hrefModifier={hrefOuvrirVolet(
                        "modeles",
                        filtres,
                        familleActive?.id,
                        "modele",
                        modele.id,
                      )}
                      action={`/api/parametres/materiel/modeles/${modele.id}/activite`}
                      actif={modele.actif}
                      suite={suite}
                    />
                  </Cellule>
                </tr>
              ))}
            </Tableau>
          </Carte>

          <ListeCartes libelle={titre}>
            {modeles.map((modele) => (
              <CarteModele
                key={modele.id}
                modele={modele}
                nomFamille={
                  nomDeFamille.get(modele.famille_id) ??
                  t("materiel.famille_inconnue")
                }
                nomDeSousType={nomDeSousType}
                peutEcrire={peutEcrire}
                hrefModifier={hrefOuvrirVolet(
                  "modeles",
                  filtres,
                  familleActive?.id,
                  "modele",
                  modele.id,
                )}
                suite={suite}
              />
            ))}
          </ListeCartes>
        </div>
      )}
    </section>
  );
}

/**
 * L'ONGLET « SOUS-TYPES » (D238, ticket 9K17A) — même patron que l'onglet
 * « Modèles », sans sélecteur de recherche imbriqué supplémentaire : un
 * sous-type n'a qu'une famille, jamais de sous-type lui-même.
 */
function OngletSousTypes({
  titre,
  sousTypes,
  nombreTotal,
  familles,
  familleActive,
  nomDeFamille,
  peutEcrire,
  filtres,
}: {
  readonly titre: string;
  readonly sousTypes: readonly LigneSousType[];
  readonly nombreTotal: number;
  readonly familles: readonly LigneFamille[];
  readonly familleActive: LigneFamille | undefined;
  readonly nomDeFamille: ReadonlyMap<string, string>;
  readonly peutEcrire: boolean;
  readonly filtres: Filtres;
}) {
  const suite: Suite = {
    onglet: "sous-types",
    filtres,
    familleFiltre: familleActive?.id,
  };
  return (
    <section id="sous-types" className="flex flex-col gap-3">
      <EnTeteOnglet
        titre={titre}
        action={
          familleActive === undefined ? undefined : (
            <a href={hrefToutAfficher(filtres)} className={CLASSES_LIEN}>
              {t("materiel.tout_afficher")}
            </a>
          )
        }
      />
      {peutEcrire ? (
        familles.length === 0 ? (
          <p className="text-app-encre-faible text-13 font-bold">
            {t("materiel.sous_type_sans_famille")}
          </p>
        ) : (
          <LienPrimaire
            href={hrefOuvrirVolet(
              "sous-types",
              filtres,
              familleActive?.id,
              "sous-type",
            )}
          >
            {t("materiel.creer_sous_type")}
          </LienPrimaire>
        )
      ) : null}
      <FormulaireRecherche
        onglet="sous-types"
        filtres={filtres}
        libelleChamp={t("materiel.recherche_sous_types")}
        familleFiltre={familleActive?.id}
      />

      {nombreTotal === 0 ? (
        <p className="text-app-encre-faible text-13 font-bold">
          {familles.length === 0
            ? t("materiel.sous_type_sans_famille")
            : t("materiel.aucun_sous_type")}
        </p>
      ) : sousTypes.length === 0 ? (
        <EtatVide titre={t("materiel.recherche_aucun_resultat_titre")}>
          {t("materiel.recherche_aucun_resultat_detail")}
        </EtatVide>
      ) : (
        <div className="flex flex-col gap-3">
          <Carte className="max-[900px]:hidden">
            <Tableau colonnes={colonnesSousTypes()} minimum="860px">
              {sousTypes.map((sousType) => (
                <tr key={sousType.id} data-ligne={sousType.id}>
                  <Cellule fort>{sousType.code}</Cellule>
                  <Cellule>{sousType.libelle}</Cellule>
                  <Cellule>
                    {nomDeFamille.get(sousType.famille_id) ??
                      t("materiel.famille_inconnue")}
                  </Cellule>
                  <Cellule>
                    <ActionsLigne
                      peutEcrire={peutEcrire}
                      hrefModifier={hrefOuvrirVolet(
                        "sous-types",
                        filtres,
                        familleActive?.id,
                        "sous-type",
                        sousType.id,
                      )}
                      action={`/api/parametres/materiel/sous-types/${sousType.id}/activite`}
                      actif={sousType.actif}
                      suite={suite}
                    />
                  </Cellule>
                </tr>
              ))}
            </Tableau>
          </Carte>

          <ListeCartes libelle={titre}>
            {sousTypes.map((sousType) => (
              <CarteSousType
                key={sousType.id}
                sousType={sousType}
                nomFamille={
                  nomDeFamille.get(sousType.famille_id) ??
                  t("materiel.famille_inconnue")
                }
                peutEcrire={peutEcrire}
                hrefModifier={hrefOuvrirVolet(
                  "sous-types",
                  filtres,
                  familleActive?.id,
                  "sous-type",
                  sousType.id,
                )}
                suite={suite}
              />
            ))}
          </ListeCartes>
        </div>
      )}
    </section>
  );
}

function EnTeteOnglet({
  titre,
  action,
}: {
  readonly titre: string;
  readonly action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-16 font-bold">{titre}</h2>
      {action}
    </div>
  );
}

/** « N familles » / « 1 famille » — composé hors du JSX (L0-11). */
function decompteFamilles(nombre: number): string {
  return decompte(
    nombre,
    t("materiel.familles_compte_un"),
    t("materiel.familles_compte"),
  );
}

/**
 * LA RECHERCHE ET LE FILTRE D'ÉTAT, PAR ONGLET — un champ texte
 * (`BarreDeFiltres`) et un `<select>` qui se soumet seul (`ListeQuiFiltre`),
 * dans le MÊME formulaire GET : l'onglet et la famille filtrée (si on est
 * sur Modèles) voyagent en champs cachés pour ne pas se perdre au clic.
 */
function FormulaireRecherche({
  onglet,
  filtres,
  libelleChamp,
  familleFiltre,
}: {
  readonly onglet: OngletMateriel;
  readonly filtres: Filtres;
  readonly libelleChamp: string;
  readonly familleFiltre: string | undefined;
}) {
  return (
    <BarreDeFiltres
      action="/parametres/materiel"
      parametre="q"
      valeur={filtres.q === "" ? undefined : filtres.q}
      libelleChamp={libelleChamp}
      libelleBouton={t("materiel.rechercher")}
      enfants={
        <>
          {onglet === "modeles" || onglet === "sous-types" ? (
            <>
              <input type="hidden" name="onglet" value={onglet} />
              {familleFiltre === undefined ? null : (
                <input type="hidden" name="famille" value={familleFiltre} />
              )}
            </>
          ) : null}
          <label className="flex flex-col gap-1 text-12 font-bold">
            {t("materiel.activite")}
            <ListeQuiFiltre
              name="etat"
              defaultValue={filtres.etat}
              className="border-app-bord bg-app-surface h-[40px] rounded-[9px] border px-2 text-13 font-bold"
            >
              <option value="actifs">{t("materiel.filtre.actifs")}</option>
              <option value="inactifs">{t("materiel.filtre.inactifs")}</option>
              <option value="tous">{t("materiel.filtre.tous")}</option>
            </ListeQuiFiltre>
          </label>
        </>
      }
    />
  );
}

function colonnesFamilles() {
  return [
    { cle: "code", libelle: t("materiel.code"), largeur: "140px" },
    { cle: "libelle", libelle: t("materiel.libelle") },
    {
      cle: "regime",
      libelle: t("materiel.colonne_regime"),
      largeur: "220px",
    },
    {
      cle: "modeles",
      libelle: t("materiel.colonne_modeles"),
      largeur: "110px",
      droite: true,
    },
    { cle: "actions", libelle: t("materiel.activite"), largeur: "220px" },
  ];
}

function colonnesModeles() {
  return [
    { cle: "marque", libelle: t("materiel.marque"), largeur: "180px" },
    { cle: "reference", libelle: t("materiel.reference") },
    { cle: "famille", libelle: t("materiel.famille") },
    { cle: "sous_type", libelle: t("materiel.sous_type"), largeur: "180px" },
    { cle: "entretien", libelle: t("materiel.periodicite"), largeur: "180px" },
    { cle: "actions", libelle: t("materiel.activite"), largeur: "240px" },
  ];
}

function colonnesSousTypes() {
  return [
    { cle: "code", libelle: t("materiel.code"), largeur: "140px" },
    { cle: "libelle", libelle: t("materiel.libelle") },
    { cle: "famille", libelle: t("materiel.famille") },
    { cle: "actions", libelle: t("materiel.activite"), largeur: "220px" },
  ];
}

/** Le sous-type d'un modèle, ou l'absence — jamais une chaîne vide muette. */
function sousTypeAffiche(
  modele: LigneModele,
  nomDeSousType: ReadonlyMap<string, string>,
): string {
  if (modele.sous_type_id === null) {
    return t("materiel.sous_type_aucun");
  }
  return (
    nomDeSousType.get(modele.sous_type_id) ?? t("materiel.sous_type_inconnu")
  );
}

/**
 * LE TON DE LA PASTILLE DE RÉGIME — un jugement, écrit comme tel : la maquette
 * ne montre aucun régime VGP, elle n'a donc rien à confronter.
 *
 * **« À déterminer » est ORANGE, et c'est le seul choix délibéré** : c'est une
 * question ouverte, et le directeur d'exploitation a demandé qu'elle « se
 * voie » — le même ton que `parc.a_completer` (`app/(back-office)/parc/
 * page.tsx`), une autre question ouverte sur une fiche.
 *
 * « Soumis » est BLEU — une obligation active et connue, le ton déjà employé
 * pour un statut « planifiée » (`lib/theme/statuts.ts`). « Non soumis » et
 * « vérifié non soumis » sont GRIS — deux états où quelqu'un a déjà tranché
 * qu'il n'y a rien à faire, le ton déjà employé pour un statut « annulée ».
 */
const TONS_REGIME_VGP: Record<LigneFamille["assujettissement_vgp"], TonBadge> =
  {
    a_determiner: "orange",
    soumis: "bleu",
    non_soumis: "gris",
    verifie: "gris",
  };

function RegimeVgp({ famille }: { readonly famille: LigneFamille }) {
  const periodicite = periodiciteVgpAffichee(famille);
  return (
    <div className="flex flex-col items-start gap-1">
      <Badge ton={TONS_REGIME_VGP[famille.assujettissement_vgp]}>
        {t(`vgp.regime.${famille.assujettissement_vgp}`)}
      </Badge>
      {periodicite === null ? null : (
        <span className="text-app-encre-faible text-12 font-bold">
          {periodicite}
        </span>
      )}
    </div>
  );
}

/**
 * LA PÉRIODICITÉ RÉGLEMENTAIRE AFFICHÉE, avec le texte qui la fonde.
 *
 * **Ce n'est PAS `entretienAffiche`** : celle-ci lit `vgp_periodicite_mois` et
 * `vgp_reference_texte`, deux colonnes distinctes de l'entretien constructeur
 * (L9-04). Les deux voyagent ensemble en base ; ce qui suit ne fait que le lire.
 */
function periodiciteVgpAffichee(famille: LigneFamille): string | null {
  if (famille.vgp_periodicite_mois === null) {
    return null;
  }
  const base = `${famille.vgp_periodicite_mois} ${t("materiel.vgp_mois")}`;
  return famille.vgp_reference_texte === null
    ? base
    : `${base}${TIRET}${famille.vgp_reference_texte}`;
}

/** Un décompte de modèles, composé hors du JSX (L0-11) — même forme que le parc. */
function decompteModeles(nombre: number): string {
  return decompte(
    nombre,
    t("materiel.modeles_compte_un"),
    t("materiel.modeles_compte"),
  );
}

/**
 * L'ENTRETIEN AFFICHÉ — une absence s'affiche comme une absence.
 *
 * *Jamais « 0 j »* : zéro dirait « dû en permanence », et la base le refuse pour
 * cette raison exacte. « Non périodique » dit ce qui est vrai, et se corrige
 * ailleurs qu'une valeur fausse. **Et ce n'est pas la VGP** — la périodicité
 * réglementaire se lit désormais à la colonne « Régime VGP », juste au-dessus.
 */
function entretienAffiche(modele: LigneModele): string {
  const parts: string[] = [];
  if (modele.periodicite_jours !== null) {
    parts.push(`${modele.periodicite_jours}${JOURS}`);
  }
  if (modele.periodicite_compteur !== null) {
    parts.push(`${modele.periodicite_compteur}${COMPTEUR}`);
  }
  return parts.length === 0
    ? t("materiel.sans_periodicite")
    : parts.join(SEPARATEUR);
}

/**
 * LES ACTIONS D'UNE LIGNE — « Modifier » (ouvre le volet) et la bascule
 * d'activité, dans la MÊME cellule : une colonne de plus aurait recréé le
 * défaut d'alignement que ce lot répare (AT-04, point 4).
 *
 * L'état VISÉ de la bascule voyage dans le corps plutôt que d'être déduit :
 * *une bascule aveugle inverserait un état qu'un autre onglet vient de
 * changer, et personne ne saurait lequel des deux a gagné.*
 */
function ActionsLigne({
  peutEcrire,
  hrefModifier,
  action,
  actif,
  suite,
}: {
  readonly peutEcrire: boolean;
  readonly hrefModifier: string;
  readonly action: string;
  readonly actif: boolean;
  readonly suite: Suite;
}) {
  if (!peutEcrire) {
    return <span>{actif ? t("materiel.active") : t("materiel.inactive")}</span>;
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" asChild>
        <Link href={hrefModifier}>{t("materiel.modifier")}</Link>
      </Button>
      <form action={action} method="post">
        <input type="hidden" name="actif" value={actif ? INACTIF : ACTIF} />
        <ChampsSuite suite={suite} />
        <Button type="submit" variant="outline" size="sm">
          {actif ? t("materiel.desactiver") : t("materiel.activer")}
        </Button>
      </form>
    </div>
  );
}

const ACTIF = "oui";
const INACTIF = "non";

/**
 * LA SUITE D'UN FORMULAIRE, EN CHAMPS CACHÉS (9K18A-MATERIEL-RETOUR-ONGLET).
 *
 * Préfixés `suite_` pour ne jamais heurter un champ de saisie du MÊME
 * formulaire — `FormulaireModele` porte déjà `famille_id`.
 */
function ChampsSuite({ suite }: { readonly suite: Suite }) {
  return (
    <>
      <input type="hidden" name="suite_onglet" value={suite.onglet} />
      <input type="hidden" name="suite_q" value={suite.filtres.q} />
      <input type="hidden" name="suite_etat" value={suite.filtres.etat} />
      {suite.familleFiltre === undefined ? null : (
        <input type="hidden" name="suite_famille" value={suite.familleFiltre} />
      )}
    </>
  );
}

/** La carte d'une famille, sous 900 px — même contenu que sa ligne de tableau. */
function CarteFamille({
  famille,
  peutEcrire,
  hrefModifier,
  suite,
}: {
  readonly famille: LigneFamille;
  readonly peutEcrire: boolean;
  readonly hrefModifier: string;
  readonly suite: Suite;
}) {
  return (
    <li data-ligne={famille.id}>
      <Carte className="flex flex-col gap-2 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-13 font-bold">{famille.libelle}</span>
          <span className="text-app-encre-faible text-12 font-bold">
            {famille.code}
          </span>
        </div>
        <RegimeVgp famille={famille} />
        <a href={hrefVoirModeles(famille.id)} className={CLASSES_LIEN}>
          {decompteModeles(famille._count.modeles)}
        </a>
        <ActionsLigne
          peutEcrire={peutEcrire}
          hrefModifier={hrefModifier}
          action={`/api/parametres/materiel/familles/${famille.id}/activite`}
          actif={famille.actif}
          suite={suite}
        />
      </Carte>
    </li>
  );
}

/** La carte d'un modèle, sous 900 px — même contenu que sa ligne de tableau. */
function CarteModele({
  modele,
  nomFamille,
  nomDeSousType,
  peutEcrire,
  hrefModifier,
  suite,
}: {
  readonly modele: LigneModele;
  readonly nomFamille: string;
  readonly nomDeSousType: ReadonlyMap<string, string>;
  readonly peutEcrire: boolean;
  readonly hrefModifier: string;
  readonly suite: Suite;
}) {
  return (
    <li data-ligne={modele.id}>
      <Carte className="flex flex-col gap-2 p-3">
        <span className="text-13 font-bold">{designation(modele)}</span>
        <div className="text-app-encre-faible text-12 font-bold">
          {t("materiel.famille")}
          {t("ponctuation.deux_points")}
          {nomFamille}
        </div>
        <div className="text-app-encre-faible text-12 font-bold">
          {t("materiel.sous_type")}
          {t("ponctuation.deux_points")}
          {sousTypeAffiche(modele, nomDeSousType)}
        </div>
        <div className="text-12 font-bold">
          {t("materiel.periodicite")}
          {t("ponctuation.deux_points")}
          {entretienAffiche(modele)}
        </div>
        <ActionsLigne
          peutEcrire={peutEcrire}
          hrefModifier={hrefModifier}
          action={`/api/parametres/materiel/modeles/${modele.id}/activite`}
          actif={modele.actif}
          suite={suite}
        />
      </Carte>
    </li>
  );
}

/** La carte d'un sous-type, sous 900 px (D238, ticket 9K17A). */
function CarteSousType({
  sousType,
  nomFamille,
  peutEcrire,
  hrefModifier,
  suite,
}: {
  readonly sousType: LigneSousType;
  readonly nomFamille: string;
  readonly peutEcrire: boolean;
  readonly hrefModifier: string;
  readonly suite: Suite;
}) {
  return (
    <li data-ligne={sousType.id}>
      <Carte className="flex flex-col gap-2 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-13 font-bold">{sousType.libelle}</span>
          <span className="text-app-encre-faible text-12 font-bold">
            {sousType.code}
          </span>
        </div>
        <div className="text-app-encre-faible text-12 font-bold">
          {t("materiel.famille")}
          {t("ponctuation.deux_points")}
          {nomFamille}
        </div>
        <ActionsLigne
          peutEcrire={peutEcrire}
          hrefModifier={hrefModifier}
          action={`/api/parametres/materiel/sous-types/${sousType.id}/activite`}
          actif={sousType.actif}
          suite={suite}
        />
      </Carte>
    </li>
  );
}

/**
 * LE VOLET — « Ajouter » et « Modifier » ouvrent le MÊME formulaire
 * (`FormulaireFamille`/`FormulaireModele`), champs pré-remplis en
 * modification par `valeurs` : jamais un second formulaire qui pourrait
 * diverger (§9, 01/09).
 */
function VoletMateriel({
  type,
  famille,
  modele,
  sousType,
  familles,
  sousTypes,
  ongletActif,
  filtres,
  familleFiltre,
}: {
  readonly type: TypeVolet;
  readonly famille: LigneFamille | undefined;
  readonly modele: LigneModele | undefined;
  readonly sousType: LigneSousType | undefined;
  readonly familles: readonly LigneFamille[];
  readonly sousTypes: readonly LigneSousType[];
  readonly ongletActif: OngletMateriel;
  readonly filtres: Filtres;
  readonly familleFiltre: string | undefined;
}) {
  const hrefFermer = hrefFermerVolet(ongletActif, filtres, familleFiltre);
  const suite: Suite = { onglet: ongletActif, filtres, familleFiltre };
  const titreVolet =
    type === "famille"
      ? famille === undefined
        ? t("materiel.creer_famille")
        : titreDe(t("materiel.modifier_famille"), famille.code)
      : type === "modele"
        ? modele === undefined
          ? t("materiel.creer_modele")
          : titreDe(t("materiel.modifier_modele"), designation(modele))
        : sousType === undefined
          ? t("materiel.creer_sous_type")
          : titreDe(t("materiel.modifier_sous_type"), sousType.code);
  return (
    <Volet
      surtitre={t("materiel.titre")}
      titre={titreVolet}
      hrefFermer={hrefFermer}
    >
      {type === "famille" ? (
        <FormulaireFamille
          action={
            famille === undefined
              ? "/api/parametres/materiel/familles/creer"
              : `/api/parametres/materiel/familles/${famille.id}/modifier`
          }
          soumettre={
            famille === undefined
              ? t("materiel.creer_action")
              : t("materiel.enregistrer")
          }
          valeurs={famille}
          hrefAnnuler={hrefFermer}
          suite={suite}
        />
      ) : type === "modele" ? (
        <FormulaireModele
          action={
            modele === undefined
              ? "/api/parametres/materiel/modeles/creer"
              : `/api/parametres/materiel/modeles/${modele.id}/modifier`
          }
          familles={familles}
          sousTypes={sousTypes}
          soumettre={
            modele === undefined
              ? t("materiel.creer_action")
              : t("materiel.enregistrer")
          }
          valeurs={modele}
          hrefAnnuler={hrefFermer}
          suite={suite}
        />
      ) : (
        <FormulaireSousType
          action={
            sousType === undefined
              ? "/api/parametres/materiel/sous-types/creer"
              : `/api/parametres/materiel/sous-types/${sousType.id}/modifier`
          }
          familles={familles}
          soumettre={
            sousType === undefined
              ? t("materiel.creer_action")
              : t("materiel.enregistrer")
          }
          valeurs={sousType}
          hrefAnnuler={hrefFermer}
          suite={suite}
        />
      )}
      {type === "famille" ? (
        <p className="text-app-encre-faible text-12 font-bold">
          {t("materiel.vgp_ailleurs")}
        </p>
      ) : type === "modele" ? (
        <p className="text-app-encre-faible text-12 font-bold">
          {t("materiel.pas_la_vgp")}
        </p>
      ) : null}
    </Volet>
  );
}

function PiedDuVolet({
  hrefAnnuler,
  soumettre,
}: {
  readonly hrefAnnuler: string;
  readonly soumettre: string;
}) {
  return (
    <div className="flex justify-end gap-2">
      <Link
        href={hrefAnnuler}
        className="border-app-bord rounded-md border px-3 py-1.5 text-13 font-bold"
      >
        {t("materiel.annuler")}
      </Link>
      <ActionPrimaire>{soumettre}</ActionPrimaire>
    </div>
  );
}

function FormulaireFamille({
  action,
  soumettre,
  valeurs,
  hrefAnnuler,
  suite,
}: {
  readonly action: string;
  readonly soumettre: string;
  readonly valeurs?: LigneFamille;
  readonly hrefAnnuler: string;
  readonly suite: Suite;
}) {
  const prefixe = valeurs?.id ?? NOUVEAU;
  return (
    <form action={action} method="post" className="flex flex-col gap-3">
      <ChampsSuite suite={suite} />
      <Champ
        id={`${prefixe}-code`}
        nom="code"
        libelle={t("materiel.code")}
        valeur={valeurs?.code}
      />
      <Champ
        id={`${prefixe}-libelle`}
        nom="libelle"
        libelle={t("materiel.libelle")}
        valeur={valeurs?.libelle}
        large
      />
      <CaseActive defaut={valeurs?.actif ?? true} />
      <PiedDuVolet hrefAnnuler={hrefAnnuler} soumettre={soumettre} />
    </form>
  );
}

function FormulaireModele({
  action,
  familles,
  sousTypes,
  soumettre,
  valeurs,
  hrefAnnuler,
  suite,
}: {
  readonly action: string;
  readonly familles: readonly LigneFamille[];
  readonly sousTypes: readonly LigneSousType[];
  readonly soumettre: string;
  readonly valeurs?: LigneModele;
  readonly hrefAnnuler: string;
  readonly suite: Suite;
}) {
  const prefixe = valeurs?.id ?? NOUVEAU;
  // LA FAMILLE « DÉFAUT » DE CE FORMULAIRE — celle qui pré-sélectionne le
  // `<select>` ci-dessous ET borne le choix du sous-type (voir l'en-tête du
  // fichier, LIMITE CONNUE : changer la famille sans recharger ne met pas à
  // jour la liste de sous-types, ce formulaire n'ayant aucune interactivité
  // côté client).
  const familleParDefaut = valeurs?.famille_id ?? familles[0]?.id;
  const sousTypesChoisissables = sousTypes.filter(
    (s) => s.actif && s.famille_id === familleParDefaut,
  );
  return (
    <form action={action} method="post" className="flex flex-col gap-3">
      <ChampsSuite suite={suite} />
      <div className="flex flex-col gap-1">
        <label
          htmlFor={`${prefixe}-famille`}
          className="text-app-encre-faible text-12 font-bold"
        >
          {t("materiel.famille")}
        </label>
        {/* LA FAMILLE EST OBLIGATOIRE, et la base la tient : la clé étrangère
            est composite `(societe_id, famille_id)`. Il n'y a donc PAS d'option
            vide — à la différence des prestations, dont le parent est
            facultatif. *Une option vide proposerait ce que la base refuse.* */}
        <select
          id={`${prefixe}-famille`}
          name="famille_id"
          defaultValue={familleParDefaut}
          className="border-app-bord bg-app-surface min-w-44 rounded-md border px-2 py-1 text-13 font-bold"
        >
          {familles.map((famille) => (
            <option key={famille.id} value={famille.id}>
              {famille.libelle}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label
          htmlFor={`${prefixe}-sous-type`}
          className="text-app-encre-faible text-12 font-bold"
        >
          {t("materiel.sous_type")}
        </label>
        {/* FACULTATIF (D238) : une option vide existe, à la différence de la
            famille ci-dessus. */}
        <select
          id={`${prefixe}-sous-type`}
          name="sous_type_id"
          defaultValue={valeurs?.sous_type_id ?? ""}
          className="border-app-bord bg-app-surface min-w-44 rounded-md border px-2 py-1 text-13 font-bold"
        >
          <option value="">{t("materiel.sous_type_aucun")}</option>
          {sousTypesChoisissables.map((sousType) => (
            <option key={sousType.id} value={sousType.id}>
              {sousType.libelle}
            </option>
          ))}
        </select>
      </div>
      <Champ
        id={`${prefixe}-marque`}
        nom="marque"
        libelle={t("materiel.marque")}
        valeur={valeurs?.marque}
      />
      <Champ
        id={`${prefixe}-reference`}
        nom="reference"
        libelle={t("materiel.reference")}
        valeur={valeurs?.reference}
        large
      />
      <Champ
        id={`${prefixe}-jours`}
        nom="periodicite_jours"
        libelle={t("materiel.periodicite_jours")}
        valeur={texteOuVide(valeurs?.periodicite_jours)}
        nombre
      />
      <Champ
        id={`${prefixe}-compteur`}
        nom="periodicite_compteur"
        libelle={t("materiel.periodicite_compteur")}
        valeur={texteOuVide(valeurs?.periodicite_compteur)}
        nombre
      />
      <CaseActive defaut={valeurs?.actif ?? true} />
      <PiedDuVolet hrefAnnuler={hrefAnnuler} soumettre={soumettre} />
    </form>
  );
}

/** Le formulaire d'un sous-type (D238, ticket 9K17A) — même patron que `FormulaireFamille`, avec le choix de la famille en plus. */
function FormulaireSousType({
  action,
  familles,
  soumettre,
  valeurs,
  hrefAnnuler,
  suite,
}: {
  readonly action: string;
  readonly familles: readonly LigneFamille[];
  readonly soumettre: string;
  readonly valeurs?: LigneSousType;
  readonly hrefAnnuler: string;
  readonly suite: Suite;
}) {
  const prefixe = valeurs?.id ?? NOUVEAU;
  return (
    <form action={action} method="post" className="flex flex-col gap-3">
      <ChampsSuite suite={suite} />
      <div className="flex flex-col gap-1">
        <label
          htmlFor={`${prefixe}-famille`}
          className="text-app-encre-faible text-12 font-bold"
        >
          {t("materiel.famille")}
        </label>
        {/* LA FAMILLE EST OBLIGATOIRE, même raisonnement que sur un modèle. */}
        <select
          id={`${prefixe}-famille`}
          name="famille_id"
          defaultValue={valeurs?.famille_id ?? familles[0]?.id}
          className="border-app-bord bg-app-surface min-w-44 rounded-md border px-2 py-1 text-13 font-bold"
        >
          {familles.map((famille) => (
            <option key={famille.id} value={famille.id}>
              {famille.libelle}
            </option>
          ))}
        </select>
      </div>
      <Champ
        id={`${prefixe}-code`}
        nom="code"
        libelle={t("materiel.code")}
        valeur={valeurs?.code}
      />
      <Champ
        id={`${prefixe}-libelle`}
        nom="libelle"
        libelle={t("materiel.libelle")}
        valeur={valeurs?.libelle}
        large
      />
      <CaseActive defaut={valeurs?.actif ?? true} />
      <PiedDuVolet hrefAnnuler={hrefAnnuler} soumettre={soumettre} />
    </form>
  );
}

/** Une périodicité absente laisse le champ VIDE — jamais « 0 ». */
function texteOuVide(valeur: number | null | undefined): string | undefined {
  return valeur === null || valeur === undefined ? undefined : String(valeur);
}

function CaseActive({ defaut }: { readonly defaut: boolean }) {
  return (
    <CaseACocher
      name="actif"
      defaultChecked={defaut}
      libelle={t("materiel.active")}
      className="flex items-center gap-1.5 pb-1 text-13 font-bold"
    />
  );
}
