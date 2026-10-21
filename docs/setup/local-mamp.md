# Local development with MAMP (no Docker)

This is an alternative to the `docker compose` setup in `AGENTS.md`. It uses
MAMP's MySQL 5.7 and Redis. MySQL 5.7 is close enough to the MariaDB 10.2
image that Bigcapital ships with.

## 1. Node 18 and pnpm

The project needs Node 18.16.1. Homebrew's `node` comes earlier on `PATH`
than nvm's, so `nvm use` alone doesn't take effect. Put nvm's Node first:

```bash
export PATH=$HOME/.nvm/versions/node/v18.16.1/bin:$PATH
node -v          # v18.16.1
npm i -g pnpm@9  # the lockfile is v9
```

## 2. Start MySQL and Redis in MAMP

Start both in MAMP PRO, then note the MySQL port (MAMP PRO → MySQL). It is
usually `3306` in MAMP PRO and `8889` in plain MAMP. Redis listens on `6379`.
On the reference machine: MySQL 5.7.39 on `127.0.0.1:3306`, root/root.

MAMP's default `sql_mode` includes `ONLY_FULL_GROUP_BY`, which MariaDB 10.2
(Bigcapital's reference database) doesn't enable. Some upstream queries fail
under it with `ER_MIX_OF_GROUP_FUNC_AND_FIELDS`, e.g.
`GET /api/banking/accounts/:id/summary`. Rather than change the global
`sql_mode` that other MAMP apps share, set `DB_SQL_MODE` in `.env` (step 4).
Bigcapital then applies it to its own connections only.

## 3. Create the database user

Bigcapital creates a new database for every organization, so its user needs
global privileges:

```bash
/Applications/MAMP/Library/bin/mysql -uroot -proot -h127.0.0.1 -P<port> <<'SQL'
CREATE USER IF NOT EXISTS 'bigcapital'@'localhost' IDENTIFIED BY 'bigcapital';
CREATE USER IF NOT EXISTS 'bigcapital'@'127.0.0.1' IDENTIFIED BY 'bigcapital';
GRANT ALL PRIVILEGES ON *.* TO 'bigcapital'@'localhost' WITH GRANT OPTION;
GRANT ALL PRIVILEGES ON *.* TO 'bigcapital'@'127.0.0.1' WITH GRANT OPTION;
CREATE DATABASE IF NOT EXISTS bigcapital_system CHARACTER SET utf8 COLLATE utf8_general_ci;
FLUSH PRIVILEGES;
SQL
```

## 4. `.env`

Copy `.env.example` to `.env` at the repo root, then set:

```dotenv
DB_HOST=127.0.0.1
DB_PORT=<port>   # 3306 on MAMP PRO
DB_USER=bigcapital
DB_PASSWORD=bigcapital
SYSTEM_DB_NAME=bigcapital_system
REDIS_HOST=127.0.0.1
QUEUE_HOST=127.0.0.1
# MariaDB 10.2 defaults: drops ONLY_FULL_GROUP_BY for Bigcapital's connections only
DB_SQL_MODE=STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION
APP_JWT_SECRET=<openssl rand -hex 32>
# Optional: hide modules a sole trader doesn't use
HIDDEN_MODULES=stripe,subscription,workspaces
```

There is no Gotenberg (PDF rendering) or Garage (S3 file storage) without
Docker. PDF downloads and attachments fail until those run. Everything else
works.

## 5. Migrate and run

```bash
pnpm run build:server
pnpm run system:migrate:latest
pnpm run dev:server   # :3000
pnpm run dev:webapp   # :4000
```

## 6. Tenant migrations

Organizations built by the running server record their migrations as the
compiled `.js` files, so run tenant migrations from the build:

```bash
pnpm run build:server
node packages/server/dist/cli.js tenants:migrate:latest
```

`pnpm run tenants:migrate:latest` uses ts-node. It sees only the `.ts`
sources and fails with "The migration directory is corrupt".

## 7. Server e2e tests

The suites sign in as pre-built users. Create both once through the running
API (`POST /api/auth/signup`, then `POST /api/organization/build`; see
`e2e/_auth.ts` for the payloads):

| User | Password | Organization |
|---|---|---|
| `kk@kk.com` | `1231231230` | `location: "US"`, `base_currency: "USD"` (shared by most suites) |
| `jm@example.com` | `1231231230` | `location: "JM"`, `base_currency: "JMD"` (Jamaica suite; the setup runs on build). Override with `E2E_JM_EMAIL` / `E2E_JM_PASSWORD`. |

Organizations can't be built inside the e2e app itself: it runs from the
TypeScript sources, where tenant migrations don't load. Then:

```bash
cd packages/server
NODE_OPTIONS=--max-old-space-size=8192 pnpm run test:e2e
```

Without the larger heap, ts-jest runs out of memory when the second spec
file boots the app.

To run one suite, add `--forceExit`. Without it, Jest prints the results
and then waits forever on open Redis and queue handles:

```bash
NODE_OPTIONS=--max-old-space-size=8192 npx jest --config ./test/jest-e2e.json \
  test/jamaica-gct.e2e-spec.ts --forceExit
```

### Without MAMP (Docker)

The M2 run used MariaDB 10.6 and Redis 7 containers instead:

```bash
docker run -d --name bc-mariadb -e MARIADB_ROOT_PASSWORD=root -p 3306:3306 mariadb:10.6
docker run -d --name bc-redis -p 6379:6379 redis:7
docker exec bc-mariadb mariadb -uroot -proot -e "CREATE USER 'bigcapital'@'%' IDENTIFIED BY 'bigcapital'; GRANT ALL PRIVILEGES ON *.* TO 'bigcapital'@'%' WITH GRANT OPTION; CREATE DATABASE bigcapital_system CHARACTER SET utf8 COLLATE utf8_general_ci;"
```

Then use `DB_HOST=127.0.0.1` in `.env`, leave `DB_SQL_MODE` unset, and follow
steps 5 to 7. MariaDB returns booleans as `1`/`0`, so assert them with
`toBeTruthy()` rather than `toBe(true)`.

## Known local issues

- **No mail server:** a queued mail job (signup confirmation, invoice email)
  that can't reach SMTP raises an unhandled rejection, which **crashes the
  API process** (upstream). Restart the server, or point the `MAIL_*`
  settings at a local catcher such as Mailpit.
- **ClickHouse:** the analytics sync logs `ECONNREFUSED ::1:8123` errors
  even with `CLICKHOUSE_ENABLED=false`. They're noise and don't fail requests.
