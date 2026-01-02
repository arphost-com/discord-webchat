#!/usr/bin/env bash
set -euo pipefail

strip_inline_comment() {
  local s="$1"
  local out=""
  local in_s=0
  local in_d=0
  local i ch
  for ((i=0; i<${#s}; i++)); do
    ch="${s:$i:1}"
    if [ "$ch" = "'" ] && [ $in_d -eq 0 ]; then in_s=$((1-in_s)); fi
    if [ "$ch" = '"' ] && [ $in_s -eq 0 ]; then in_d=$((1-in_d)); fi
    if [ "$ch" = "#" ] && [ $in_s -eq 0 ] && [ $in_d -eq 0 ]; then break; fi
    out+="$ch"
  done
  printf '%s' "$out"
}

load_env() {
  [ -f .env ] || return 0
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      ''|\#*) continue ;;
    esac
    line="${line#export }"
    case "$line" in
      *=*) ;;
      *) continue ;;
    esac
    local key="${line%%=*}"
    local val="${line#*=}"
    key="$(printf '%s' "$key" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
    val="$(strip_inline_comment "$val")"
    val="$(printf '%s' "$val" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
    if [ "${#val}" -ge 2 ]; then
      if [ "${val:0:1}" = '"' ] && [ "${val: -1}" = '"' ]; then
        val="${val:1:${#val}-2}"
      elif [ "${val:0:1}" = "'" ] && [ "${val: -1}" = "'" ]; then
        val="${val:1:${#val}-2}"
      fi
    fi
    export "${key}=${val}"
  done < .env
}

has_node() {
  command -v node >/dev/null 2>&1
}

run_node() {
  if has_node; then
    node "$@"
    return $?
  fi
  if command -v docker >/dev/null 2>&1; then
    docker run --rm -i \
      -e WIDGET_HMAC_SECRET="${WIDGET_HMAC_SECRET:-}" \
      node:20-alpine node "$@"
    return $?
  fi
  return 127
}
