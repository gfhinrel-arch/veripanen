import { BuyerHero } from "../components/buyer/BuyerHero.jsx";
import { OpenListingsPanel } from "../components/buyer/OpenListingsPanel.jsx";
import { MyPurchasesPanel } from "../components/buyer/MyPurchasesPanel.jsx";

export function BuyerPage() {
  return (
    <div className="flex flex-col gap-10 md:gap-14">
      <BuyerHero />
      <OpenListingsPanel />
      <MyPurchasesPanel />
    </div>
  );
}
