import { Card, CardContent } from "@/components/ui/Card";

/** Landing for an account whose role grants no menu at all (e.g. a role without functions). */
export default function NoAccessPage() {
  return (
    <Card>
      <CardContent className="py-12 text-center text-sm text-muted">
        Role akun Anda belum memiliki akses ke menu mana pun. Hubungi System Admin untuk pengaturan role.
      </CardContent>
    </Card>
  );
}
