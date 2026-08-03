import { loginAction } from "./actions";
import { Button } from "@/components/ui/Button";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white font-bold text-lg mb-4">
            PC
          </div>
          <h1 className="text-2xl font-semibold text-white">VKTR-PriceCore</h1>
          <p className="text-sm text-slate-400 mt-1">
            Enterprise Smart Pricing &amp; Decision Support System
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur p-6">
          <form action={loginAction} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Email
              </label>
              <input
                type="email"
                name="email"
                required
                placeholder="nama@vktr.co.id"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Password
              </label>
              <input
                type="password"
                name="password"
                required
                placeholder="••••••••"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-blue-500"
              />
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" size="lg">
              Masuk
            </Button>
          </form>

          <p className="text-[11px] text-slate-500 mt-5 leading-relaxed">
            POC demo — gunakan salah satu akun seed (lihat README §Demo
            Accounts) untuk mencoba peran Procurement, Engineering, Finance,
            Sales, C-Level, atau Admin.
          </p>
        </div>
      </div>
    </div>
  );
}
