import { PublicHero } from "../components/public/PublicHero.jsx";
import { LedgerTable } from "../components/public/LedgerTable.jsx";

export function PublicPage() {
  return (
    <div className="flex flex-col gap-10 md:gap-14">
      <PublicHero />
      <LedgerTable />
    </div>
  );
}
