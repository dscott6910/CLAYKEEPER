# ClayKeeper Backup and Recovery

This guide covers the practical backup layers for ClayKeeper production.

## What is already protected

ClayKeeper has several backup and rollback layers:

- GitHub stores the application source code history.
- `deploy.sh` backs up the currently deployed website build before publishing a new build.
- `snapshot.sh` creates a portable source-code snapshot without `node_modules`, build output, logs, or frontend `.env` files.
- `restore.sh` can safely inspect or apply a source-code snapshot.

Those layers protect the application files. They do not replace a production database backup.

## What must be backed up separately

The Supabase database contains the live ClayKeeper records, including organizations, users, participants, events, registrations, scores, payments, squadding, imports, and other production data.

Migrations can rebuild database structure, but migrations do not restore live production data.

## Recommended routine

Run a production backup before:

- applying database migrations;
- importing large ActiveNet files;
- deleting or merging records;
- changing role/security policies;
- making a major release;
- doing any manual production database edits.

On the production server:

```bash
cd ~/apps/CLAYKEEPER
./backup-production.sh
```

For non-interactive use:

```bash
cd ~/apps/CLAYKEEPER
./backup-production.sh --yes
```

The backup folder is created under:

```text
~/CODEX/Backups/ClayKeeper/
```

Each run creates a timestamped folder containing:

- `schema.sql`
- `data.sql`
- `roles.sql` when available
- checksum files
- `manifest.txt`
- a log pointing to the source-code snapshot

## Important security note

Database backups contain real production data. Treat these files like private records.

Do not commit backup files to GitHub.

Do not email backup files unless they are encrypted.

Keep downloaded copies in a private, access-controlled location.

## Supabase dashboard backups

Also check Supabase dashboard backups:

1. Open the ClayKeeper Supabase project.
2. Go to **Database**.
3. Open **Backups**.
4. Confirm whether daily backups are available for the current plan.

Supabase paid plans include daily database backups. Point-in-Time Recovery is a paid add-on for finer-grained restore points.

For Free projects, keep regular manual exports with `backup-production.sh`.

## Restore strategy

Use the least invasive restore path that solves the problem.

### Restore application code only

If a deployment or code change is bad but the database is fine:

```bash
cd ~/apps/CLAYKEEPER
./restore.sh ~/CODEX/Snapshots/ClayKeeper_YYYYMMDD_HHMMSS_server.tar.gz
```

That default command extracts the snapshot safely without changing production.

Only use `--apply` after confirming the snapshot is the one you want:

```bash
cd ~/apps/CLAYKEEPER
./restore.sh --apply ~/CODEX/Snapshots/ClayKeeper_YYYYMMDD_HHMMSS_server.tar.gz
```

### Restore the deployed website build

`deploy.sh` automatically creates deployment rollback archives in:

```text
~/deployment-backups/
```

If a deployment verification fails, `deploy.sh` attempts to restore the previous deployed build automatically.

### Restore database data

Database restores should be handled carefully.

Preferred approach:

1. Use Supabase **Database → Backups** if a dashboard restore point exists.
2. For manual SQL exports, first restore to a separate test Supabase project.
3. Verify the data before touching production.
4. Plan downtime before restoring production.

Do not run a manual production database restore casually. A restore can overwrite newer production records.

## Quick backup check

After a backup, verify the files exist:

```bash
ls -lh ~/CODEX/Backups/ClayKeeper
```

To inspect the latest backup folder:

```bash
latest="$(find ~/CODEX/Backups/ClayKeeper -mindepth 1 -maxdepth 1 -type d | sort | tail -n 1)"
echo "$latest"
ls -lh "$latest"
```

If checksum files are present, keep them with the backup files.
