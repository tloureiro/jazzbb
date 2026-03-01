#!/usr/bin/env bash

set -euo pipefail

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
warn() { printf '\033[33m%s\033[0m\n' "$*"; }
error() { printf '\033[31m%s\033[0m\n' "$*"; }

if ! command -v git >/dev/null 2>&1; then
  error "git is required but not found in PATH."
  exit 1
fi

if ! command -v wrangler >/dev/null 2>&1; then
  error "wrangler CLI is required (install with 'npm install -g wrangler')."
  exit 1
fi

current_branch="$(git rev-parse --abbrev-ref HEAD)"

bold "Installing dependencies..."
npm install

latest_tag="$(git tag --sort=-version:refname | head -n1 || true)"
if [[ -z "${latest_tag}" ]]; then
  latest_tag="0.0.0"
fi

bold "Latest tag: ${latest_tag}"

suggested_tag=""
if [[ "${latest_tag}" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
  major="${BASH_REMATCH[1]}"
  minor="${BASH_REMATCH[2]}"
  patch="${BASH_REMATCH[3]}"
  suggested_tag="${major}.${minor}.$((patch + 1))"
else
  warn "Latest tag '${latest_tag}' is not semantic; enter the next tag manually."
fi

if [[ -n "${suggested_tag}" ]]; then
  read -rp "Next tag [${suggested_tag}]: " new_tag
  new_tag="${new_tag:-$suggested_tag}"
else
  read -rp "Next tag: " new_tag
fi

if [[ -z "${new_tag}" ]]; then
  error "Tag cannot be empty."
  exit 1
fi

if [[ ! "${new_tag}" =~ ^[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$ ]]; then
  error "Tag '${new_tag}' is not a valid semantic version (expected e.g. 0.5.2)."
  exit 1
fi

if git rev-parse -q --verify "refs/tags/${new_tag}" >/dev/null; then
  error "Tag '${new_tag}' already exists."
  exit 1
fi

bold "About to release '${new_tag}' (previous latest was '${latest_tag}')."
read -rp "Proceed? [y/N] " confirm_tag
if [[ ! "$confirm_tag" =~ ^[Yy]$ ]]; then
  error "Release aborted."
  exit 1
fi

current_version="$(node -p "require('./package.json').version")"
if [[ "${current_version}" != "${new_tag}" ]]; then
  bold "Updating package version ${current_version} -> ${new_tag}..."
  npm version "${new_tag}" --no-git-tag-version
else
  warn "package.json version already set to ${new_tag}; skipping version update."
fi

bold "Building project..."
npm run build

bold "Current branch: ${current_branch}"
bold "Pending changes:"
git status -sb

if git diff --quiet && git diff --cached --quiet; then
  warn "No changes detected."
else
  read -rp "Stage all changes shown above? [y/N] " confirm_stage
  if [[ "$confirm_stage" =~ ^[Yy]$ ]]; then
    git add -A
    bold "Staged changes:"
    git status -sb
  else
    error "Aborting: nothing staged."
    exit 1
  fi
fi

if git diff --cached --quiet; then
  warn "No staged changes to commit."
else
  read -rp "Commit message: " commit_message
  if [[ -z "${commit_message}" ]]; then
    error "Commit message cannot be empty."
    exit 1
  fi
  git commit -m "${commit_message}"
fi

git push origin "${current_branch}"

read -rp "Tag description (optional, single line): " tag_description

tmpfile="$(mktemp "${TMPDIR:-/tmp}/jazzbb-release-notes.XXXXXX")"
cleanup_tmp() { rm -f "$tmpfile"; }
trap cleanup_tmp EXIT
printf "# Release notes for %s\n# Remove lines beginning with #. Save & close when done.\n\n" "${new_tag}" > "$tmpfile"

editor_cmd="${EDITOR:-nano}"
bold "Opening ${editor_cmd} for release notes..."
"${editor_cmd}" "$tmpfile"

release_notes=""
if [[ -s "$tmpfile" ]]; then
  release_notes=$(sed '/^[[:space:]]*#/d' "$tmpfile")
  if [[ -z $(printf '%s' "$release_notes" | sed '/^[[:space:]]*$/d') ]]; then
    release_notes=""
  fi
fi
cleanup_tmp
trap - EXIT

tag_args=(-a "${new_tag}" -m "${new_tag}")
if [[ -n "${tag_description}" ]]; then
  tag_args+=(-m "${tag_description}")
fi

if [[ -n "${release_notes}" ]]; then
  tag_args+=(-m "${release_notes}")
fi

git tag "${tag_args[@]}"
git push origin "${new_tag}"

bold "Deploying to Cloudflare Pages..."
wrangler pages deploy ./dist/ --project-name=jazzbb

bold "Deployment finished."
