/**
 * Minimal in-memory stand-in for the Supabase query builder, enough for
 * the read paths the pure-logic tests exercise: select / eq / in / lte
 * / order / limit / maybeSingle / single, awaited as a thenable.
 */
type Row = Record<string, unknown>;

export function fakeDb(tables: Record<string, Row[]>) {
  return {
    from(table: string) {
      let rows = [...(tables[table] ?? [])];
      const q = {
        select: () => q,
        eq(col: string, v: unknown) {
          rows = rows.filter((r) => r[col] === v);
          return q;
        },
        in(col: string, vs: unknown[]) {
          rows = rows.filter((r) => vs.includes(r[col]));
          return q;
        },
        lte(col: string, v: string) {
          rows = rows.filter((r) => String(r[col]) <= v);
          return q;
        },
        order(col: string, opts?: { ascending?: boolean }) {
          const dir = opts?.ascending === false ? -1 : 1;
          rows.sort((a, b) => (String(a[col]) < String(b[col]) ? -dir : String(a[col]) > String(b[col]) ? dir : 0));
          return q;
        },
        limit(n: number) {
          rows = rows.slice(0, n);
          return q;
        },
        maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
        single: async () => ({ data: rows[0] ?? null, error: null }),
        then: (resolve: (v: { data: Row[]; error: null }) => unknown) => resolve({ data: rows, error: null }),
      };
      return q;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}
