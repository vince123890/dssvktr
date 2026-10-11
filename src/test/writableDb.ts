/**
 * Small in-memory stand-in for the Supabase query builder that also
 * WRITES (insert / update / delete), so engine functions that change
 * state can be unit tested without a database. It models only what the
 * engine uses: eq / in / is filters, select + order + limit, and
 * awaiting the builder (or maybeSingle / single). Not a SQL engine —
 * constraints, defaults and RLS are out of scope.
 */
type Row = Record<string, unknown>;
export type Tables = Record<string, Row[]>;

export function writableDb(tables: Tables) {
  let nextId = 1;
  return {
    tables,
    from(table: string) {
      tables[table] ??= [];
      const filters: ((r: Row) => boolean)[] = [];
      let op: "select" | "update" | "delete" | "insert" = "select";
      let patch: Row = {};
      let inserted: Row[] = [];
      let order: { col: string; dir: 1 | -1 } | null = null;
      let max = Infinity;

      const matches = () => tables[table].filter((r) => filters.every((f) => f(r)));

      const run = () => {
        if (op === "insert") {
          tables[table].push(...inserted);
          return { data: inserted, error: null };
        }
        const hit = matches();
        if (op === "update") {
          hit.forEach((r) => Object.assign(r, patch));
          return { data: hit, error: null };
        }
        if (op === "delete") {
          tables[table] = tables[table].filter((r) => !hit.includes(r));
          return { data: hit, error: null };
        }
        let out = [...hit];
        if (order) {
          const { col, dir } = order;
          out = out.sort((a, b) => (String(a[col]) < String(b[col]) ? -dir : String(a[col]) > String(b[col]) ? dir : 0));
        }
        return { data: out.slice(0, max), error: null };
      };

      const q = {
        select: () => q,
        insert(rows: Row | Row[]) {
          op = "insert";
          inserted = (Array.isArray(rows) ? rows : [rows]).map((r) => ({ id: `gen-${nextId++}`, ...r }));
          return q;
        },
        update(p: Row) {
          op = "update";
          patch = p;
          return q;
        },
        delete() {
          op = "delete";
          return q;
        },
        eq(col: string, v: unknown) {
          filters.push((r) => r[col] === v);
          return q;
        },
        in(col: string, vs: unknown[]) {
          filters.push((r) => vs.includes(r[col]));
          return q;
        },
        is(col: string, v: unknown) {
          filters.push((r) => (r[col] ?? null) === v);
          return q;
        },
        order(col: string, opts?: { ascending?: boolean }) {
          order = { col, dir: opts?.ascending === false ? -1 : 1 };
          return q;
        },
        limit(n: number) {
          max = n;
          return q;
        },
        maybeSingle: async () => ({ data: (run().data as Row[])[0] ?? null, error: null }),
        single: async () => ({ data: (run().data as Row[])[0] ?? null, error: null }),
        then: (resolve: (v: { data: Row[]; error: null }) => unknown) => resolve(run() as { data: Row[]; error: null }),
      };
      return q;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}
