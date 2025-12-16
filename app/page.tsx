import { EnergyList } from '@/components/energy-list';
import { EnergyDashboard } from '@/components/energy-dashboard';

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <main className="py-8">
        <EnergyDashboard />
        <div className="mt-8">
          <EnergyList />
        </div>
      </main>
    </div>
  );
}
