import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { obtenirSession } from "@/lib/auth/session";
import { t } from "@/lib/i18n/fr";
import { chromeDeLaRequete } from "@/lib/navigation/chrome";

/**
 * L'ÉCRAN « CHARTE DE LA SOCIÉTÉ » (N-02, arbitrage du 16/09/2026).
 *
 * ## CE QUE CE TICKET DÉPLACE, ET POURQUOI
 *
 * La barre de navigation portait, en PERMANENCE, une pastille disant
 * « Charte de la société » ou « Thème neutre CODIPLAN » — une information
 * réelle, mais qui répond à une question qu'on se pose UNE FOIS, à la mise en
 * service, et qui occupait la place la plus chère de l'écran : celle que la
 * déconnexion réclamait, absente de partout ailleurs qu'un écran d'atterrissage
 * sur lequel on ne revient jamais. *L'information ne disparaît pas, elle
 * déménage* — ici, sous « Sociétés & tarifs », qui est déjà l'endroit où la
 * société se règle.
 *
 * ## CET ÉCRAN LIT, IL NE RÈGLE RIEN — ET C'EST ÉCRIT PLUTÔT QUE TU
 *
 * `couleur_primaire` et `couleur_secondaire` n'ont aujourd'hui AUCUN chemin
 * d'écriture : elles s'amorcent par `pnpm db:societe-initiale` et par le semis,
 * jamais par un formulaire. Proposer un bouton qui ne mène nulle part serait
 * pire que ne pas le proposer (R2-20) : l'écran DIT donc que le réglage est à
 * venir plutôt que de laisser croire à un formulaire qui manque.
 *
 * **La console éditeur (lot 7) héritera de ce réglage.** C'est elle qui doit
 * donner à une société le formulaire qui change ses couleurs — un client règle
 * sa propre charte, pas un opérateur CODIMA pour son compte — et le jour où
 * elle l'ouvrira, ce sera un formulaire de plus sur cet écran, jamais un écran
 * de plus à trouver.
 *
 * ## LE THÈME VIENT DE `chromeDeLaRequete`, PAS D'UNE SECONDE LECTURE
 *
 * La même fonction sert la barre de navigation de ce rendu : `cache()` en
 * garantit UNE lecture par requête, et une lecture écrite ici à la main
 * divergerait en silence le jour où l'une des deux change (§9, 01/09).
 */
export default async function PageParametresSociete() {
  const session = await obtenirSession(await headers());
  if (session === null) {
    redirect("/connexion");
  }
  if (session.contexte.societeId === null) {
    redirect("/arrivee");
  }

  const { theme } = await chromeDeLaRequete();

  return (
    <main className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-[22px] font-extrabold tracking-tight">
          {t("parametres.societe_titre")}
        </h1>
        <p className="text-app-encre-faible text-[13px]">
          {t("parametres.societe_sous_titre")}
        </p>
      </header>

      <section className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-[10px] border px-4 py-3.5">
        {/* LA MÊME FORME que la pastille retirée de la barre — même jetons,
            même donnée, un lecteur qui la reconnaît d'un écran à l'autre. */}
        <div
          data-origine-theme={theme.origine}
          className="bg-societe-primaire text-societe-primaire-encre flex w-fit items-center gap-2 rounded-md px-3 py-1.5"
        >
          <span className="text-[13px] font-bold tracking-tight">
            {theme.nom}
          </span>
          <span className="bg-societe-accent text-societe-accent-encre rounded px-1.5 py-0.5 text-[10px] font-semibold">
            {t(theme.origine === "defaut" ? "theme.neutre" : "theme.societe")}
          </span>
        </div>
        <p className="text-app-encre-faible text-[12.5px]">
          {t("parametres.societe_diagnostic_aide")}
        </p>
      </section>

      <p className="text-app-encre-faible text-[11.5px]">
        {t("parametres.societe_reglage_a_venir")}
      </p>
    </main>
  );
}
