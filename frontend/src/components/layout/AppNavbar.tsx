import {
  Users,
  Stethoscope,
  Activity,
  DollarSign,
  TrendingUp,
  Settings,
  Tv,
  LogOut,
  Building2,
} from 'lucide-react';
import { authStorage } from '../../lib/api';
import { Button } from '../ui/button';

interface AppNavbarProps {
  currentPath?: string;
}

export function AppNavbar({ currentPath = window.location.pathname }: AppNavbarProps) {
  const user = authStorage.getUser();
  const role = user?.role;

  const navigateTo = (path: string) => {
    window.history.pushState(null, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const handleLogout = () => {
    authStorage.clearSession();
    navigateTo('/login');
  };

  // Build navigation items based on role
  const navItems = [
    {
      path: '/reception',
      label: 'الاستقبال',
      icon: Users,
      roles: ['Receptionist', 'Admin', 'Doctor'],
    },
    {
      path: '/doctor',
      label: 'كشف الطبيب',
      icon: Stethoscope,
      roles: ['Doctor', 'AssistantDoctor', 'Admin'],
    },
    {
      path: '/nursing',
      label: 'التمريض',
      icon: Activity,
      roles: ['Nurse', 'Admin'],
    },
    {
      path: '/treasury',
      label: 'الخزينة والمالية',
      icon: DollarSign,
      roles: ['Receptionist', 'Doctor', 'AssistantDoctor', 'Admin'],
    },
    {
      path: '/analytics',
      label: 'التحليلات والمؤشرات',
      icon: TrendingUp,
      roles: ['Doctor', 'AssistantDoctor', 'Admin'],
    },
    {
      path: '/settings',
      label: 'الإعدادات والنسخ',
      icon: Settings,
      roles: ['Doctor', 'Admin'],
    },
    {
      path: '/tv-queue',
      label: 'شاشة الانتظار',
      icon: Tv,
      roles: ['Receptionist', 'Doctor', 'AssistantDoctor', 'Nurse', 'Admin'],
      newTab: true,
    },
  ];

  const visibleItems = navItems.filter(
    (item) => !role || item.roles.includes(role)
  );

  const getRoleArabicName = (r?: string) => {
    switch (r) {
      case 'Doctor':
        return 'طبيب العيادة';
      case 'AssistantDoctor':
        return 'طبيب مساعد';
      case 'Nurse':
        return 'تمريض';
      case 'Receptionist':
        return 'موظف استقبال';
      case 'Admin':
        return 'مدير النظام';
      default:
        return r || '';
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 select-none shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        {/* Brand & Clinic Title */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center font-bold shadow-xs">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="hidden sm:block">
            <div className="font-bold text-slate-800 text-xs">عيادة النور التخصصية</div>
            <div className="text-[10px] text-slate-400">نظام الإدارة العيادية المتكامل</div>
          </div>
        </div>

        {/* Navigation Workspaces */}
        <nav className="flex items-center gap-1 overflow-x-auto py-1">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPath.startsWith(item.path);

            return (
              <button
                key={item.path}
                type="button"
                onClick={() => {
                  if (item.newTab) {
                    window.open(item.path, '_blank');
                  } else {
                    navigateTo(item.path);
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-sky-50 text-sky-700 shadow-2xs border border-sky-200 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-sky-600' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User Info & Logout */}
        <div className="flex items-center gap-3">
          {user && (
            <div className="hidden md:flex flex-col text-left">
              <span className="text-xs font-bold text-slate-700">{user.fullName}</span>
              <span className="text-[10px] text-slate-400">{getRoleArabicName(user.role)}</span>
            </div>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-slate-500 hover:text-rose-600 hover:bg-rose-50 h-8 px-2.5 text-xs gap-1"
            title="تسجيل الخروج"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">خروج</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
