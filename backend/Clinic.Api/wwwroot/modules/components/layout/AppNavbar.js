import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Users, Stethoscope, Activity, DollarSign, TrendingUp, Settings, Tv, LogOut, Building2, } from 'lucide-react';
import { authStorage } from '../../lib/api';
import { Button } from '../ui/button';
export function AppNavbar({ currentPath = window.location.pathname }) {
    const user = authStorage.getUser();
    const role = user?.role;
    const navigateTo = (path) => {
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
    const visibleItems = navItems.filter((item) => !role || item.roles.includes(role));
    const getRoleArabicName = (r) => {
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
    return (_jsx("header", { className: "bg-white border-b border-slate-200 sticky top-0 z-40 select-none shadow-2xs", children: _jsxs("div", { className: "max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center font-bold shadow-xs", children: _jsx(Building2, { className: "w-5 h-5" }) }), _jsxs("div", { className: "hidden sm:block", children: [_jsx("div", { className: "font-bold text-slate-800 text-xs", children: "\u0639\u064A\u0627\u062F\u0629 \u0627\u0644\u0646\u0648\u0631 \u0627\u0644\u062A\u062E\u0635\u0635\u064A\u0629" }), _jsx("div", { className: "text-[10px] text-slate-400", children: "\u0646\u0638\u0627\u0645 \u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0639\u064A\u0627\u062F\u064A\u0629 \u0627\u0644\u0645\u062A\u0643\u0627\u0645\u0644" })] })] }), _jsx("nav", { className: "flex items-center gap-1 overflow-x-auto py-1", children: visibleItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = currentPath.startsWith(item.path);
                        return (_jsxs("button", { type: "button", onClick: () => {
                                if (item.newTab) {
                                    window.open(item.path, '_blank');
                                }
                                else {
                                    navigateTo(item.path);
                                }
                            }, className: `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${isActive
                                ? 'bg-sky-50 text-sky-700 shadow-2xs border border-sky-200 font-bold'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'}`, children: [_jsx(Icon, { className: `w-3.5 h-3.5 ${isActive ? 'text-sky-600' : 'text-slate-400'}` }), _jsx("span", { children: item.label })] }, item.path));
                    }) }), _jsxs("div", { className: "flex items-center gap-3", children: [user && (_jsxs("div", { className: "hidden md:flex flex-col text-left", children: [_jsx("span", { className: "text-xs font-bold text-slate-700", children: user.fullName }), _jsx("span", { className: "text-[10px] text-slate-400", children: getRoleArabicName(user.role) })] })), _jsxs(Button, { type: "button", variant: "ghost", size: "sm", onClick: handleLogout, className: "text-slate-500 hover:text-rose-600 hover:bg-rose-50 h-8 px-2.5 text-xs gap-1", title: "\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062E\u0631\u0648\u062C", children: [_jsx(LogOut, { className: "w-3.5 h-3.5" }), _jsx("span", { className: "hidden sm:inline", children: "\u062E\u0631\u0648\u062C" })] })] })] }) }));
}
