import { normalizeDatabaseSslMode } from './prisma.service';

describe('normalizeDatabaseSslMode', () => {
  it.each(['prefer', 'require', 'verify-ca'])(
    'uses the current strict SSL behavior for the legacy %s mode',
    (sslMode) => {
      expect(
        normalizeDatabaseSslMode(
          `postgresql://user:password@db.example.com/app?sslmode=${sslMode}&connect_timeout=10`,
        ),
      ).toBe(
        'postgresql://user:password@db.example.com/app?sslmode=verify-full&connect_timeout=10',
      );
    },
  );

  it('leaves explicit verify-full and URLs without sslmode unchanged', () => {
    const strictUrl = 'postgresql://user:password@db.example.com/app?sslmode=verify-full';
    const defaultUrl = 'postgresql://user:password@db.example.com/app';

    expect(normalizeDatabaseSslMode(strictUrl)).toBe(strictUrl);
    expect(normalizeDatabaseSslMode(defaultUrl)).toBe(defaultUrl);
  });
});
