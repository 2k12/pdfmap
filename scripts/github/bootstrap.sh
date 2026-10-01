#!/usr/bin/env bash
# Inicializa un repositorio de GitHub EXISTENTE con etiquetas, hitos e issues por requisito.
# Idempotente: actualiza etiquetas existentes y no duplica hitos ni issues.
#
# Uso:  scripts/github/bootstrap.sh [owner/repo] [--dry-run]
# Requiere: gh autenticado (gh auth status).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LABELS_FILE="$ROOT/.github/labels.yml"
REQS_FILE="$ROOT/scripts/github/requirements.tsv"

REPO=""
DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    *) REPO="$arg" ;;
  esac
done
if [[ -z "$REPO" ]]; then
  REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
fi
echo "Repositorio: $REPO"

run() {
  if [[ $DRY_RUN -eq 1 ]]; then echo "[dry-run] $*"; else "$@"; fi
}

# 1. Etiquetas ------------------------------------------------------------------------
echo "== Etiquetas =="
name=""; color=""; desc=""
flush_label() {
  if [[ -n "$name" ]]; then
    run gh label create "$name" --repo "$REPO" --color "$color" --description "$desc" --force >/dev/null
    echo "  ✓ $name"
  fi
  name=""; color=""; desc=""
}
while IFS= read -r line; do
  case "$line" in
    "- name: "*) flush_label; name="${line#- name: }" ;;
    "  color: "*) color="${line#  color: }"; color="${color//\"/}" ;;
    "  description: "*) desc="${line#  description: }" ;;
  esac
done < "$LABELS_FILE"
flush_label

# 2. Hitos ----------------------------------------------------------------------------
echo "== Hitos =="
existing_ms="$(gh api "repos/$REPO/milestones?state=all&per_page=100" --jq '.[].title' || true)"
create_ms() {
  local title="$1" description="$2"
  if grep -Fxq "$title" <<<"$existing_ms"; then
    echo "  = $title (ya existe)"
  else
    run gh api "repos/$REPO/milestones" -f title="$title" -f description="$description" >/dev/null
    echo "  ✓ $title"
  fi
}
create_ms "v0.1 MVP extracción" "Carga pesada, extracción y procesamiento en segundo plano (RF-01..05, RF-14)"
create_ms "v0.2 Mapeo visual"   "Reglas, campos, tipos y acciones (RF-06..10)"
create_ms "v0.3 Diseño Excel"   "Columnas, vista previa, plantillas, exportación y cuadre (RF-11..13, RF-15, RF-16)"
create_ms "v1.0 Release"        "Resultados paginados, borrado y RNF-01..09"

# 3. Issues por requisito ----------------------------------------------------------------
echo "== Issues de requisitos =="
existing_issues="$(gh issue list --repo "$REPO" --state all --limit 1000 --json title --jq '.[].title' || true)"
tail -n +2 "$REQS_FILE" | while IFS=$'\t' read -r id title priority milestone area anchor; do
  issue_title="[$id] $title"
  if grep -Fq "[$id]" <<<"$existing_issues"; then
    echo "  = $issue_title (ya existe)"
    continue
  fi
  body="## Requisito $id

$title

- Especificación: [SRS §3](../blob/main/docs/01-requisitos/SRS-IEEE-830.md#$anchor)
- Casos de prueba y trazabilidad: [RTM](../blob/main/docs/04-testing/matriz-trazabilidad-RTM.md)

### Definition of Done
- [ ] Criterios de aceptación del SRS implementados
- [ ] Tests marcados con \`@pytest.mark.req(\"$id\")\` / \`[$id]\`
- [ ] RTM y documentación actualizadas
- [ ] CI verde y PR aprobado"
  run gh issue create --repo "$REPO" --title "$issue_title" --body "$body" \
    --label "type/requirement,priority/$priority,$area" --milestone "$milestone" >/dev/null
  echo "  ✓ $issue_title"
done

echo "Listo."
