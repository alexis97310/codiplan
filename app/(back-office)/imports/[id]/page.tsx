import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ActionPrimaire } from "@/components/ui/action-primaire";
import { Cellule, LignePleine, Tableau } from "@/components/ui/tableau";
import { obtenirSession } from "@/lib/auth/session";
import { lireFuseau } from "@/lib/calendar/fuseau";
import { avecContexteApplicatif } from "@/lib/db/client";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { lireLeLot } from "@/lib/imports/depot";
import { CLASSES_LIEN } from "@/lib/theme/apparence";

import { coordonneesDuLot, lignesDeResultat } from "../presentation";
import { applicationDuType } from "@/lib/imports/types-dimport";

import { cleDuMotif, cleDuStatut } from "../types";

/**
 * LE RAPPORT D'UN LOT — LA PREMIÈRE MOITIÉ DE I6, PUIS LA SECONDE (L1-11).
 *
 * ## POURQUOI UNE ADRESSE À LUI, ET NON LA CARTE DE GAUCHE DE LA MAQUETTE
 *
 * La maquette montre le résultat du contrôle DANS l'écran d'index, sous la zone
 * de dépôt. **La disposition de la carte est reprise telle quelle** — zone de
 * dépôt nommée, « Résultat du contrôle » en tableau, « Lignes rejetées » en
 * dessous, les actions en bas. *Ce qui change est son ADRESSE*, et pour une
 * raison que la maquette ne pouvait pas connaître : **un lot SURVIT à la
 * session**. Il est écrit en base dès le contrôle (L1-08e, et le chapitre 11 le
 * disait depuis l'origine), il peut être appliqué une heure plus tard, et le
 * journal des chargements doit pouvoir y ramener. *Un rapport qui n'existe que
 * dans la page où on vient de déposer le fichier n'est pas ce que I6 demande —
 * il est ce qu'on regarde avant de valider, et on ne valide pas toujours tout
 * de suite.*
 *
 * ## IL NE RECALCULE RIEN, ET C'EST TOUTE SA VALEUR
 *
 * Les décomptes viennent des colonnes du lot, où `enregistrerLeControle` les a
 * posés ; les lignes viennent de `import_lot_ligne`, avec l'action que
 * `controlerFeuille` a décidée. **Rien n'est recompté ici.** *Recalculer serait
 * la divergence du §9 (01/09) au pire endroit : entre ce qu'un humain valide et
 * ce qui sera écrit* — et l'écart ne se verrait qu'après l'écriture.
 *
 * ## CE QU'IL NE SAIT PAS DIRE, ÉCRIT PLUTÔT QUE TU
 *
 * **Après une annulation, il ne dit pas QUELLES lignes ont été refusées.**
 * `annulerLeLotDeClients` le rend au moment où il annule, et rien ne le
 * conserve : aucune colonne de `import_lot_ligne` ne porte le verdict de
 * l'annulation. Le reconstituer à la lecture demanderait de redemander à la
 * base ce que chaque fiche est devenue, *c'est-à-dire une seconde lecture d'un
 * critère que l'annulation a déjà tranché*. Le message de retour distingue donc
 * « tout défait » de « en partie refusé », et s'arrête là.
 *
 * ## « TÉLÉCHARGER LES REJETS » EST INERTE, ET IL DIT POURQUOI
 *
 * RG-IMP-03 veut les lignes rejetées « dans un fichier annoté, corrigeable et
 * rechargeable ». Un fichier, donc une ÉCRITURE `.xlsx` — et il n'existe aucune
 * bibliothèque d'écriture dans le projet (D90 ; le §2 interdit le CSV). *Un
 * bouton retiré mentirait sur ce que le produit sera ; un bouton actif qui ne
 * produit rien se lit comme une panne.* Il est donc inerte et motivé, comme une
 * entrée de barre que D95 laisse inerte plutôt qu'absente.
 */
export default async function PageLotDImport({
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

  // **Un identifiant qui n'est pas un UUID n'est pas une erreur de serveur.**
  // `findUnique` lèverait sur une chaîne quelconque ; ici la lecture rend
  // simplement « introuvable », qui est ce qu'un lot d'une autre société rend
  // aussi. *Les distinguer ferait un oracle* (D35, D50).
  const lot = estUnIdentifiant(id)
    ? await lireLeLot(session.contexte, id)
    : null;

  if (lot === null) {
    return (
      <main className="flex flex-col gap-4">
        <Link href="/imports" className={CLASSES_LIEN}>
          {t("imports.lot_retour")}
        </Link>
        <p
          role="status"
          className="border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre rounded-md border px-3.5 py-2.5 text-[12.5px]"
        >
          {t("imports.lot_introuvable")}
        </p>
      </main>
    );
  }

  const fuseau = await avecContexteApplicatif(session.contexte, async (tx) => {
    const societe = await tx.societe.findFirst({
      where: { id: session.contexte.societeId as string },
      select: { fuseau_horaire: true },
    });
    return lireFuseau(societe?.fuseau_horaire);
  });

  const rejetees = lot.lignes.filter((ligne) => ligne.action === "rejet");
  const cleStatut = cleDuStatut(lot.statut);
  const colonnes = [
    { cle: "ligne", libelle: t("imports.colonne_ligne"), largeur: "90px" },
    { cle: "cle", libelle: t("imports.colonne_cle"), largeur: "260px" },
    { cle: "motif", libelle: t("imports.colonne_motif") },
  ];

  const resultat = lignesDeResultat(lot.decomptes);
  // **Le type est lu sur le LOT, jamais sur le fichier ni sur l'écran** : c'est
  // `import_lot.type_import`, que le contrôle y a posé. Et la réponse vient de
  // la MÊME table que celle que la route consulte — *deux lectures d'un même
  // critère divergeraient en silence, et l'écran promettrait un bouton que la
  // route refuse* (§9, 01/09).
  const sansApplication = applicationDuType(lot.typeImport) === null;

  return (
    <main className="flex flex-col gap-5">
      <Link href="/imports" className={CLASSES_LIEN}>
        {t("imports.lot_retour")}
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight">
            {t("imports.lot_titre")}
          </h1>
          <p className="text-app-encre-faible text-[13px]">{lot.nomFichier}</p>
          <p className="text-app-encre-faible text-[11.5px]">
            {coordonneesDuLot(lot.controleLe, fuseau, lot.auteur)}
          </p>
        </div>
        <span data-statut={lot.statut} className="text-[13px] font-bold">
          {cleStatut === null ? lot.statut : t(cleStatut)}
        </span>
      </header>

      {typeof motif === "string" && estCleTraduction(motif) ? (
        <p
          role="status"
          data-motif={motif}
          className="border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre rounded-md border px-3.5 py-2.5 text-[12.5px]"
        >
          {t(motif)}
        </p>
      ) : null}

      <section className="bg-app-surface border-app-bord rounded-[10px] border px-4 py-3.5">
        <h2 className="text-[14px] font-bold">{t("imports.resultat_titre")}</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {resultat.map((entree) => (
            <li
              key={entree.cle}
              data-decompte={entree.cle}
              className="flex flex-wrap items-baseline gap-3 text-[13px]"
            >
              <span className="w-[150px] font-semibold">
                {t(entree.libelle)}
              </span>
              <span className="w-[60px] text-right font-extrabold">
                {entree.valeur}
              </span>
              <span className="text-app-encre-faible text-[11.5px]">
                {t(entree.detail)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-app-surface border-app-bord rounded-[10px] border">
        <div className="border-app-bord flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-3">
          <h2 className="text-[14px] font-bold">{t("imports.lignes_titre")}</h2>
          {/* INERTE, ET SON MOTIF EST VISIBLE — jamais seulement une infobulle.
              *Une infobulle ne s'ouvre pas sur un téléphone* : c'est la leçon
              exacte de `CLASSES_LIEN` (14/09/2026), où six liens ne se voyaient
              qu'au SURVOL. Un bouton inerte dont la raison est cachée se lit
              comme une panne, ce que D95 refuse pour une entrée de barre. */}
          <span className="text-app-encre-faible flex flex-col text-[11.5px]">
            <span>{t("imports.rejets_indisponibles")}</span>
            <span>{t("imports.rejets_indisponibles_motif")}</span>
          </span>
        </div>
        <Tableau colonnes={colonnes} minimum="640px">
          {rejetees.length === 0 ? (
            <LignePleine colonnes={colonnes.length}>
              {t("imports.lignes_aucun_rejet")}
            </LignePleine>
          ) : (
            rejetees.map((ligne) => {
              const cleMotif =
                ligne.rejetMotif === null ? null : cleDuMotif(ligne.rejetMotif);
              return (
                <tr key={ligne.rang} data-rang={ligne.rang}>
                  <Cellule droite mono>
                    {ligne.rang}
                  </Cellule>
                  <Cellule mono>
                    {ligne.cle ?? t("imports.cle_absente")}
                  </Cellule>
                  {/* Un motif que le dictionnaire ne connaît pas s'affiche en
                      CODE : le traduire à la volée rendrait du texte technique
                      à un humain (L0-11), et l'effacer perdrait la cause. */}
                  <Cellule mono={cleMotif === null}>
                    {cleMotif === null ? (ligne.rejetMotif ?? "") : t(cleMotif)}
                  </Cellule>
                </tr>
              );
            })
          )}
        </Tableau>
      </section>

      {/* LES DEUX GESTES, ET UN SEUL EST OFFERT À LA FOIS. Le statut du lot dit
          lequel : *un bouton « Appliquer » sur un lot déjà appliqué promettrait
          une action que la base refuse*, et le refus serait lu comme une panne.
          La base garde de toute façon — `appliquerLeLotDeClients` refuse par
          `lot_deja_applique` —, et c'est elle qui décide ; cet écran ne fait que
          ne pas proposer l'impossible. */}
      {/* UN TYPE QU'ON NE SAIT PAS ÉCRIRE N'A PAS DE BOUTON, ET IL DIT
          POURQUOI (R6-01). *Un bouton « Appliquer » qui échoue se lit comme une
          panne du fichier*, et l'auteur du classeur chercherait longtemps ce
          qu'il a mal rempli. C'est la règle des rejets ci-dessus, et celle
          d'une entrée de barre inerte (D95) : **le motif est visible, jamais
          seulement une infobulle.**
          Ce n'est PAS un contrôle : la route refuse de son côté, et c'est elle
          qui garde. *L'écran ne propose pas l'impossible ; il ne l'interdit
          pas.* */}
      {lot.statut === "controle" && !sansApplication ? (
        <form
          method="post"
          action={`/api/imports/${lot.id}/appliquer`}
          className="flex flex-col gap-2"
        >
          <ActionPrimaire>{t("imports.appliquer")}</ActionPrimaire>
          <p className="text-app-encre-faible text-[11.5px]">
            {t("imports.appliquer_aide")}
          </p>
        </form>
      ) : null}
      {lot.statut === "controle" && sansApplication ? (
        <p
          role="status"
          data-sans-application={lot.typeImport}
          className="border-app-bord bg-app-surface text-app-encre-faible rounded-md border px-3.5 py-2.5 text-[12.5px]"
        >
          {t("imports.type_sans_application")}
        </p>
      ) : null}
      {lot.statut === "applique" ? (
        <form
          method="post"
          action={`/api/imports/${lot.id}/annuler`}
          className="flex flex-col gap-2"
        >
          <ActionPrimaire>{t("imports.annuler")}</ActionPrimaire>
          <p className="text-app-encre-faible text-[11.5px]">
            {t("imports.annuler_aide")}
          </p>
        </form>
      ) : null}
    </main>
  );
}

/**
 * La forme d'un identifiant de lot — un UUID, et rien d'autre.
 *
 * **Ce n'est PAS un contrôle d'accès**, et il ne prétend pas en être un : la
 * politique décide qui lit quoi. Il évite seulement qu'une chaîne quelconque
 * dans l'URL fasse lever le pilote, c'est-à-dire qu'un lien forgé rende une
 * erreur de serveur là où « introuvable » est la bonne réponse.
 */
function estUnIdentifiant(valeur: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    valeur,
  );
}
