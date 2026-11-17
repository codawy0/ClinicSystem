import { useState } from 'react';
import {
  Settings,
  Tag,
  Building2,
  Database,
  FileSpreadsheet,
} from 'lucide-react';
import { AppNavbar } from '../components/layout/AppNavbar';
import { ServiceCatalogTab } from '../components/settings/ServiceCatalogTab';
import { ClinicProfileTab } from '../components/settings/ClinicProfileTab';
import { BackupMaintenanceTab } from '../components/settings/BackupMaintenanceTab';
import { DataImportTab } from '../components/settings/DataImportTab';

type TabType = 'catalog' | 'profile' | 'backup' | 'import';

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('catalog');

  const tabs = [
    {
      id: 'catalog' as TabType,
      label: 'دليل الخدمات والأسعار',
      icon: Tag,
      description: 'تسجيل وتعديل أسعار الكشوفات والإجراءات الطبية',
    },
    {
      id: 'profile' as TabType,
      label: 'بيانات العيادة وسياسات الكشف',
      icon: Building2,
      description: 'اسم الطبيب، التخصص، وصلاحية الاستشارات المجانية',
    },
    {
      id: 'backup' as TabType,
      label: 'النسخ الاحتياطي والصيانة',
      icon: Database,
      description: 'إنشاء نسخ احتياطية ساخنة وتنزيل الأرشيف وفحص قاعدة البيانات',
    },
    {
      id: 'import' as TabType,
      label: 'استيراد البيانات (CSV)',
      icon: FileSpreadsheet,
      description: 'استيراد ملفات المرضى ودليل الأدوية دفعة واحدة',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <AppNavbar currentPath="/settings" />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Settings className="w-6 h-6 text-sky-600" />
            <span>إعدادات النظام والعيادة وقواعد البيانات</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            التحكم في دليل الأسعار، سياسات الاستشارة، النسخ الاحتياطي، وأدوات استيراد السجلات
          </p>
        </div>

        {/* Tab Headers */}
        <div className="bg-white rounded-2xl border border-slate-200 p-2 shadow-2xs">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-start gap-3 p-3 rounded-xl text-right transition-all ${
                    isActive
                      ? 'bg-sky-50/80 border border-sky-200 text-sky-950 shadow-xs'
                      : 'border border-transparent text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div
                    className={`p-2 rounded-lg ${
                      isActive ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-xs">{tab.label}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                      {tab.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === 'catalog' && <ServiceCatalogTab />}
          {activeTab === 'profile' && <ClinicProfileTab />}
          {activeTab === 'backup' && <BackupMaintenanceTab />}
          {activeTab === 'import' && <DataImportTab />}
        </div>
      </main>
    </div>
  );
}
