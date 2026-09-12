import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Cellule, LignePleine, Tableau } from "@/components/ui/tableau";
import { obtenirSession } from "@/lib/auth/session";
import { maintenant, schemaFuseau } from "@/lib/calendar/fuseau";
import { avecContexteApplicatif } from "@/lib/db/client";
import { t } from "@/lib/i18n/fr";
import { libelleEtatInformation } from "@/lib/vgp/libelles";
import {
  famillesADeterminer,
  listerLeRegistre,
  type LigneDeRegistre,
} from "@/lib/vgp/registre";

/**
 * LE REGISTRE DES VÉRIFICATIONS PÉRIODIQUES (L9-02, L9-03 ; D88).
 *
 * ## AUCUN ÉTAT N'EST RENDU SANS SA DATE, ET AUCUN N'EST UN VERDICT
 *
 * C'est l'acceptation de L9-02, mot pour mot : *« aucun écran du lot ne rend un
 * état sans le dater ; l'absence d'information a un libellé propre, distinct de
 * "conforme" et de "non conforme" ».* Les trois libellés d'état viennent du
 * dictionnaire et **aucun ne porte le mot « conforme »** — pas parce qu'on
 * l'aurait oublié, mais parce que *CODIPLAN n'affirme jamais la conformité* :
 * les vérifications sont commandées par les CLIENTS, et leur résultat n'arrive
 * ici que si on nous le transmet.
 *
 * ## « SANS INFORMATION » EST UNE VALEUR, JAMAIS UN BLANC
 *
 * *Le danger est qu'un registre à moitié rempli ressemble à un registre
 * complet* — c'est le zéro de `/sante` lu comme « installation vide », à
 * l'échelle d'un parc. Une cellule vide se lirait comme « rien à signaler ».
 *
 * ## CE QUE CET ÉCRAN AFFICHE AUJOURD'HUI, ET IL LE DIT
 *
 * **Toutes les machines soumises sont « sans information »**, parce que rien
 * n'enregistre encore ce qu'un organisme a écrit : le rapport de VGP est un
 * document de classe `client` (D88 §9), et rien ne le distingue d'un autre
 * document. L'écran porte cette phrase en toutes lettres plutôt que de laisser
 * croire à un parc jamais vérifié. *Un écran qui se tait sur ce qu'il ne sait
 * pas est exactement le registre qui ment.*
 *
 * ## LA LISTE DES INDÉTERMINÉS EST À UN CLIC, ET SON COMPTE EST ICI
 *
 * C'est la seconde moitié de L9-03, et c'est elle qui fait tenir la première :
 * *une famille qui naît « à déterminer » et que personne ne voit jamais est
 * exactement la case décochée qu'on a refusée.*
 *
 * ## CET ÉCRAN N'EST PAS UNE ENTRÉE DE LA BARRE, ET C'EST DÉLIBÉRÉ
 *
 * La barre est une liste CLOSE confrontée à la maquette (D95), et la maquette
 * n'y porte aucune entrée « VGP ». Une douzième entrée la ferait rougir à
 * raison. Le registre se rejoint donc par un LIEN depuis le parc — le même
 * traitement que l'écran des lieux (L3-16).
 */
const LIGNES_AFFICHEES = 200;

export default async function PageRegistreVgp() {
  const session = await obtenirSession(await headers());
  if (session === null) {
    redirect("/connexion");
  }
  if (session.contexte.societeId === null) {
    redirect("/arrivee");
  }
  const contexte = session.contexte;

  // LE FUSEAU EST UNE DONNÉE, JAMAIS UN LITTÉRAL (L0-08) : la date courante ne
  // se lit pas sans lui, et c'est celui de la société — le registre couvre
  // toutes ses agences.
  const societe = await avecContexteApplicatif(contexte, (tx) =>
    tx.societe.findFirst({
      where: { id: contexte.societeId as string },
      select: { fuseau_horaire: true },
    }),
  );
  const fuseau = schemaFuseau.parse(societe?.fuseau_horaire);
  const aujourdHui = maintenant(fuseau).instant;

  const lignes = await listerLeRegistre(contexte, aujourdHui, LIGNES_AFFICHEES);
  const indetermines = await famillesADeterminer(contexte);

  const colonnes = [
    { cle: "machine", libelle: t("vgp.colonne_machine"), largeur: "170px" },
    { cle: "lieu", libelle: t("vgp.colonne_lieu") },
    { cle: "famille", libelle: t("vgp.colonne_famille") },
    { cle: "regime", libelle: t("vgp.colonne_regime"), largeur: "230px" },
    {
      cle: "information",
      libelle: t("vgp.colonne_information"),
      largeur: "230px",
    },
  ];

  return (
    <main className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <Link href="/parc" className="text-app-encre-faible text-[12.5px]">
          {t("vgp.retour")}
        </Link>
        <h1 className="text-[22px] font-extrabold tracking-tight">
          {t("vgp.titre")}
        </h1>
        <p className="text-app-encre-faible max-w-[70ch] text-[13px]">
          {t("vgp.sous_titre")}
        </p>
      </header>

      {/*
        LE COMPTE DES INDÉTERMINÉS EST UN LIEN, jamais un simple chiffre : *sans
        la liste visible, la troisième valeur ne sert à rien* (D88 §3). Zéro
        famille indéterminée n'efface pas le lien — il dirait alors que la
        question ne se pose plus, ce qui est faux : une famille créée demain y
        revient.
      */}
      <Link
        href="/vgp/a-determiner"
        className="border-app-orange-bord bg-app-orange-fond text-app-orange-encre rounded-md border px-3.5 py-2.5 text-[12.5px] font-bold"
      >
        {indetermines.length} {t("vgp.indetermines.lien")}
      </Link>

      <p className="text-app-encre-faible max-w-[80ch] text-[11.5px]">
        {t("vgp.information.rien_ne_remplit")}
      </p>

      <section className="bg-app-surface border-app-bord overflow-hidden rounded-[10px] border">
        <Tableau colonnes={colonnes} minimum="1020px">
          {lignes.length === 0 ? (
            <LignePleine colonnes={colonnes.length}>
              {t("vgp.vide")}
            </LignePleine>
          ) : null}
          {lignes.map((ligne) => (
            <LigneRegistre key={ligne.id} ligne={ligne} />
          ))}
        </Tableau>
      </section>

      <p className="text-app-encre-faible text-[11.5px]">{t("vgp.borne")}</p>
    </main>
  );
}

function LigneRegistre({ ligne }: { readonly ligne: LigneDeRegistre }) {
  return (
    <tr>
      <Cellule mono>
        <Link
          href={`/parc/${ligne.id}`}
          className="underline-offset-2 hover:underline"
        >
          {ligne.numero_serie}
        </Link>
      </Cellule>
      <Cellule>
        {ligne.client}
        <span className="text-app-encre-faible block text-[11.5px]">
          {ligne.site}
        </span>
      </Cellule>
      <Cellule>
        {ligne.famille}
        <span className="text-app-encre-faible block text-[11.5px]">
          {ligne.modele}
        </span>
      </Cellule>
      <Cellule>
        {t(`vgp.regime.${ligne.assujettissement}`)}
        {/*
          L'ORIGINE ACCOMPAGNE LE RÉGIME, TOUJOURS (D56) : *un nombre dont la
          signification dépend d'une autre colonne ne voyage jamais seul.* Le
          jour où une famille change d'avis, c'est cette mention qui dit
          quelles machines revoir.
        */}
        <span className="text-app-encre-faible block text-[11.5px]">
          {regimeExplique(ligne)}
        </span>
      </Cellule>
      <Cellule>{libelleEtatInformation(ligne.information)}</Cellule>
    </tr>
  );
}

/**
 * LE RYTHME, AVEC LE NIVEAU QUI L'A FIXÉ ET LE TEXTE QUI LE FONDE.
 *
 * *Sans le texte, la périodicité est un chiffre que personne ne peut défendre*
 * (D88 §4). Aucune durée n'est écrite ici : le nombre de mois vient de la
 * donnée saisie, et « aucun rythme déclaré » est un libellé, pas un zéro.
 */
function regimeExplique(ligne: LigneDeRegistre): string {
  // La chaîne est composée ICI et non dans le JSX : `react/jsx-no-literals`
  // refuse le moindre texte dans un composant, et il a raison — *aucune chaîne
  // en dur dans un composant* (§5 du CLAUDE.md). Le séparateur en est une.
  return `${t(`vgp.origine.${ligne.origine}`)} \u00b7 ${rythmeAffiche(ligne)}`;
}

function rythmeAffiche(ligne: LigneDeRegistre): string {
  if (ligne.periodiciteMois === null || ligne.originePeriodicite === null) {
    return t("vgp.periodicite.aucune");
  }
  const provenance = t(`vgp.periodicite.${ligne.originePeriodicite}`);
  const texte =
    ligne.referenceTexte === null ? "" : ` \u00b7 ${ligne.referenceTexte}`;
  return `${ligne.periodiciteMois} mois — ${provenance}${texte}`;
}
