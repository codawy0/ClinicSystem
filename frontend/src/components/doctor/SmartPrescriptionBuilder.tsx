import { useState, useEffect, useRef } from 'react';
import {
  Pill,
  Search,
  Plus,
  Trash2,
  FolderOpen,
  Save,
  Copy,
  AlertTriangle,
  Baby,
  Loader2,
} from 'lucide-react';
import { Button } from '../ui/button';
import {
  PrescriptionItemInputDto,
  DrugDto,
  PatientAllergyDto,
} from '../../types';
import { doctorService } from '../../services/doctorService';
import { ArabicNormalizer } from '../../lib/arabicNormalizer';

interface SmartPrescriptionBuilderProps {
  items: PrescriptionItemInputDto[];
  onChangeItems: (items: PrescriptionItemInputDto[]) => void;
  patientId?: number;
  isPregnant?: boolean;
  isLactating?: boolean;
  patientAllergies?: PatientAllergyDto[];
  onOpenTemplatesModal: () => void;
  onOpenSaveTemplateModal: () => void;
  onRepeatPriorRx: () => void;
  hasPriorVisits: boolean;
  searchRef?: React.RefObject<HTMLInputElement | null>;
}

const TIMING_PRESETS = [
  'كل 8 ساعات بعد الأكل (1x3)',
  'كل 12 ساعة بعد الأكل (1x2)',
  'مرة واحدة يومياً صباحاً (1x1)',
  'مرة واحدة يومياً قبل النوم',
  'قبل الأكل بنصف ساعة',
  'عند اللزوم (PRN)',
];

const DURATION_PRESETS = [
  '3 أيام',
  '5 أيام',
  '7 أيام',
  '10 أيام',
  'أسبوعين',
  'شهر',
];

export function SmartPrescriptionBuilder({
  items,
  onChangeItems,
  patientId: _patientId,
  isPregnant = false,
  isLactating = false,
  patientAllergies = [],
  onOpenTemplatesModal,
  onOpenSaveTemplateModal,
  onRepeatPriorRx,
  hasPriorVisits,
  searchRef,
}: SmartPrescriptionBuilderProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<DrugDto[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const localSearchInputRef = useRef<HTMLInputElement>(null);
  const inputRef = searchRef || localSearchInputRef;
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounced search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsDropdownOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await doctorService.searchDrugs(searchQuery.trim());
        setSearchResults(results);
        setIsDropdownOpen(results.length > 0);
        setSelectedIndex(0);
      } catch (err) {
        console.warn('Failed to search drugs:', err);
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [inputRef]);

  // Add drug from search result
  const handleSelectDrug = (drug: DrugDto) => {
    const newItem: PrescriptionItemInputDto = {
      drugId: drug.id,
      drugName: drug.tradeName,
      activeIngredient: drug.activeIngredient,
      strength: drug.strength,
      form: drug.form,
      dosage: drug.defaultDosage || '1 قرص',
      timing: drug.defaultTiming || 'كل 12 ساعة بعد الأكل (1x2)',
      duration: drug.defaultDuration || '7 أيام',
      instructions: '',
    };

    onChangeItems([...items, newItem]);
    setSearchQuery('');
    setSearchResults([]);
    setIsDropdownOpen(false);
    inputRef.current?.focus();
  };

  // Add manual custom drug row
  const handleAddCustomDrug = () => {
    const newItem: PrescriptionItemInputDto = {
      drugName: '',
      activeIngredient: '',
      strength: '',
      form: 'Tablet',
      dosage: '1 قرص',
      timing: 'كل 12 ساعة بعد الأكل (1x2)',
      duration: '7 أيام',
      instructions: '',
    };
    onChangeItems([...items, newItem]);
  };

  // Update item field
  const handleUpdateItem = (index: number, patch: Partial<PrescriptionItemInputDto>) => {
    const updated = items.map((item, idx) => (idx === index ? { ...item, ...patch } : item));
    onChangeItems(updated);
  };

  // Remove item
  const handleRemoveItem = (index: number) => {
    const updated = items.filter((_, idx) => idx !== index);
    onChangeItems(updated);
  };

  // Handle keyboard navigation in search results
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isDropdownOpen || searchResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % searchResults.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + searchResults.length) % searchResults.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (searchResults[selectedIndex]) {
        handleSelectDrug(searchResults[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
      {/* Header & Toolbars */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Pill className="w-5 h-5 text-sky-600" />
          <h3 className="font-bold text-slate-900 text-base">الروشتة العلاجية (Prescription Builder)</h3>
          <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
            {items.length} {items.length === 1 ? 'دواء' : 'أدوية'}
          </span>
        </div>

        {/* Action Buttons: Templates, Save Template, Repeat Prior Rx */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenTemplatesModal}
            className="text-xs font-semibold gap-1.5"
          >
            <FolderOpen className="w-3.5 h-3.5 text-sky-600" />
            <span>قوالب الروشتة</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenSaveTemplateModal}
            disabled={items.length === 0}
            className="text-xs font-semibold gap-1.5"
          >
            <Save className="w-3.5 h-3.5 text-emerald-600" />
            <span>حفظ كقالب جديد</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRepeatPriorRx}
            disabled={!hasPriorVisits}
            className="text-xs font-semibold gap-1.5"
            title={hasPriorVisits ? 'نسخ أدوية الكشف السابق للمريض' : 'لا توجد كشوفات سابقة مسجلة'}
          >
            <Copy className="w-3.5 h-3.5 text-indigo-600" />
            <span>تكرار الروشتة السابقة</span>
          </Button>
        </div>
      </div>

      {/* Drug Search Bar with F2 Shortcut */}
      <div className="relative">
        <div className="relative flex items-center">
          <div className="absolute right-3.5 text-slate-400 pointer-events-none">
            {isSearching ? <Loader2 className="w-4 h-4 animate-spin text-sky-600" /> : <Search className="w-4 h-4" />}
          </div>
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => {
              if (searchResults.length > 0) setIsDropdownOpen(true);
            }}
            onKeyDown={handleKeyDown}
            placeholder="ابحث بالاسم التجاري أو المادة الفعالة (F2)..."
            className="w-full text-sm font-medium rounded-xl border border-slate-300 pr-10 pl-24 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent placeholder:text-slate-400"
          />
          <div className="absolute left-2.5 flex items-center gap-1.5">
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-slate-100 text-slate-600 rounded border border-slate-300">
              F2
            </kbd>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleAddCustomDrug}
              className="text-xs font-semibold text-sky-600 hover:text-sky-700 hover:bg-sky-50 px-2 py-1 h-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>دواء يدوي</span>
            </Button>
          </div>
        </div>

        {/* Search Results Dropdown */}
        {isDropdownOpen && searchResults.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute z-40 left-0 right-0 mt-1 max-h-72 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl divide-y divide-slate-100 animate-in fade-in duration-150"
          >
            {searchResults.map((drug, index) => {
              const isSelected = index === selectedIndex;
              const hasAllergyConflict = patientAllergies.some(
                (a) =>
                  a.activeIngredient &&
                  drug.activeIngredient &&
                  ArabicNormalizer.normalizeText(a.activeIngredient) ===
                    ArabicNormalizer.normalizeText(drug.activeIngredient)
              );

              return (
                <div
                  key={drug.id}
                  onClick={() => handleSelectDrug(drug)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`p-3 cursor-pointer transition-colors flex items-center justify-between gap-3 ${
                    isSelected ? 'bg-sky-50/80 text-sky-950' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">
                        <bdi dir="ltr">{drug.tradeName}</bdi>
                      </span>
                      {drug.strength && (
                        <span className="text-xs font-mono font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                          <bdi dir="ltr">{drug.strength}</bdi>
                        </span>
                      )}
                      {drug.form && (
                        <span className="text-[11px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          {drug.form}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>المادة الفعالة:</span>
                      <bdi dir="ltr" className="font-medium text-slate-700">
                        {drug.activeIngredient}
                      </bdi>
                      {drug.category && (
                        <span className="text-slate-400">({drug.category})</span>
                      )}
                    </div>
                  </div>

                  {/* Warning Indicators in Dropdown */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {hasAllergyConflict && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full border border-rose-200">
                        <AlertTriangle className="w-3 h-3 text-rose-600" />
                        حساسية مسجلة
                      </span>
                    )}
                    {isPregnant && drug.avoidInPregnancy && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-pink-700 bg-pink-100 px-2 py-0.5 rounded-full border border-pink-200">
                        <Baby className="w-3 h-3 text-pink-600" />
                        ممنوع في الحمل
                      </span>
                    )}
                    {isLactating && drug.avoidInLactation && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full border border-purple-200">
                        تحذير في الرضاعة
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Prescription Items Table */}
      {items.length === 0 ? (
        <div className="border border-dashed border-slate-200 rounded-xl p-8 text-center text-slate-400 space-y-2">
          <Pill className="w-8 h-8 mx-auto text-slate-300 stroke-[1.5]" />
          <p className="text-sm font-medium text-slate-600">لم يتم إضافة أدوية للروشتة بعد</p>
          <p className="text-xs text-slate-400">
            ابحث عن الدواء في الحقل أعلاه بالاسم التجاري أو اضغط F2 للتركيز السريع.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-xs">
          <table className="w-full text-right text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3 w-8 text-center">#</th>
                <th className="py-2.5 px-3 w-56">اسم الدواء والمادة الفعالة</th>
                <th className="py-2.5 px-3 w-28">الجرعة</th>
                <th className="py-2.5 px-3 w-48">التكرار والتوقيت</th>
                <th className="py-2.5 px-3 w-32">المدة</th>
                <th className="py-2.5 px-3">تعليمات الاستخدام</th>
                <th className="py-2.5 px-2 w-10 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {items.map((item, index) => (
                <tr key={index} className="hover:bg-slate-50/60 transition-colors">
                  {/* Row Index */}
                  <td className="py-2 px-3 text-center font-mono font-bold text-slate-400">
                    {index + 1}
                  </td>

                  {/* Drug Name & Active Ingredient with <bdi dir="ltr"> */}
                  <td className="py-2 px-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={item.drugName}
                          onChange={(e) => handleUpdateItem(index, { drugName: e.target.value })}
                          placeholder="اسم الدواء..."
                          className="font-bold text-slate-900 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500 rounded px-1.5 py-0.5 w-full bg-transparent"
                        />
                      </div>
                      {item.activeIngredient && (
                        <div className="text-[11px] text-slate-500 px-1.5">
                          <bdi dir="ltr">{item.activeIngredient}</bdi>
                          {item.strength && ` - ${item.strength}`}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Dosage */}
                  <td className="py-2 px-2">
                    <input
                      type="text"
                      value={item.dosage}
                      onChange={(e) => handleUpdateItem(index, { dosage: e.target.value })}
                      placeholder="مثال: 1 قرص"
                      className="w-full text-xs font-semibold rounded-lg border border-slate-200 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </td>

                  {/* Timing & Frequency with Egyptian Presets */}
                  <td className="py-2 px-2">
                    <div className="relative">
                      <input
                        list={`timing-presets-${index}`}
                        type="text"
                        value={item.timing}
                        onChange={(e) => handleUpdateItem(index, { timing: e.target.value })}
                        placeholder="التوقيت والتكرار..."
                        className="w-full text-xs font-medium rounded-lg border border-slate-200 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                      <datalist id={`timing-presets-${index}`}>
                        {TIMING_PRESETS.map((p) => (
                          <option key={p} value={p} />
                        ))}
                      </datalist>
                    </div>
                  </td>

                  {/* Duration with Presets */}
                  <td className="py-2 px-2">
                    <div className="relative">
                      <input
                        list={`duration-presets-${index}`}
                        type="text"
                        value={item.duration}
                        onChange={(e) => handleUpdateItem(index, { duration: e.target.value })}
                        placeholder="المدة..."
                        className="w-full text-xs font-medium rounded-lg border border-slate-200 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                      <datalist id={`duration-presets-${index}`}>
                        {DURATION_PRESETS.map((d) => (
                          <option key={d} value={d} />
                        ))}
                      </datalist>
                    </div>
                  </td>

                  {/* Instructions */}
                  <td className="py-2 px-2">
                    <input
                      type="text"
                      value={item.instructions || ''}
                      onChange={(e) => handleUpdateItem(index, { instructions: e.target.value })}
                      placeholder="ملاحظات للمريض (مثال: مع وفرة من الماء)..."
                      className="w-full text-xs text-slate-700 rounded-lg border border-slate-200 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500 placeholder:text-slate-300"
                    />
                  </td>

                  {/* Remove Button */}
                  <td className="py-2 px-2 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="حذف هذا الدواء"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
