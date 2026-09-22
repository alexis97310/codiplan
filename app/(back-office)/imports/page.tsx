import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Page } from "@/components/mise-en-page/page";
import { ActionPrimaire } from "@/components/ui/action-primaire";
import { Cellule, LignePleine, Tableau } from "@/components/ui/tableau";
import { obtenirSession } from "@/lib/auth/session";
import { lireFuseau } from "@/lib/calendar/fuseau";
import { avecContexteApplicatif } from "@/lib/db/client";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { listerLesLots, PLAFOND_LISTE } from "@/lib/imports/depot";
import { CLASSES_LIEN } from "@/lib/theme/apparence";

import { instantLisible, nomDeLAuteur } from "./presentation";
import { cleDuStatut, titreDuType, TYPES_DIMPORT } from "./types";

/**
 * L'ÉCRAN « IMPORTS EXCEL » (L1-11 ; I6, RG-IMP-01 à 05, D31, D54, D90, D100).
 *
 * ## CE QU'IL OUVRE, ET IL N'OUVRE PAS UNE COUCHE
 *
 * `lib/excel/` et `lib/imports/` pèsent 65 Ko de code éprouvé depuis L1-08a, et
 * **aucun humain ne les atteignait** : mesuré le 14/09/2026,
 * `grep -rn "lib/excel\|lib/imports" app/ components/` rendait UNE ligne, et
 * c'était un commentaire. *Un module qui existe prouve qu'une couche a été
 * écrite ; il ne prouve pas qu'un humain l'atteigne* — le critère amendé par
 * R3-12.
 *
 * ## SA PORTE EXISTAIT DÉJÀ, ET ELLE ATTENDAIT LE MAUVAIS TICKET
 *
 * La barre de D95 porte « Imports Excel » depuis l'origine, inerte, et
 * `lib/navigation/entrees.ts` la donnait pour ouverte par **L1-09** — qui porte
 * les GABARITS, ce qu'on télécharge, jamais l'écran d'où l'on téléverse. *Une
 * entrée inerte qui nomme un ticket fantôme est inerte deux fois : elle n'ouvre
 * rien, et elle envoie chercher là où il n'y a rien.* Corrigé le 14/09/2026 ; la
 * barre **reste close à onze entrées**, une entrée inerte devient un chemin.
 *
 * ## CE QUE LA MAQUETTE GOUVERNE, ET LES TROIS POINTS OÙ ELLE A CESSÉ D'AVOIR RAISON
 *
 * D95 lui donne autorité sur la disposition et les couleurs. Elle montre : le
 * titre et son sous-titre, la note de I6, une carte « Nouvel import », une carte
 * « Imports disponibles », et le « Journal des chargements ». **Tout cela est
 * suivi.** Trois de ses phrases ont été réécrites par des décisions de rang 1,
 * et chacune est nommée avec son point précis :
 *
 *   1. *« Tout chargement reste annulable intégralement pendant 24 heures »* —
 *      **D54 a SUPPRIMÉ la fenêtre**, et « intégralement » est faux depuis D15 :
 *      l'annulation est PARTIELLE, avec refus motivé. *Une approximation
 *      conservée à côté de sa mesure n'ajoute pas de sécurité : elle en retire.*
 *   2. *« Inchangés — 271 »* — **notre rapport ne compte pas cette catégorie.**
 *      Il compte créations, modifications, rejets, gabarits et lignes vides, et
 *      les décomptes sont DÉRIVÉS des lignes retenues (L1-08d). *Afficher un
 *      chiffre qu'aucune mesure ne produit, au milieu de chiffres mesurés, est
 *      la faute du 06/09.*
 *   3. *La colonne « Lot », `IMP-20260818-03`* — **`import_lot` ne porte aucun
 *      numéro**, et c'est une décision de L1-08e : *un lot d'import ne s'affiche
 *      pas sous un numéro de société* (I10). La colonne est donc le FICHIER, qui
 *      est ce que l'utilisateur reconnaît.
 *
 * **Une chose qu'elle montre et que nous ne savons toujours pas faire** : le
 * bouton « Télécharger le modèle Excel ». Il exigeait une bibliothèque
 * d'ÉCRITURE `.xlsx` — `read-excel-file` lit et n'écrit pas (D90), le §2
 * interdit le CSV — et cette dépendance est ADOPTÉE depuis le 16/09/2026 :
 * `write-excel-file`, entrée par le fichier des rejets (RG-IMP-03, voir
 * `app/(back-office)/imports/[id]/page.tsx`). *Ce qui manque encore n'est
 * donc plus la dépendance, c'est d'écrire les sept modèles eux-mêmes (L1-09)*
 * — et ce bouton reste INERTE avec son motif, jamais retiré, en attendant :
 * c'est la règle que D95 pose pour la barre — *une entrée dont l'écran
 * n'existe pas est inerte, jamais absente et jamais un lien ; un 404 se lit
 * comme une panne, une absence ment sur ce que le produit sera.*
 *
 * « Télécharger les rejets », lui, est ACTIF depuis le même jour — voir le
 * rapport d'un lot, où il s'affiche.
 *
 * ## LE CLOISONNEMENT N'EST PAS ÉCRIT ICI
 *
 * `import_lot` et `import_lot_ligne` sont de forme « interne » (D100) : société
 * **et** `app.client_id` absent. *Aucun compte de portail ne lit ni n'écrit ici,
 * quel que soit son client, et c'est la base qui le prononce.* Une comparaison
 * écrite dans cet écran serait une seconde lecture d'un critère que la base
 * porte déjà — celle qui vieillit sans rougir.
 */
export default async function PageImports({
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
  // LE TYPE QU'UN MARQUEUR INCONNU ANNONCE (REPRISE-HISTORIQUE). Il vient de
  // l'URL, comme le motif — et comme lui il est BORNÉ avant d'être rendu : la
  // forme est celle que la grammaire du marqueur admet (`[a-z0-9_]+`), rien
  // d'autre ne s'affiche. *Un lien forgé ne fait pas écrire n'importe quoi à
  // la page.* Il n'accompagne qu'un seul motif : les autres n'annoncent rien.
  const valeur = params.valeur;
  const typeAnnonce =
    motif === "import.anomalie.marqueur_type_inconnu" &&
    typeof valeur === "string" &&
    /^[a-z0-9_]{1,40}$/.test(valeur)
      ? valeur
      : null;

  const lots = await listerLesLots(session.contexte);
  // Le fuseau de la SOCIÉTÉ, jamais celui du serveur : `controle_le` est un
  // instant, et le rapporter à l'heure de la machine qui rend la page
  // décalerait la date d'un cran sous UTC+11 (L0-08).
  const fuseau = await avecContexteApplicatif(session.contexte, async (tx) => {
    const societe = await tx.societe.findFirst({
      where: { id: session.contexte.societeId as string },
      select: { fuseau_horaire: true },
    });
    return lireFuseau(societe?.fuseau_horaire);
  });

  const colonnes = [
    { cle: "fichier", libelle: t("imports.colonne_fichier") },
    { cle: "type", libelle: t("imports.colonne_type"), largeur: "130px" },
    { cle: "date", libelle: t("imports.colonne_date"), largeur: "160px" },
    { cle: "auteur", libelle: t("imports.colonne_auteur"), largeur: "170px" },
    {
      cle: "creations",
      libelle: t("imports.creations"),
      largeur: "100px",
      droite: true,
    },
    {
      cle: "modifications",
      libelle: t("imports.modifications"),
      largeur: "100px",
      droite: true,
    },
    {
      cle: "rejets",
      libelle: t("imports.rejets"),
      largeur: "90px",
      droite: true,
    },
    { cle: "statut", libelle: t("imports.colonne_statut"), largeur: "120px" },
  ];

  return (
    <Page
      chemin="/imports"
      titre={t("imports.titre")}
      sousTitre={t("imports.sous_titre")}
    >
      {typeof motif === "string" && estCleTraduction(motif) ? (
        <p
          role="status"
          data-motif={motif}
          className="border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre rounded-md border px-3.5 py-2.5 text-[12.5px]"
        >
          {t(motif)}
          {typeAnnonce === null ? null : (
            <>
              {t("ponctuation.separateur")}
              <code data-type-annonce={typeAnnonce}>{typeAnnonce}</code>
            </>
          )}
        </p>
      ) : null}

      {/* LA RÈGLE DE I6, DITE AVANT LE FORMULAIRE. La maquette la met là, et
          elle a raison : c'est ce qu'il faut avoir lu avant de déposer un
          fichier, pas après. */}
      <section className="border-app-bleu-bord bg-app-bleu-fond rounded-lg border px-4 py-3.5 text-[12.5px]">
        <b>{t("imports.regle")}</b> {t("imports.regle_detail")}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="bg-app-surface border-app-bord rounded-lg border px-4 py-3.5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[14px] font-bold">
              {t("imports.nouveau_titre_generique")}
            </h2>
            {/* INERTE, ET IL DIT POURQUOI — jamais un lien vers rien. */}
            <span
              className="text-app-encre-faible text-[11.5px]"
              title={t("imports.modele_indisponible_motif")}
            >
              {t("imports.modele_indisponible")}
            </span>
          </div>
          <p className="text-app-encre-faible mt-1 text-[11.5px]">
            {t("imports.modele_indisponible_motif")}
          </p>
          <form
            method="post"
            action="/api/imports/controler"
            encType="multipart/form-data"
            className="mt-3 flex flex-col gap-3"
          >
            <label className="flex flex-col gap-1 text-[12px] font-semibold">
              {t("imports.fichier")}
              <input
                type="file"
                name="classeur"
                accept=".xlsx"
                required
                className="border-app-bord rounded-md border px-3 py-2 text-[13px] font-normal"
              />
            </label>
            <p className="text-app-encre-faible text-[11.5px]">
              {t("imports.fichier_aide")}
            </p>
            <ActionPrimaire>{t("imports.controler")}</ActionPrimaire>
          </form>
        </section>

        <section className="bg-app-surface border-app-bord rounded-lg border px-4 py-3.5">
          <h2 className="text-[14px] font-bold">
            {t("imports.disponibles_titre")}
          </h2>
          <p className="text-app-encre-faible mt-1 text-[11.5px]">
            {t("imports.disponibles_aide")}
          </p>
          <ul className="mt-3 flex flex-col gap-2.5">
            {TYPES_DIMPORT.map((type) => (
              <li
                key={type.cle}
                data-type={type.cle}
                data-complet={type.complet ? "1" : "0"}
                className="border-app-bord flex flex-wrap items-baseline justify-between gap-2 border-b pb-2.5 last:border-b-0 last:pb-0"
              >
                <span className="flex flex-col">
                  <b className="text-[13px]">{titreDuType(type)}</b>
                  <span className="text-app-encre-faible text-[11.5px]">
                    {t(type.detail)}
                  </span>
                </span>
                <span
                  className="text-[11.5px] font-semibold"
                  title={
                    type.complet
                      ? undefined
                      : t("imports.type.controle_seul_motif")
                  }
                >
                  {type.complet
                    ? t("imports.type.complet")
                    : t("imports.type.controle_seul")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="bg-app-surface border-app-bord rounded-lg border">
        <div className="border-app-bord flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-3">
          <h2 className="text-[14px] font-bold">
            {t("imports.journal_titre")}
          </h2>
          <span className="text-app-encre-faible text-[11.5px]">
            {t("imports.journal_aide")}
          </span>
        </div>
        <Tableau colonnes={colonnes} minimum="900px">
          {lots.length === 0 ? (
            <LignePleine colonnes={colonnes.length}>
              {t("imports.journal_vide")}
            </LignePleine>
          ) : (
            lots.slice(0, PLAFOND_LISTE).map((lot) => {
              const cleStatut = cleDuStatut(lot.statut);
              return (
                <tr key={lot.id} data-lot={lot.id}>
                  <Cellule>
                    <Link href={`/imports/${lot.id}`} className={CLASSES_LIEN}>
                      {lot.nomFichier}
                    </Link>
                  </Cellule>
                  <Cellule mono>{lot.typeImport}</Cellule>
                  <Cellule>{instantLisible(lot.controleLe, fuseau)}</Cellule>
                  <Cellule>{nomDeLAuteur(lot.auteur)}</Cellule>
                  <Cellule droite>{lot.decomptes.creations}</Cellule>
                  <Cellule droite>{lot.decomptes.modifications}</Cellule>
                  <Cellule droite>{lot.decomptes.rejets}</Cellule>
                  {/* Un statut que le dictionnaire ne connaît pas s'affiche en
                      CODE, jamais traduit à la volée : ce serait du texte
                      technique rendu à un humain (L0-11). */}
                  <Cellule mono={cleStatut === null}>
                    {cleStatut === null ? lot.statut : t(cleStatut)}
                  </Cellule>
                </tr>
              );
            })
          )}
        </Tableau>
      </section>
    </Page>
  );
}
