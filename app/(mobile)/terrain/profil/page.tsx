import type { Metadata } from "next";

import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BoutonInstallerCodiplan } from "@/components/pwa/bouton-installer";
import { PastilleReseau } from "@/components/terrain/pastille-reseau";
import { avecContexteApplicatif } from "@/lib/db/client";
import { obtenirSession } from "@/lib/auth/session";
import { t } from "@/lib/i18n/fr";
import { perimetreDuPlanning } from "@/lib/interventions/perimetre-technicien";

export const metadata: Metadata = { title: t("terrain.profil.titre") };

/**
 * LE PROFIL DU TECHNICIEN (QE-11, D161) — minimal : son nom, son courriel, la
 * société active, et le seul mécanisme de déconnexion.
 *
 * ## CE QU'IL NE PORTE PAS, ET POURQUOI
 *
 * Ses absences, ses habilitations et leurs échéances dessinées par la
 * maquette du 28/09 (`route("/terrain/profil")`, :5366) arriveront avec
 * TP-ABS — ce lot ne porte que ce que QE-11 (a) exige : un écran de PLUS que
 * « Ma journée » pour que la barre basse ait une seconde étape à montrer.
 *
 * ## MÊME GARDE QUE « MA JOURNÉE », ET POUR LA MÊME RAISON
 *
 * Un rôle à accès complet n'a pas de « profil terrain » : il a le sien, au
 * back-office. `perimetreDuPlanning` tranche déjà cette question pour
 * `/terrain` ; la relire ici évite qu'un lien de la barre basse n'ouvre, pour
 * ce rôle, un écran qui ne lui est pas destiné.
 */
export default async function PageProfilTerrain() {
  const session = await obtenirSession(await headers());
  if (session === null) {
    redirect("/connexion");
  }
  if (session.contexte.societeId === null || session.contexte.role === null) {
    redirect("/arrivee");
  }
  const contexte = {
    ...session.contexte,
    societeId: session.contexte.societeId,
    role: session.contexte.role,
  };

  const perimetre = perimetreDuPlanning(contexte);
  if (perimetre.acces === "complet") {
    redirect("/planning");
  }
  if (perimetre.acces === "aucun") {
    redirect("/arrivee");
  }

  const societe = await avecContexteApplicatif(contexte, (tx) =>
    tx.societe.findFirst({
      where: { id: contexte.societeId },
      select: { raison_sociale: true },
    }),
  );

  return (
    <main className="flex flex-col gap-4">
      {/* TITRE + PASTILLE, SUR UNE LIGNE (audit du 10/11/2026, m8/m13,
          maquette 07-profil) — même disposition que « Ma journée »
          (`app/(mobile)/terrain/page.tsx`), jamais une seconde forme du même
          bandeau (§9, 01/09). */}
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="text-24 font-extrabold tracking-tight">
          {t("terrain.profil.titre")}
        </h1>
        <PastilleReseau
          utilisateurId={contexte.utilisateurId}
          societeId={contexte.societeId}
        />
      </header>

      <section className="bg-app-surface border-app-bord flex flex-col gap-2.5 rounded-lg border px-4 py-3.5 text-16 font-bold">
        <p>{session.identite.nom}</p>
        <p className="text-app-encre-faible">{session.identite.email}</p>
        <p className="text-app-encre-faible">
          {ligneSociete(societe?.raison_sociale ?? null)}
        </p>
      </section>

      <BoutonInstallerCodiplan />

      <Link
        href="/terrain/profil/mot-de-passe"
        className="border-app-bord bg-app-surface w-full rounded-md border px-4 py-2.5 text-center text-16 font-bold"
      >
        {t("terrain.mot_de_passe.titre")}
      </Link>

      <form action="/api/session/deconnexion" method="post">
        <button
          type="submit"
          className="border-app-bord bg-app-surface w-full rounded-md border px-4 py-2.5 text-16 font-bold"
        >
          {t("nav.deconnexion")}
        </button>
      </form>
    </main>
  );
}

/** « Société : X », composé hors du JSX, où aucun littéral n'est admis (L0-11). */
function ligneSociete(raisonSociale: string | null): string {
  return `${t("terrain.profil.societe")}${t("ponctuation.deux_points")}${raisonSociale ?? t("terrain.inconnu")}`;
}
