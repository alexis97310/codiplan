import type { Metadata } from "next";

import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { MarqueClaire } from "@/components/navigation/marque";
import { Champ, Formulaire, Message } from "@/components/session/formulaire";
import { QrCode } from "@/components/ui/qr-code";
import { etatArriveeOuAnonyme } from "@/lib/auth/arrivee";
import { preparationEnAttenteOuAnonyme } from "@/lib/auth/enrolement";
import { t } from "@/lib/i18n/fr";

export const metadata: Metadata = { title: t("enrolement.titre") };

/**
 * PARCOURS D'ENRÔLEMENT DU SECOND FACTEUR (ticket L1-02f, décision D58).
 *
 * **C'est le seul écran de libre-service du produit**, et il n'ouvre qu'une
 * transition, dans un seul sens : un compte peut se doter d'un second facteur,
 * il ne peut jamais s'en défaire. La page le DIT, parce qu'un utilisateur a le
 * droit de savoir qu'un geste est définitif avant de le faire.
 *
 * Deux étapes sur un même écran : tant qu'aucune préparation n'est en
 * attente, on demande le mot de passe ; une fois préparée, on affiche la clé,
 * le QR code et les codes de secours, et on demande le code.
 *
 * **La clé et les codes de secours ne transitent plus jamais par l'URL**
 * (TR-36, 9CW-TP-S6) : `preparationEnAttenteOuAnonyme` les relit côté serveur,
 * depuis la ligne non confirmée de `second_facteur` du compte de la session —
 * jamais `obtenirSession` à nu, puisque cet écran précède la session et ne
 * doit jamais lever (R2-16). Ils restent relisibles tant que la confirmation
 * n'a pas eu lieu — un code faux (TR-39) les montre donc de nouveau, plutôt
 * que de faire retomber l'écran sur l'étape du mot de passe.
 */
export default async function PageEnrolement({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const entetes = await headers();
  const etat = await etatArriveeOuAnonyme(entetes);
  if (etat.issue === "anonyme") {
    redirect("/connexion");
  }
  if (etat.issue !== "enrolement_requis") {
    // Rien à enrôler : soit le compte porte déjà son facteur, soit son rôle ne
    // l'exige pas. Dans les deux cas, cet écran n'a rien à lui demander.
    redirect("/arrivee");
  }

  const etape = await preparationEnAttenteOuAnonyme(entetes);
  if (etape === null) {
    // Ne peut pas arriver — `etatArriveeOuAnonyme` vient de lire la même
    // session — mais une page qui précède la session ne lève jamais (R2-16).
    redirect("/connexion");
  }

  const motifParam = (await searchParams).motif;
  const motif = typeof motifParam === "string" ? motifParam : undefined;

  const { preparation } = etape;

  if (preparation === null) {
    return (
      <>
        <MarqueClaire accueil="/" />
        <Formulaire
          action="/api/session/enrolement"
          titre={t("enrolement.titre")}
          accroche={t("enrolement.accroche")}
          valider={t("enrolement.reveler")}
        >
          <Message motif={motif} />
          <p className="text-muted-foreground text-sm">
            {t("enrolement.definitif")}
          </p>
          <input type="hidden" name="etape" value="preparer" />
          <Champ
            nom="motDePasse"
            type="password"
            libelle={t("enrolement.mot_de_passe")}
          />
        </Formulaire>
        <Deconnexion />
      </>
    );
  }

  return (
    <>
      <MarqueClaire accueil="/" />
      <Formulaire
        action="/api/session/enrolement"
        titre={t("enrolement.titre")}
        accroche={t("enrolement.cle.aide")}
        valider={t("enrolement.confirmer")}
      >
        <Message motif={motif} />

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t("enrolement.cle")}</span>
          <code className="bg-muted rounded-md px-3 py-2 font-mono text-sm break-all">
            {preparation.cleManuelle}
          </code>
        </div>

        <div className="flex justify-center">
          <QrCode
            valeur={preparation.uriTotp}
            taille={200}
            titre={t("enrolement.qr.titre")}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">
            {t("enrolement.codes_secours")}
          </span>
          <p className="text-muted-foreground text-sm">
            {t("enrolement.codes_secours.aide")}
          </p>
          <ul className="bg-muted grid grid-cols-2 gap-1 rounded-md px-3 py-2 font-mono text-sm">
            {preparation.codesSecours.map((code) => (
              <li key={code}>{code}</li>
            ))}
          </ul>
        </div>

        <input type="hidden" name="etape" value="confirmer" />
        <Champ
          nom="code"
          type="text"
          libelle={t("enrolement.code")}
          motif="[0-9]{6}"
        />
      </Formulaire>
      <Deconnexion />
    </>
  );
}

/**
 * « Se déconnecter », offerte sur une étape sans session complète (TR-38) —
 * ce chrome n'a pas la barre qui la porte ailleurs (`components/navigation/barre.tsx`).
 * Même route, même geste : un POST, jamais un lien.
 */
function Deconnexion() {
  return (
    <form
      action="/api/session/deconnexion"
      method="post"
      className="mx-auto w-full max-w-md"
    >
      <button
        type="submit"
        className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-4"
      >
        {t("nav.deconnexion")}
      </button>
    </form>
  );
}
