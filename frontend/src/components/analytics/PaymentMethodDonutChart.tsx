import { useState } from 'react';
import { PaymentMethodBreakdownDto } from '../../types/analytics';
import { formatEgp, piastresToEgpNumber } from '../../lib/currency';

interface PaymentMethodDonutChartProps {
  data: PaymentMethodBreakdownDto;
  size?: number;
}

export function PaymentMethodDonutChart({ data, size = 180 }: PaymentMethodDonutChartProps) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const segments = [
    {
      id: 'Cash',
      label: 'نقدي (كاش)',
      piastres: data.cashPiastres || 0,
      count: data.cashCount || 0,
      color: '#10b981', // emerald-500
      hoverColor: '#059669',
    },
    {
      id: 'Instapay',
      label: 'انستاباي (Instapay)',
      piastres: data.instapayPiastres || 0,
      count: data.instapayCount || 0,
      color: '#8b5cf6', // violet-500
      hoverColor: '#7c3aed',
    },
    {
      id: 'VodafoneCash',
      label: 'فودافون كاش',
      piastres: data.vodafoneCashPiastres || 0,
      count: data.vodafoneCashCount || 0,
      color: '#f43f5e', // rose-500
      hoverColor: '#e11d48',
    },
    {
      id: 'Card',
      label: 'بطاقة بنكية (Card)',
      piastres: data.cardPiastres || 0,
      count: data.cardCount || 0,
      color: '#0ea5e9', // sky-500
      hoverColor: '#0284c7',
    },
  ];

  const totalPiastres = segments.reduce((sum, s) => sum + s.piastres, 0);

  // SVG Donut calculation
  const radius = 60;
  const strokeWidth = 24;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  let cumulativePercent = 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
      <div className="font-bold text-slate-800 text-xs mb-3">
        توزيع طرق الدفع والتحصيل
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* SVG Donut */}
        <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
          {totalPiastres === 0 ? (
            <div
              style={{ width: size, height: size }}
              className="rounded-full border-4 border-dashed border-slate-200 flex items-center justify-center text-slate-400 text-[11px]"
            >
              لا توجد متحصلات
            </div>
          ) : (
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
              {segments.map((seg) => {
                if (seg.piastres <= 0) return null;
                const percent = seg.piastres / totalPiastres;
                const dashLength = percent * circumference;
                const spaceLength = circumference - dashLength;
                const offset = -cumulativePercent * circumference;
                cumulativePercent += percent;

                const isHovered = hoveredKey === seg.id;

                return (
                  <circle
                    key={seg.id}
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="transparent"
                    stroke={isHovered ? seg.hoverColor : seg.color}
                    strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                    strokeDasharray={`${dashLength} ${spaceLength}`}
                    strokeDashoffset={offset}
                    className="transition-all duration-300 cursor-pointer"
                    onMouseEnter={() => setHoveredKey(seg.id)}
                    onMouseLeave={() => setHoveredKey(null)}
                  />
                );
              })}
            </svg>
          )}

          {/* Donut Center Display */}
          {totalPiastres > 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center p-2">
              <span className="text-[10px] text-slate-500 font-medium">إجمالي التحصيل</span>
              <span className="text-sm font-bold text-slate-800">
                <bdi dir="ltr">{piastresToEgpNumber(totalPiastres)}</bdi>
              </span>
              <span className="text-[10px] text-slate-400">ج.م</span>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex-1 w-full space-y-2 text-xs">
          {segments.map((seg) => {
            const pct = totalPiastres > 0 ? ((seg.piastres / totalPiastres) * 100).toFixed(1) : '0';
            const isHovered = hoveredKey === seg.id;

            return (
              <div
                key={seg.id}
                onMouseEnter={() => setHoveredKey(seg.id)}
                onMouseLeave={() => setHoveredKey(null)}
                className={`p-2 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                  isHovered ? 'bg-slate-50 border-slate-300 shadow-2xs' : 'border-transparent'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: seg.color }}
                  />
                  <div>
                    <div className="font-semibold text-slate-700">{seg.label}</div>
                    <div className="text-[10px] text-slate-400">
                      {seg.count} {seg.count === 1 ? 'معاملة' : 'معاملات'}
                    </div>
                  </div>
                </div>

                <div className="text-left">
                  <div className="font-bold text-slate-800">
                    <bdi dir="ltr">{formatEgp(seg.piastres)}</bdi>
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium">
                    <bdi dir="ltr">%{pct}</bdi>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
