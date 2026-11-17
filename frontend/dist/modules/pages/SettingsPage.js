import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Settings, Tag, Building2, Database, FileSpreadsheet, } from 'lucide-react';
import { AppNavbar } from '../components/layout/AppNavbar';
import { ServiceCatalogTab } from '../components/settings/ServiceCatalogTab';
import { ClinicProfileTab } from '../components/settings/ClinicProfileTab';
import { BackupMaintenanceTab } from '../components/settings/BackupMaintenanceTab';
import { DataImportTab } from '../components/settings/DataImportTab';
export function SettingsPage() {
    const [activeTab, setActiveTab] = useState('catalog');
    const tabs = [
        {
            id: 'catalog',
            label: 'دليل الخدمات والأسعار',
            icon: Tag,
            description: 'تسجيل وتعديل أسعار الكشوفات والإجراءات الطبية',
        },
        {
            id: 'profile',
            label: 'بيانات العيادة وسياسات الكشف',
            icon: Building2,
            description: 'اسم الطبيب، التخصص، وصلاحية الاستشارات المجانية',
        },
        {
            id: 'backup',
            label: 'النسخ الاحتياطي والصيانة',
            icon: Database,
            description: 'إنشاء نسخ احتياطية ساخنة وتنزيل الأرشيف وفحص قاعدة البيانات',
        },
        {
            id: 'import',
            label: 'استيراد البيانات (CSV)',
            icon: FileSpreadsheet,
            description: 'استيراد ملفات المرضى ودليل الأدوية دفعة واحدة',
        },
    ];
    return (_jsxs("div", { className: "min-h-screen bg-slate-50 flex flex-col", children: [_jsx(AppNavbar, { currentPath: "/settings" }), _jsxs("main", { className: "flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6", children: [_jsxs("div", { children: [_jsxs("h1", { className: "text-xl font-bold text-slate-900 flex items-center gap-2", children: [_jsx(Settings, { className: "w-6 h-6 text-sky-600" }), _jsx("span", { children: "\u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0646\u0638\u0627\u0645 \u0648\u0627\u0644\u0639\u064A\u0627\u062F\u0629 \u0648\u0642\u0648\u0627\u0639\u062F \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A" })] }), _jsx("p", { className: "text-xs text-slate-500 mt-0.5", children: "\u0627\u0644\u062A\u062D\u0643\u0645 \u0641\u064A \u062F\u0644\u064A\u0644 \u0627\u0644\u0623\u0633\u0639\u0627\u0631\u060C \u0633\u064A\u0627\u0633\u0627\u062A \u0627\u0644\u0627\u0633\u062A\u0634\u0627\u0631\u0629\u060C \u0627\u0644\u0646\u0633\u062E \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A\u060C \u0648\u0623\u062F\u0648\u0627\u062A \u0627\u0633\u062A\u064A\u0631\u0627\u062F \u0627\u0644\u0633\u062C\u0644\u0627\u062A" })] }), _jsx("div", { className: "bg-white rounded-2xl border border-slate-200 p-2 shadow-2xs", children: _jsx("div", { className: "grid grid-cols-2 lg:grid-cols-4 gap-2", children: tabs.map((tab) => {
                                const Icon = tab.icon;
                                const isActive = activeTab === tab.id;
                                return (_jsxs("button", { type: "button", onClick: () => setActiveTab(tab.id), className: `flex items-start gap-3 p-3 rounded-xl text-right transition-all ${isActive
                                        ? 'bg-sky-50/80 border border-sky-200 text-sky-950 shadow-xs'
                                        : 'border border-transparent text-slate-600 hover:bg-slate-50'}`, children: [_jsx("div", { className: `p-2 rounded-lg ${isActive ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'}`, children: _jsx(Icon, { className: "w-4 h-4" }) }), _jsxs("div", { children: [_jsx("div", { className: "font-bold text-xs", children: tab.label }), _jsx("div", { className: "text-[10px] text-slate-400 mt-0.5 line-clamp-1", children: tab.description })] })] }, tab.id));
                            }) }) }), _jsxs("div", { children: [activeTab === 'catalog' && _jsx(ServiceCatalogTab, {}), activeTab === 'profile' && _jsx(ClinicProfileTab, {}), activeTab === 'backup' && _jsx(BackupMaintenanceTab, {}), activeTab === 'import' && _jsx(DataImportTab, {})] })] })] }));
}
