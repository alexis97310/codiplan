#!/usr/bin/env bash
#
# CODIPLAN — cluster PostgreSQL local JETABLE pour `pnpm test:isolation`.
#
# Pourquoi un script plutôt qu'une suite de commandes recopiées : la procédure
# manuelle échouait silencieusement parce que `su postgres -c` n'hérite pas du
# PATH de l'appelant (`initdb: command not found`, même après un `export PATH`).
# Le chemin des binaires du serveur est donc résolu ici, une fois, et passé en
# absolu. Voir docs/decisions/2026-08-20-tests-isolation-postgres-local.md.
#
# Cette base est JETABLE : elle est détruite et recréée à chaque exécution, et
# ne contient jamais que des données de test (I9). Elle n'est JAMAIS la base
# hébergée — un garde-fou du harnais d'isolation refuse une URL Neon ou
# identique à DATABASE_URL.
#
# Usage :
#   scripts/postgres-jetable.sh           # (re)crée le cluster et le démarre
#   scripts/postgres-jetable.sh arret     # arrête le cluster, sans le détruire
#   scripts/postgres-jetable.sh etat      # dit s'il tourne
#
# Réglages (variables d'environnement, valeurs par défaut entre parenthèses) :
#   PGJ_PORT   (5433)                                             port d'écoute
#   PGJ_ROOT   (${TMPDIR:-/tmp}/codiplan-postgres-jetable/$PGJ_PORT)
#                                                                  répertoire du cluster —
#              dépend du PORT par défaut, pour que deux voies parallèles
#              (deux ports différents) ne se marchent jamais dessus sans
#              rien poser d'autre
#   PGJ_BASE   (codiplan_test)                                    nom de la base
#   PGJ_BIN    (détecté)                                          répertoire des binaires du
#                                                                  serveur — force une AUTRE
#                                                                  version que celle épinglée
#                                                                  par la CI, en connaissance
#                                                                  de cause (voir plus bas)

set -euo pipefail

PORT="${PGJ_PORT:-5433}"
RACINE="${PGJ_ROOT:-${TMPDIR:-/tmp}/codiplan-postgres-jetable/$PORT}"
BASE="${PGJ_BASE:-codiplan_test}"
DONNEES="$RACINE/data"
JOURNAL="$RACINE/log"

# ── Binaires du serveur ──────────────────────────────────────────────────────
# `initdb` et `pg_ctl` ne sont pas dans le PATH par défaut sur Debian/Ubuntu :
# ils vivent sous /usr/lib/postgresql/<version>/bin, que seuls les paquets
# postgresql-client-common exposent (et encore, pas ces deux-là).
#
# LA VERSION EST CELLE QUE LA CI ÉPINGLE, PAS LA PLUS ÉLEVÉE INSTALLÉE.
# `.github/workflows/ci.yml` épingle `image: postgres:16` — la CI est la
# référence, c'est elle qui décide si un lot est publié. Une machine qui porte
# aussi une version plus récente (ex. 18) ne doit JAMAIS faire tourner les
# scénarios d'isolation contre elle en silence : un `test:isolation` vert en
# local sur la mauvaise version ne prouve rien sur ce que la CI validera, et un
# `test:isolation` rouge en local pour une raison sans rapport avec le ticket
# en cours coûte du temps de diagnostic (mesuré, lot 23-IMPORT-2, 23/09/2026).
# `tests/unit/scripts/postgres-jetable-version.test.ts` garde ce littéral
# contre `ci.yml` : les deux ne peuvent pas diverger en silence.
VERSION_CIBLE="16"

# Réglage interne, réservé aux épreuves de `postgres-jetable-version.test.ts` :
# racine de l'arbre `<racine>/<version>/bin` sous Debian/Ubuntu, pour fabriquer
# un arbre de versions factice sans toucher au vrai `/usr/lib/postgresql` de la
# machine qui exécute le test — ni en dépendre.
RACINE_DEBIAN="${PGJ_RACINE_DEBIAN:-/usr/lib/postgresql}"

BIN="${PGJ_BIN:-}"
if [ -z "$BIN" ]; then
  for candidat in "$RACINE_DEBIAN/$VERSION_CIBLE/bin" /usr/local/pgsql/bin "/opt/homebrew/opt/postgresql@$VERSION_CIBLE/bin"; do
    if [ -x "$candidat/initdb" ]; then
      BIN="$candidat"
      break
    fi
  done
fi
if [ -z "$BIN" ] || [ ! -x "$BIN/initdb" ]; then
  echo "PostgreSQL $VERSION_CIBLE introuvable (version épinglée par .github/workflows/ci.yml)." >&2
  echo "Installer le paquet postgresql-$VERSION_CIBLE," >&2
  echo "ou indiquer le répertoire des binaires d'une AUTRE version dans PGJ_BIN," >&2
  echo "en connaissance de cause : ce script ne se rabat jamais tout seul sur une autre version." >&2
  exit 1
fi

# ── Compte système propriétaire du cluster ───────────────────────────────────
# PostgreSQL refuse de démarrer sous root. Si le script est lancé en root (cas
# d'une session Claude Code ou d'un conteneur), on repasse par le compte
# `postgres` ; sinon on reste sur le compte courant, qui est alors le
# propriétaire du cluster.
COMPTE=""
if [ "$(id -u)" -eq 0 ]; then
  if ! getent passwd postgres >/dev/null; then
    echo "Lancé en root mais le compte système « postgres » n'existe pas." >&2
    echo "Relancer sous un compte non privilégié, ou installer postgresql-common." >&2
    exit 1
  fi
  COMPTE="postgres"
fi

# Exécute une commande du serveur sous le bon compte. Le PATH n'est pas
# transmis par `su` : toutes les commandes passées ici portent des chemins
# absolus (c'est précisément le piège que ce script referme).
serveur() {
  if [ -n "$COMPTE" ]; then
    su "$COMPTE" -c "$*"
  else
    eval "$*"
  fi
}

tourne() {
  serveur "'$BIN/pg_ctl' -D '$DONNEES' status" >/dev/null 2>&1
}

arreter() {
  if tourne; then
    serveur "'$BIN/pg_ctl' -D '$DONNEES' -m fast -w stop" >/dev/null
    echo "Cluster arrêté ($DONNEES)."
  else
    echo "Aucun cluster en cours d'exécution ($DONNEES)."
  fi
}

case "${1:-creer}" in
  arret | stop)
    arreter
    exit 0
    ;;
  etat | status)
    if tourne; then
      echo "En cours d'exécution — port $PORT, données $DONNEES."
    else
      echo "Arrêté ($DONNEES)."
      exit 1
    fi
    exit 0
    ;;
  creer | "") ;;
  *)
    echo "Argument inconnu : $1 (attendus : creer, arret, etat)" >&2
    exit 1
    ;;
esac

# ── (Re)création ─────────────────────────────────────────────────────────────
[ -d "$DONNEES" ] && arreter >/dev/null 2>&1 || true

rm -rf "$RACINE"
mkdir -p "$RACINE"
if [ -n "$COMPTE" ]; then
  chown -R "$COMPTE" "$RACINE"
fi
chmod 700 "$RACINE"

# Authentification « trust » : cluster local, jetable, sans donnée réelle, et
# les scénarios s'y connectent sous trois rôles distincts sans mot de passe.
serveur "'$BIN/initdb' -D '$DONNEES' -U postgres --auth=trust -E UTF8" >/dev/null
# `unix_socket_directories` : le paquet PostgreSQL d'Ubuntu compile
# `/var/run/postgresql` comme défaut, un répertoire que seul le groupe système
# `postgres` peut écrire — mesuré ici même : `pg_ctl: could not start server`,
# `could not create lock file "/var/run/postgresql/.s.PGSQL.<port>.lock":
# Permission denied`. Un répertoire de données accessible sans root ne suffit
# donc pas : le socket doit, lui aussi, rester dans un répertoire où la session
# peut écrire — ici, `$RACINE` lui-même, déjà créé et chmodé plus haut.
serveur "'$BIN/pg_ctl' -D '$DONNEES' -o \"-p $PORT -c unix_socket_directories='$RACINE'\" -l '$JOURNAL' -w start" >/dev/null

URL="postgresql://postgres@127.0.0.1:$PORT/$BASE"
psql "postgresql://postgres@127.0.0.1:$PORT/postgres" \
  -v ON_ERROR_STOP=1 -q -c "CREATE DATABASE \"$BASE\";"

echo "Cluster prêt — port $PORT, base $BASE, journal $JOURNAL."
echo
echo "  export TEST_DATABASE_URL='$URL'"
echo "  pnpm test:isolation"
