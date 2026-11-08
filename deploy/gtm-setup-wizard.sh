#!/usr/bin/env bash
# Walk through GBP, Search Console, and Fosroc applicator setup.
# Run from repo root: bash deploy/gtm-setup-wizard.sh

set -euo pipefail

if [[ -t 1 ]] && command -v tput >/dev/null 2>&1 && [[ "$(tput colors 2>/dev/null || echo 0)" -ge 8 ]]; then
  BOLD=$(tput bold); DIM=$(tput dim); RESET=$(tput sgr0)
  BLUE=$(tput setaf 4); GREEN=$(tput setaf 2); YELLOW=$(tput setaf 3); RED=$(tput setaf 1)
else
  BOLD=""; DIM=""; RESET=""; BLUE=""; GREEN=""; YELLOW=""; RED=""
fi

TOTAL_STAGES=6
_STAGE_INDEX=0
ENV_FILE="${ENV_FILE:-deploy/gtm-track.env}"
WRITTEN_ENV=()
WRITTEN_SECRET=()
SKIPPED=()

_clear() {
  [[ -t 1 ]] || return 0
  if command -v tput >/dev/null 2>&1; then tput clear; else printf '\033[2J\033[3J\033[H'; fi
}

banner() {
  _clear
  printf '\n%s%s  %s%s\n' "$BOLD" "$BLUE" "$1" "$RESET"
  printf '%s  %s stages%s\n\n' "$DIM" "$TOTAL_STAGES" "$RESET"
  note "Site pre-check: run node deploy/verify-gtm.mjs (should pass 17/17)"
  note "Copy pack: deploy/gbp-action-pack.txt"
  pause "Ready to start?"
}

stage() {
  _clear
  _STAGE_INDEX=$((_STAGE_INDEX + 1))
  printf '\n%s%s▸ Stage %s/%s · %s%s\n' "$BOLD" "$BLUE" "$_STAGE_INDEX" "$TOTAL_STAGES" "$1" "$RESET"
}

say()  { printf '  %s\n' "$1"; }
step() { printf '  %s•%s %s\n' "$BLUE" "$RESET" "$1"; }
note() { printf '  %s%s%s\n' "$DIM" "$1" "$RESET"; }
warn() { printf '  %s⚠ %s%s\n' "$YELLOW" "$1" "$RESET"; }

open_url() {
  local url="$1"
  printf '  %s↗ opening%s %s\n' "$GREEN" "$RESET" "$url"
  { if command -v open >/dev/null 2>&1; then open "$url"
    elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$url"
    else warn "visit manually: $url"; fi
  } >/dev/null 2>&1 || warn "visit manually: $url"
}

pause() {
  printf '  %s%s%s ' "$DIM" "${1:-Press Enter to continue}" "$RESET"
  read -r _ || true
}

confirm() {
  local reply=""
  printf '  %s? %s [y/N] ' "$YELLOW" "$1"
  read -r reply || true
  [[ "$reply" =~ ^[Yy] ]]
}

_existing() {
  [[ -f "$ENV_FILE" ]] || return 1
  local line; line=$(grep -E "^${1}=" "$ENV_FILE" | tail -n1) || return 1
  printf '%s' "${line#*=}"
}

ask() {
  local key="$1" prompt="$2" current input
  current=$(_existing "$key" || true)
  if [[ -n "$current" ]]; then
    printf '  %s%s%s %s[Enter keeps current]%s ' "$BOLD" "$prompt" "$RESET" "$DIM" "$RESET"
  else
    printf '  %s%s%s ' "$BOLD" "$prompt" "$RESET"
  fi
  read -r input || true
  [[ -z "$input" && -n "$current" ]] && input="$current"
  printf -v "$key" '%s' "$input"
}

write_env() {
  local key="$1" value="$2" tmp
  touch "$ENV_FILE"
  tmp=$(mktemp)
  grep -vE "^${key}=" "$ENV_FILE" > "$tmp" || true
  printf '%s=%s\n' "$key" "$value" >> "$tmp"
  mv "$tmp" "$ENV_FILE"
  WRITTEN_ENV+=("$key")
  printf '  %s✓ wrote%s %s → %s\n' "$GREEN" "$RESET" "$key" "$ENV_FILE"
}

finish() {
  _clear
  printf '\n%s%s  ✓ GTM setup session complete%s\n' "$BOLD" "$GREEN" "$RESET"
  (( ${#WRITTEN_ENV[@]} )) && note "tracked in $ENV_FILE: ${WRITTEN_ENV[*]}"
  note "Update deploy/competitive-scoreboard.csv monthly"
  printf '\n'
}

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

banner "91SkylineWorks GTM setup (GBP + GSC + Fosroc)"

stage "GBP — categories"
say "Saved 2026-09-13: Primary Waterproofing Company · Secondary Structural engineer, General Contractor."
say "If re-editing: pick from autocomplete dropdown only — free-typed categories are rejected."
open_url "https://business.google.com/"
step "Select 91Skylineworks profile → Edit profile → Business category"
step "Primary: Waterproofing Company (select from dropdown)"
step "Secondary: Structural engineer, General Contractor"
pause "Categories saved?"
write_env GBP_CATEGORIES_UPDATED "$(date +%Y-%m-%d)"

stage "GBP — 7 services"
say "Copy service titles + descriptions from deploy/gbp-action-pack.txt"
open_url "https://business.google.com/"
step "Profile → Edit profile → Services → Add service (×7)"
step "Paste each service from the action pack (terrace, basement, bathroom, PU, cracks, retrofitting, NDT)"
pause "All 7 services added?"
write_env GBP_SERVICES_ADDED "$(date +%Y-%m-%d)"

stage "GBP — photos + first post"
say "Target 20+ photos. Use site portfolio + on-site phone photos."
open_url "https://business.google.com/"
step "Profile → Add photos (terrace, column repair, team, office)"
step "Profile → Add update → Week 1 post from gbp-action-pack.txt (48h inspection CTA)"
ask GBP_PHOTO_COUNT "How many photos are now on GBP?"
write_env GBP_PHOTO_COUNT "$GBP_PHOTO_COUNT"
write_env GBP_FIRST_POST "$(date +%Y-%m-%d)"

stage "GBP — review asks + citations"
say "WhatsApp template is in deploy/gbp-action-pack.txt"
step "Send review link to every completed job this week"
open_url "https://www.justdial.com/Guwahati"
step "Update JustDial listing with NAP from action pack"
open_url "https://www.sulekha.com/waterproofing-services/guwahati"
step "Update Sulekha listing"
open_url "https://www.indiamart.com/"
step "Update IndiaMART listing"
pause "Review asks sent and citations started?"
write_env GBP_CITATIONS_STARTED "$(date +%Y-%m-%d)"

stage "Search Console — sitemap + inspection"
open_url "https://search.google.com/search-console/sitemaps"
step "Submit: https://91skylineworks.com/sitemap.xml (expect ~85 URLs, no /as/)"
open_url "https://search.google.com/search-console/inspect"
step "URL inspect → /guwahati/waterproofing → Request indexing"
step "Repeat for /guwahati/building-crack-repair and /contact"
say "Performance tab: note baseline for waterproofing guwahati, building cracks guwahati, retrofitting guwahati"
ask GSC_BASELINE_NOTES "Paste any ranking notes (or 'no data yet'):"
write_env GSC_SITEMAP_SUBMITTED "$(date +%Y-%m-%d)"
write_env GSC_BASELINE_NOTES "$GSC_BASELINE_NOTES"

stage "Fosroc — start applicator application"
say "Guide: deploy/oem-applicator-guide.txt · Email template: deploy/oem-application-email.txt"
open_url "https://www.fosroc.com/india/"
step "Find NE regional contact or enquiry form"
step "Attach: company profile, 3 references (Beltola, Dispur, GS Road), portfolio link"
step "Ask for: Authorised applicator / applicator contractor — Guwahati"
pause "Fosroc application submitted?"
write_env FOSROC_APPLICATION_SUBMITTED "$(date +%Y-%m-%d)"

finish
