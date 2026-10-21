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

## 6. Server e2e tests

The suite signs in as `kk@kk.com` / `1231231230`, so create that user once
through the running API (`POST /api/auth/signup`, then
`POST /api/organization/build`; see `e2e/_auth.ts` for the payloads). Then:

```bash
cd packages/server
NODE_OPTIONS=--max-old-space-size=8192 pnpm run test:e2e
```

Without the larger heap, ts-jest runs out of memory when the second spec
file boots the app.
