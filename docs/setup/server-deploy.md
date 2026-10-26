# Running this fork on a server (setup.sh)

Upstream's `setup.sh` downloads Bigcapital's own `docker/` folder and pulls the
official `bigcapitalhq/server` and `bigcapitalhq/webapp` images, so it never
runs this fork's code. Run from a checkout of this repository, `setup.sh` now
builds the images from the source instead
([`docker-compose.jamaica.yml`](../../docker-compose.jamaica.yml) is layered on
`docker-compose.prod.yml`):

| Action | Upstream install | Source checkout (this fork) |
|---|---|---|
| Install | Clone upstream's docker files, pull images | Keep `.env`, build server then webapp images |
| Start | Build, `up -d` | Build from source, `up -d`, remove the old Watchtower container |
| Upgrade | Re-download upstream | `git pull --ff-only`, rebuild |
| Auto-update (Watchtower) | Every hour | Off; it would replace the local build with upstream's images |

Both modes now wait for the server's health check (up to 5 minutes)
instead of a log line the server never prints, and never overwrite an
existing `.env`.

## Moving an existing upstream install over

Run these on the server. The first start runs the Jamaica migrations on your
data, so **back up the database first**.

1. Back up the database, from the old install folder while it runs:

   ```bash
   docker exec bigcapital-mysql sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --all-databases' > bigcapital-backup-$(date +%F).sql
   ```

2. Stop the old install, from its folder:

   ```bash
   ./setup.sh stop
   ```

3. Clone this fork next to it, and copy the old `.env` over:

   ```bash
   git clone -b develop git@github.com:nickalus211/bigcapital.git bigcapital-jamaica
   cp <old-install>/.env bigcapital-jamaica/.env
   ```

   The data volumes have fixed names in `docker-compose.prod.yml`
   (`bigcapital_prod_mysql`, `bigcapital_prod_redis`, ...), so the new
   containers use your existing data whatever the folder is called.

4. Optionally add `HIDDEN_MODULES=stripe,subscription,workspaces` to `.env`.

5. Build and start (the first build takes several minutes):

   ```bash
   cd bigcapital-jamaica
   ./setup.sh start
   ```

6. Log in. For a Jamaican organization, open Preferences → Features → turn on
   **Jamaica Localization**, then Preferences → Jamaica (GCT) → **Run setup**.
   New organizations built with location Jamaica run it automatically.

## Rolling back

Stop the fork (`./setup.sh stop` in its folder), restore the backup into the
MariaDB container, and start the old install again. The Jamaica migrations
only add tables and nullable columns, so upstream's code ignores them, but a
restore is the clean way back.
