import { Outlet, useLocation } from '@tanstack/react-router';
import { useTheme } from './useTheme';
import { GlobalNav } from './GlobalNav';
import { AnalysisChatWidget } from './AnalysisChatWidget';

export function AppShell() {
  const { theme } = useTheme();
  const location = useLocation();
  const isLandingPage = location.pathname === '/';

  // If landing page, render without wrapper constraints
  if (isLandingPage) {
    return <Outlet />;
  }

  return (
    <div className={theme === 'dark' ? 'dark bg-[#020202]' : 'bg-[#fafafa]'}>
      <div className="min-h-screen text-[var(--text)] transition-colors duration-500 relative overflow-hidden">
        {/* Dynamic Background */}
        <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
          {/* Large Glows - Increased opacity and spread */}
          <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-blue-600/20 blur-[140px] mix-blend-screen animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-amber-600/15 blur-[140px] mix-blend-screen animate-pulse" style={{ animationDelay: '2s' }} />
          
          {/* Secondary Accent Glows */}
          <div className="absolute top-[30%] right-[10%] w-[30%] h-[30%] rounded-full bg-blue-400/10 blur-[100px]" />
          <div className="absolute bottom-[20%] left-[10%] w-[40%] h-[40%] rounded-full bg-orange-800/10 blur-[120px]" />

          {/* Mesh Overlay */}
          <div className="absolute inset-0 mesh-bg opacity-[0.4] dark:opacity-[0.15]" />
          
          {/* Subtle noise texture */}
          <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
        </div>

        <GlobalNav />
        <main className="relative z-10 pt-20 px-4 md:px-8 max-w-7xl mx-auto pb-12">
          <div key={location.pathname} className="page-transition">
            <Outlet />
          </div>
        </main>
        <AnalysisChatWidget />
      </div>
    </div>
  );
}
