#!/bin/sh
set -eu
umask 077
# Invoke from the genesis directory. Creates a new archive; never overwrites one.
backup_dir=${1:-./backups}
mkdir -p "$backup_dir"
archive="$backup_dir/genesis-$(date -u +%Y%m%dT%H%M%SZ).archive.gz"
(set -C; docker compose -f compose.production.yml exec -T mongo mongodump --db genesis --archive --gzip > "$archive")
printf 'Database archive saved to %s\n' "$archive"
printf 'Also back up MinIO artifacts and the secret/encryption-key configuration separately.\n'
