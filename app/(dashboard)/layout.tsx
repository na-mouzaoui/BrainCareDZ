import { DashboardNav } from '@/components/dashboard-nav';

export default function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <DashboardNav />
      <main className="flex-1 ml-20 lg:ml-64 bg-gray-50">
        {children}
      </main>
    </div>
  );
}
