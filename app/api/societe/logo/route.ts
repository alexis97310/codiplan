import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerSessionActive } from "@/lib/auth/porte";
import { lireLogo } from "@/lib/societes/logo";

/**
 * `GET /api/societe/logo` — LE LOGO DE LA SOCIÉTÉ ACTIVE (9EZ-LOGO-SOCIETE-1).
 *
 * **Session requise, aucune capacité particulière** : tout compte de la
 * société peut VOIR le logo (c'est lui qui s'affiche dans la barre), seul le
 * dépôt exige `parametrer_societe`. `404` sans session, sans société active,
 * ou sans logo déposé — jamais de distinction entre les trois, pour ne pas
 * apprendre à un appelant non authentifié lequel des trois cas il observe.
 *
 * **`ETag` = l'empreinte** : un navigateur qui repose `If-None-Match` avec la
 * même valeur reçoit `304`, sans relire les octets. `Cache-Control: private`
 * (jamais partagé — le logo dépend de la société active) et `max-age=86400`
 * (la clé `?v=<empreinte>` posée par la barre et le bon invalide le cache dès
 * que le logo change, sans attendre l'expiration).
 */
export async function GET(requete: Request): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(requete));
}

async function traiter(requete: Request): Promise<Response> {
  const contexte = await exigerSessionActive();
  if (contexte === null) {
    return new Response(null, { status: 404 });
  }

  const logo = await lireLogo(contexte);
  if (logo === null) {
    return new Response(null, { status: 404 });
  }

  if (requete.headers.get("if-none-match") === logo.empreinte) {
    return new Response(null, { status: 304 });
  }

  return new Response(new Uint8Array(logo.octets), {
    status: 200,
    headers: {
      "Content-Type": logo.type,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=86400",
      ETag: logo.empreinte,
    },
  });
}
