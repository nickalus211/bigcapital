/**
 * MySQL/MariaDB decodes `DATE` columns into JS `Date` objects at the
 * connection's local midnight, which JSON serializes as a UTC instant
 * (`2026-08-31T00:00:00.000Z`) and shifts the calendar date on clients.
 *
 * Decoding `DATE` columns as `YYYY-MM-DD` strings keeps accounting dates as
 * date-only values, while `DATETIME`/`TIMESTAMP` columns (createdAt,
 * updatedAt, ...) keep returning `Date` objects with their time of day.
 *
 * The `mysql` driver supports the array form of `dateStrings`, but the knex
 * typings only declare the boolean form.
 */
export const DATE_ONLY_COLUMNS_OPTIONS = {
  dateStrings: ['DATE'] as unknown as boolean,
};

/**
 * Applies `DB_SQL_MODE` (when set) to every new connection of the pool, e.g.
 * to drop `ONLY_FULL_GROUP_BY` on a MySQL server shared with other apps.
 * Without the env the pool config is returned unchanged.
 */
export const withSessionSqlMode = <T extends object>(pool: T): T => {
  const sqlMode = process.env.DB_SQL_MODE;

  if (!sqlMode) return pool;

  return {
    ...pool,
    afterCreate: (connection, done) => {
      connection.query('SET SESSION sql_mode = ?', [sqlMode], (error) =>
        done(error, connection),
      );
    },
  };
};
