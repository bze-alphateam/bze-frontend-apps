#!/usr/bin/env bash
# Decide which apps docker-publish builds and deploys for the checked-out commit.
#
# An app is (re)deployed when its image would differ from the one that is live
# on its deploy target. The base for that comparison is NOT the previous push:
# a failed deploy, a queued run GitHub dropped or a force push would leave an
# app behind silently. It is the commit each app's target is actually running,
# read from the deploy repo's last successful `deploy <dir> <tag>` run (the tag
# is the commit's sha8). A manual rollback there is the live commit too.
#
# For each app, with LIVE = that commit:
#   - no successful deploy found, LIVE unknown here or not an ancestor of HEAD
#       -> deploy
#   - any changed path (LIVE..HEAD) outside apps/ and packages/ that is not on
#     the harmless list below (Dockerfile, .dockerignore, root package.json,
#     pnpm-workspace.yaml overrides, .npmrc, this script, the workflow, any new
#     root file...) -> deploy every app; turbo does not see these
#   - otherwise -> deploy when turbo counts the app as affected since LIVE
#     (follows workspace deps: a packages/ui-kit change affects every app; it
#     is lockfile-aware, so a pnpm-lock.yaml change only hits the importers
#     whose resolved deps changed)
# Anything unexpected (lookup failure, unparseable output) -> deploy all.
#
# Env:
#   APPS          space-separated <app dir>:<package name> pairs (the matrix)
#   FLAVOR        mainnet | testnet (testnet deploy dirs get a testnet- prefix)
#   DEPLOY_REPO   owner/name of the deploy repo
#   GH_TOKEN      token with Actions: read on DEPLOY_REPO
#   ONLY          optional: "all" or a comma/space list of app dirs; skips the
#                 detection and selects exactly those (manual dispatch)
# Output: `matrix=<json array of {app,pkg}>` to $GITHUB_OUTPUT (stdout when
# unset) and a decision table to $GITHUB_STEP_SUMMARY (stderr when unset).
#
# This repo is public: print app names, tags and paths only, never anything
# else from the deploy repo.
set -euo pipefail

: "${APPS:?}" "${FLAVOR:?}" "${DEPLOY_REPO:?}"
OUT="${GITHUB_OUTPUT:-/dev/stdout}"
SUMMARY="${GITHUB_STEP_SUMMARY:-/dev/stderr}"

# Changed paths outside apps/ and packages/ that cannot change an image.
harmless() {
  case "$1" in
    README.md | .gitignore | .graphifyignore) return 0 ;;
    .github/scripts/changed-apps.sh | .github/workflows/docker-publish.yml) return 1 ;;
    .github/*) return 0 ;;
    *) return 1 ;;
  esac
}

declare -A PKG REASON
ORDER=()
for pair in $APPS; do
  app="${pair%%:*}"
  PKG[$app]="${pair#*:}"
  ORDER+=("$app")
done

selected=()
emit() {
  local json
  json=$(for app in "${selected[@]}"; do
    jq -nc --arg app "$app" --arg pkg "${PKG[$app]}" '{app: $app, pkg: $pkg}'
  done | jq -sc '.')
  echo "matrix=$json" >> "$OUT"
  {
    echo "### Apps to build and deploy ($FLAVOR)"
    echo
    echo "| app | decision |"
    echo "|---|---|"
    for app in "${ORDER[@]}"; do echo "| $app | ${REASON[$app]} |"; done
  } >> "$SUMMARY"
}

all() {
  selected=("${ORDER[@]}")
  for app in "${ORDER[@]}"; do REASON[$app]="deploy: $1"; done
  emit
  exit 0
}

if [[ -n "${ONLY:-}" ]]; then
  [[ "$ONLY" == "all" ]] && all "selected by hand (all)"
  for app in ${ONLY//,/ }; do
    [[ -n "${PKG[$app]:-}" ]] || { echo "::error::unknown app '$app' (known: ${ORDER[*]})"; exit 1; }
  done
  for app in "${ORDER[@]}"; do
    if [[ " ${ONLY//,/ } " == *" $app "* ]]; then
      selected+=("$app"); REASON[$app]="deploy: selected by hand"
    else
      REASON[$app]="skip: not selected"
    fi
  done
  emit
  exit 0
fi

head=$(git rev-parse HEAD)
prefix=""; [[ "$FLAVOR" == "testnet" ]] && prefix="testnet-"

# Successful deploy runs, newest first. The deploy workflow's run-name is
# `deploy <dir> <tag>`; its concurrency group serialises runs per dir, so the
# newest successful one is what the target runs now.
if ! titles=$(gh run list -R "$DEPLOY_REPO" --workflow deploy.yml --status success \
      -L 1000 --json displayTitle --jq '.[].displayTitle' 2>/dev/null); then
  echo "::warning::could not list the deploy repo's runs, deploying every app"
  all "live commit lookup failed"
fi

turbo_version=$(sed -n '/^  \.:$/,/^$/p' pnpm-lock.yaml | awk '/^ +turbo:/ {t=1} t && /version:/ {print $2; exit}')
if [[ -z "$turbo_version" ]]; then
  echo "::warning::turbo version not found in pnpm-lock.yaml, deploying every app"
  all "turbo version unknown"
fi

# Sets AFF to " pkg pkg ... ", the packages turbo counts as affected since $1.
# Cached per base: apps released together share one turbo run.
declare -A AFFECTED
affected() {
  local base="$1" json names
  if [[ -z "${AFFECTED[$base]+x}" ]]; then
    json=$(TURBO_SCM_BASE="$base" TURBO_SCM_HEAD="$head" TURBO_TELEMETRY_DISABLED=1 \
      npx --yes "turbo@$turbo_version" ls --affected --output=json 2>/dev/null) || return 1
    names=$(jq -r '.packages.items | if type == "array" then .[].name else error("no items") end' <<<"$json" 2>/dev/null) || return 1
    AFFECTED[$base]=" $(tr '\n' ' ' <<<"$names") "
  fi
  AFF="${AFFECTED[$base]}"
}

for app in "${ORDER[@]}"; do
  dir="${prefix}${app}.getbze.com"
  tag=$(grep -m1 -E "^deploy ${dir//./\\.} ${prefix}[0-9a-f]{8}\$" <<<"$titles" | awk '{print $3}' || true)
  if [[ -z "$tag" ]]; then
    selected+=("$app"); REASON[$app]="deploy: no successful deploy found"; continue
  fi
  short="${tag#"$prefix"}"
  if ! live=$(git rev-parse --verify --quiet "${short}^{commit}") \
     || ! git merge-base --is-ancestor "$live" "$head"; then
    selected+=("$app"); REASON[$app]="deploy: live \`$tag\` is not an ancestor of HEAD"; continue
  fi
  if [[ "$live" == "$head" ]]; then
    REASON[$app]="skip: \`$tag\` (this commit) is already live"; continue
  fi

  global=""
  while IFS= read -r path; do
    case "$path" in apps/* | packages/* | pnpm-lock.yaml) continue ;; esac
    harmless "$path" || { global="$path"; break; }
  done < <(git diff --name-only "$live" "$head")
  if [[ -n "$global" ]]; then
    selected+=("$app"); REASON[$app]="deploy: \`$global\` changed since live \`$tag\`"; continue
  fi

  if ! affected "$live"; then
    echo "::warning::turbo ls --affected failed, deploying every app"
    all "turbo affected lookup failed"
  fi
  if [[ "$AFF" == *" ${PKG[$app]} "* ]]; then
    selected+=("$app"); REASON[$app]="deploy: changed since live \`$tag\`"
  else
    REASON[$app]="skip: unchanged since live \`$tag\`"
  fi
done

emit
