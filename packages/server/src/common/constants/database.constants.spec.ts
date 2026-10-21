import { withSessionSqlMode } from './database.constants';

describe('withSessionSqlMode', () => {
  const originalSqlMode = process.env.DB_SQL_MODE;

  afterEach(() => {
    if (originalSqlMode === undefined) {
      delete process.env.DB_SQL_MODE;
    } else {
      process.env.DB_SQL_MODE = originalSqlMode;
    }
  });

  it('returns the pool unchanged without DB_SQL_MODE', () => {
    delete process.env.DB_SQL_MODE;
    const pool = { min: 0, max: 7 };

    expect(withSessionSqlMode(pool)).toBe(pool);
  });

  it('sets the session sql_mode on each new connection', () => {
    process.env.DB_SQL_MODE = 'STRICT_TRANS_TABLES';
    const pool = withSessionSqlMode({ min: 0, max: 7 }) as any;
    const connection = {
      query: jest.fn((_sql, _bindings, callback) => callback(null)),
    };
    const done = jest.fn();

    pool.afterCreate(connection, done);

    expect(pool.min).toBe(0);
    expect(connection.query).toHaveBeenCalledWith(
      'SET SESSION sql_mode = ?',
      ['STRICT_TRANS_TABLES'],
      expect.any(Function),
    );
    expect(done).toHaveBeenCalledWith(null, connection);
  });
});
