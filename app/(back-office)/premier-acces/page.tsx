import { Vide } from "@/components/charte/socle";
import { Champ, Formulaire, Message } from "@/components/session/formulaire";
import { t } from "@/lib/i18n/fr";

/**
 * LE PREMIER ACCÈS (ticket L2-15) — la page que l'URL d'amorçage désignait
 * depuis D65, et qui n'existait pas.
 *
 * **Mesuré le 09/09/2026 : l'URL imprimée par `scripts/amorcage-premier-compte`
 * conduisait à un 404.** Le compte s'ouvrait, la porte se refermait derrière
 * lui, et personne ne pouvait s'en servir — *une garantie qu'on ne peut pas
 * emprunter n'en est pas une.*
 *
 * Elle n'apprend rien : sans jeton, elle ne dit pas qu'il manque un compte, elle
 * dit qu'il manque un lien. Avec un jeton faux, le refus est celui de D35.
 */
export default async function PagePremierAcces({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parametres = await searchParams;
  const jeton = parametres.token;
  const motif = parametres.motif;

  if (typeof jeton !== "string" || jeton === "") {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-5 px-4 py-12 sm:px-6">
        <Vide
          titre={t("premier_acces.sans_jeton.titre")}
          invitation={t("premier_acces.sans_jeton.invitation")}
        />
      </main>
    );
  }

  return (
    <Formulaire
      action="/api/session/premier-acces"
      titre={t("premier_acces.titre")}
      accroche={t("premier_acces.accroche")}
      valider={t("premier_acces.valider")}
    >
      <Message motif={typeof motif === "string" ? motif : undefined} />
      {/* Le jeton voyage dans le CORPS du POST, jamais dans l'URL de la
          requête qui pose le mot de passe : une URL se retrouve dans un
          journal de serveur mandataire, un corps de POST non. */}
      <input type="hidden" name="jeton" value={jeton} />
      <Champ
        nom="motDePasse"
        type="password"
        libelle={t("premier_acces.mot_de_passe")}
      />
    </Formulaire>
  );
}
