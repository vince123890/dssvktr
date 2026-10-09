# Tasks: unit-tests-pure-logic

## 1. Setup
- [x] 1.1 Install vitest (devDependency), tambah `vitest.config.ts` (alias @) dan script `npm test`
- [x] 1.2 Tes smoke: satu tes dummy lulus lewat `npm test`

## 2. pricing-engine (tinggi)
- [x] 2.1 computeCostStructure: contoh hitung, CNY, item nonaktif/turunan, excluded, tanpa nilai, profitability nominal CNY
- [x] 2.2 normalizeDiscount dan computeLine: kedua mode, list nol, negatif, contoh dengan diskon, harga di bawah sales cost
- [x] 2.3 aggregateGm, resolveTier (batas tepat, di bawah semua), resolveBand, strictestMode
- [x] 2.4 toBaseCurrency/fromBaseCurrency dan resolveExchangeRate (fake)

## 3. cost-structure (tinggi)
- [x] 3.1 scenarioFor / versionScenario
- [x] 3.2 canPerformScopeAction dengan fake: tanpa role, tanpa wewenang, maker=checker ditolak, pemegang tunggal diizinkan, aturan default

## 4. workflow-template-catalog (menengah)
- [x] 4.1 resolveTemplate: spesifik, prioritas vs kespesifikan, seri, fallback, tanpa fallback, qualifier null; isBlacklisted

## 5. master-data-and-rates (menengah)
- [x] 5.1 computeHpm, isIndexStale, indexAgeDays, mineralAdjustmentFactor selalu 1

## 6. access-control (tinggi)
- [x] 6.1 hasFunction/hasAnyFunction, role nonaktif, actorFillsSlot (fungsi vs role:), canViewQuotation, landingHref, allowedMenus

## 7. Housekeeping
- [x] 7.1 Update sdd/config.md (perintah tes) dan README
- [x] 7.2 `npm test` dan `npm run lint` bersih
