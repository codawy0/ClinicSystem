import { useState, useMemo } from 'react';
import { Search, Activity, User, Clock, AlertTriangle, Play, RefreshCw } from 'lucide-react';
import { LiveQueueItemDto, AppointmentStatus } from '../../types';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

interface NurseQueuePanelProps {
  items: LiveQueueItemDto[];
  selectedAppointmentId: number | null;
  onSelectAppointment: (appointment: LiveQueueItemDto) => void;
  onStartPrep: (appointment: LiveQueueItemDto) => void;
  isLoading: boolean;
  onRefresh?: () => void;
  isStartingPrepId?: number | null;
}

type FilterTab = 'ALL' | 'InNursing' | 'Waiting' | 'Booked';

export function NurseQueuePanel({
  items,
  selectedAppointmentId,
  onSelectAppointment,
  onStartPrep,
  isLoading,
  onRefresh,
  isStartingPrepId,
}: NurseQueuePanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterTab>('ALL');

  // Filter only relevant nursing queue statuses: Booked, Waiting, InNursing (and WithDoctor for reference)
  const nursingQueue = useMemo(() => {
    return items.filter((item) =>
      item.status === 'InNursing' || item.status === 'Waiting' || item.status === 'Booked'
    );
  }, [items]);

  // Counts
  const counts = useMemo(() => {
    return {
      all: nursingQueue.length,
      inNursing: nursingQueue.filter((i) => i.status === 'InNursing').length,
      waiting: nursingQueue.filter((i) => i.status === 'Waiting').length,
      booked: nursingQueue.filter((i) => i.status === 'Booked').length,
    };
  }, [nursingQueue]);

  // Filter & Search
  const filteredItems = useMemo(() => {
    return nursingQueue.filter((item) => {
      // Tab filter
      if (activeFilter !== 'ALL' && item.status !== activeFilter) {
        return false;
      }

      // Search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.trim().toLowerCase();
      return (
        item.patientName.toLowerCase().includes(q) ||
        item.fileNumber.toLowerCase().includes(q) ||
        (item.phone && item.phone.includes(q)) ||
        (item.queueNumber !== null && String(item.queueNumber).includes(q))
      );
    });
  }, [nursingQueue, activeFilter, searchQuery]);

  const getStatusBadge = (status: AppointmentStatus) => {
    switch (status) {
      case 'InNursing':
        return (
          <Badge variant="purple" className="animate-pulse">
            <Activity className="w-3 h-3 ml-1" />
            قيد الفحص
          </Badge>
        );
      case 'Waiting':
        return (
          <Badge variant="warning">
            <Clock className="w-3 h-3 ml-1" />
            في الانتظار
          </Badge>
        );
      case 'Booked':
        return (
          <Badge variant="default">
            <Clock className="w-3 h-3 ml-1" />
            محجوز
          </Badge>
        );
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[calc(100vh-120px)] overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 space-y-3 bg-slate-50/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">طابور التمريض والفحص</h2>
              <p className="text-[11px] text-slate-500">المرضى المطلوب قياس علاماتهم الحيوية</p>
            </div>
          </div>
          {onRefresh && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onRefresh}
              disabled={isLoading}
              title="تحديث الطابور"
              className="text-slate-500 hover:text-slate-800"
            >
              <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
            </Button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث بالاسم أو رقم الملف أو الدور..."
            className="w-full text-xs bg-white border border-slate-200 rounded-xl pr-8 pl-3 py-2 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <Search className="w-4 h-4 text-slate-400 absolute top-2.5 right-2.5" />
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveFilter('ALL')}
            className={cn(
              'flex-1 py-1 rounded-lg transition-all text-center',
              activeFilter === 'ALL'
                ? 'bg-white text-slate-800 shadow-sm font-bold'
                : 'text-slate-500 hover:text-slate-700'
            )}
          >
            الكل ({counts.all})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('InNursing')}
            className={cn(
              'flex-1 py-1 rounded-lg transition-all text-center',
              activeFilter === 'InNursing'
                ? 'bg-purple-600 text-white shadow-sm font-bold'
                : 'text-purple-700 hover:bg-purple-50'
            )}
          >
            قيد الفحص ({counts.inNursing})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('Waiting')}
            className={cn(
              'flex-1 py-1 rounded-lg transition-all text-center',
              activeFilter === 'Waiting'
                ? 'bg-amber-500 text-white shadow-sm font-bold'
                : 'text-amber-700 hover:bg-amber-50'
            )}
          >
            الانتظار ({counts.waiting})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('Booked')}
            className={cn(
              'flex-1 py-1 rounded-lg transition-all text-center',
              activeFilter === 'Booked'
                ? 'bg-slate-700 text-white shadow-sm font-bold'
                : 'text-slate-600 hover:bg-slate-200'
            )}
          >
            حجز ({counts.booked})
          </button>
        </div>
      </div>

      {/* Queue Items List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoading && filteredItems.length === 0 ? (
          <div className="py-12 text-center text-slate-400 space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-teal-600" />
            <p className="text-xs">جاري تحميل قائمة المرضى...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-12 text-center text-slate-400 space-y-2">
            <User className="w-8 h-8 mx-auto text-slate-300" />
            <p className="text-xs">لا يوجد مرضى مطابقين للبحث حالياً</p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const isSelected = item.appointmentId === selectedAppointmentId;
            const isInNursing = item.status === 'InNursing';
            const isStarting = isStartingPrepId === item.appointmentId;

            return (
              <div
                key={item.appointmentId}
                onClick={() => onSelectAppointment(item)}
                className={cn(
                  'p-3 rounded-xl border text-right transition-all cursor-pointer relative group',
                  isSelected
                    ? 'border-teal-500 bg-teal-50/50 shadow-sm ring-1 ring-teal-500'
                    : 'border-slate-200 bg-white hover:border-teal-300 hover:bg-slate-50/70',
                  item.isUrgent && 'border-r-4 border-r-rose-500'
                )}
              >
                {/* Top Row: Queue #, Name, Badges */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {item.queueNumber !== null ? (
                      <span className="w-6 h-6 rounded-md bg-slate-800 text-white text-xs font-bold flex items-center justify-center font-mono">
                        {item.queueNumber}
                      </span>
                    ) : (
                      <span className="w-6 h-6 rounded-md bg-slate-100 text-slate-500 text-xs font-semibold flex items-center justify-center">
                        -
                      </span>
                    )}
                    <span className="font-bold text-xs text-slate-800 group-hover:text-teal-900">
                      {item.patientName}
                    </span>
                    {item.isUrgent && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded px-1">
                        <AlertTriangle className="w-3 h-3" />
                        طوارئ
                      </span>
                    )}
                  </div>

                  <div>{getStatusBadge(item.status)}</div>
                </div>

                {/* Sub row: File #, Service, Time */}
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                      #{item.fileNumber}
                    </span>
                    <span>{item.serviceName}</span>
                  </div>
                  {item.arrivedAtUtc && (
                    <span className="text-[10px] text-slate-400">
                      {new Date(item.arrivedAtUtc).toLocaleTimeString('ar-EG', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
                </div>

                {/* Action button: Start Prep if not in nursing */}
                {!isInNursing && (
                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="primary"
                      disabled={isStarting}
                      onClick={(e) => {
                        e.stopPropagation();
                        onStartPrep(item);
                      }}
                      className="bg-teal-600 hover:bg-teal-700 text-xs py-1 px-3 shadow-none h-7"
                    >
                      <Play className="w-3 h-3 ml-1 fill-white" />
                      {isStarting ? 'جاري البدء...' : 'بدء الفحص'}
                    </Button>
                  </div>
                )}

                {isInNursing && (
                  <div className="mt-2.5 pt-2 border-t border-purple-100 flex items-center justify-between text-[10px] text-purple-700">
                    <span className="flex items-center gap-1 font-semibold">
                      <Activity className="w-3 h-3 animate-pulse" />
                      جلسة القياس نشطة حالياً
                    </span>
                    <span className="text-teal-700 font-bold">محدد الآن</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
