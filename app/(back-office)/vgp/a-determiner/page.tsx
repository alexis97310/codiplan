import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Page } from "@/components/mise-en-page/page";
import { Cellule, LignePleine, Tableau } from "@/components/ui/tableau";
import { obtenirSession } from "@/lib/auth/session";
import { t } from "@/lib/i18n/fr";
import { famillesADeterminer } from "@/lib/vgp/registre";

/**
 * LES FAMILLES « À DÉTERMINER » — LA MOITIÉ DÉTECTIVE DE L9-03 (D88 §3).
 *
 * ## POURQUOI CET ÉCRAN EXISTE, ET CE QU'IL SERAIT SANS LUI
 *
 * L'assujettissement se déclare à la famille, et **une famille nouvelle naît
 * « à déterminer »** plutôt que décochée : *une case décochée est indiscernable
 * d'une famille jamais examinée, et un pont élévateur sortirait du registre en
 * silence.* Mais une troisième valeur que personne ne regarde ne vaut pas mieux
 * que la case : *une garantie qu'on ne peut pas constater après coup est une
 * intention* (§9, 30/08). **Cet écran est la constatation.**
 *
 * ## LE COMPTE DES MACHINES EST UN DÉNOMBREMENT, JAMAIS UN VERDICT
 *
 * Il est là parce qu'une décision se priorise : *« ponts élévateurs, 47
 * machines »* se traite avant *« outillage pneumatique, 1 machine »*. Il ne dit
 * rien de la conformité de ces machines — il dit combien de fiches attendent
 * qu'un humain tranche.
 *
 * ## ZÉRO FAMILLE N'EST PAS UNE PAGE VIDE
 *
 * Le libellé dit que **toutes** ont été examinées, et qu'une famille créée
 * demain reviendra ici. Un tableau vide sans phrase se lirait comme un écran
 * cassé, ou pire, comme une question qui ne se pose plus.
 */
export default async function PageFamillesADeterminer() {
  const session = await obtenirSession(await headers());
  if (session === null) {
    redirect("/connexion");
  }
  if (session.contexte.societeId === null) {
    redirect("/arrivee");
  }

  const familles = await famillesADeterminer(session.contexte);

  const colonnes = [
    { cle: "famille", libelle: t("vgp.indetermines.colonne_famille") },
    {
      cle: "machines",
      libelle: t("vgp.indetermines.colonne_machines"),
      largeur: "260px",
    },
  ];

  return (
    <Page
      chemin="/vgp"
      titre={t("vgp.indetermines.titre")}
      sousTitre={t("vgp.indetermines.sous_titre")}
      actions={
        <Link href="/vgp" className="text-app-encre-faible text-[12.5px]">
          {t("vgp.indetermines.retour")}
        </Link>
      }
    >
      <section className="bg-app-surface border-app-bord overflow-hidden rounded-[10px] border">
        <Tableau colonnes={colonnes} minimum="620px">
          {familles.length === 0 ? (
            <LignePleine colonnes={colonnes.length}>
              {t("vgp.indetermines.aucune")}
            </LignePleine>
          ) : null}
          {familles.map((famille) => (
            <tr key={famille.id}>
              <Cellule>{famille.libelle}</Cellule>
              <Cellule>{famille.machines}</Cellule>
            </tr>
          ))}
        </Tableau>
      </section>
    </Page>
  );
}
