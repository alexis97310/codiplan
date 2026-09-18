import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { Page } from "@/components/mise-en-page/page";
import { FormulaireVerification } from "@/components/vgp/formulaire-verification";
import { obtenirSession } from "@/lib/auth/session";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { lireMachine } from "@/lib/machines/depot";

/**
 * ENREGISTRER UNE VÉRIFICATION VGP (lot A5+A7, second temps).
 *
 * ## CE QUE CET ÉCRAN RÉPARE
 *
 * `enregistrerVerification` (`lib/vgp/verification.ts`) existait — testée,
 * documentée, EN BASE depuis D114 (12/09/2026) — et n'avait AUCUN appelant :
 * ni écran, ni route. *Une obligation réglementaire qu'on ne peut pas
 * enregistrer est un écran qui ment* — le registre affichait « sans
 * information » pour toujours, sans qu'aucun chemin ne permette de le
 * démentir.
 *
 * ## CET ÉCRAN N'EST DESSINÉ PAR AUCUNE DES DEUX MAQUETTES
 *
 * Ni `CODIPLAN_Maquette.html` ni `codiplan-maquette-complete.html` ne
 * dessinent un formulaire de saisie VGP — leurs onze puis quatorze écrans sont
 * peuplés de données de démonstration, jamais d'un formulaire de ce genre
 * (même raison que `ÉtatVide` et `Champ` dans `tests/unit/ui/
 * composants-maquette.test.ts`). La forme ci-dessous suit donc le même
 * vocabulaire que les formulaires déjà écrits sous cette autorité —
 * `FormulaireForfait`, R2-20 — plutôt que d'en inventer un nouveau.
 *
 * ## L'ORIGINE EST OBLIGATOIRE, SANS DÉFAUT (D114)
 *
 * Voir `FormulaireVerification` : *une origine par défaut serait une valeur
 * probante inventée*, et l'option vide du `<select>` est désactivée.
 */
export default async function PageEnregistrerVerification({
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
  const contexte = session.contexte;

  const { id } = await params;
  const machine = await lireMachine(contexte, id);
  if (machine === null) {
    notFound();
  }

  const motif = (await searchParams).motif;

  return (
    <Page
      chemin="/vgp"
      titre={t("vgp.verifier.titre")}
      sousTitre={sousTitreAffiche(machine)}
      actions={
        <Link href="/vgp" className="text-app-encre-faible text-[12.5px]">
          {t("vgp.verifier.retour")}
        </Link>
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

      <FormulaireVerification action={`/api/vgp/enregistrer/${machine.id}`} />
    </Page>
  );
}

/**
 * Le sous-titre — machine, client, site. Composé HORS du JSX (L0-11), comme
 * `machinePage()` le fait déjà pour son propre en-tête (`${m.client} · ${m.site}`).
 */
function sousTitreAffiche(machine: {
  numero_serie: string;
  client: { raison_sociale: string };
  site: { libelle: string };
}): string {
  return `${machine.numero_serie} · ${machine.client.raison_sociale} · ${machine.site.libelle}`;
}
