import { FarmerHero } from "../components/farmer/FarmerHero.jsx";
import { CreateListingPanel } from "../components/farmer/CreateListingPanel.jsx";
import { MyListingsPanel } from "../components/farmer/MyListingsPanel.jsx";

export function FarmerPage() {
  return (
    <div className="flex flex-col gap-10 md:gap-14">
      <FarmerHero />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)] lg:gap-12">
        <CreateListingPanel />
        <MyListingsPanel />
      </div>
    </div>
  );
}
