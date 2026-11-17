import { useState } from 'react';
import { RevenueTrendPointDto } from '../../types/analytics';
import { formatEgp, piastresToEgpNumber } from '../../lib/currency';

interface RevenueTrendChartProps {
  data: RevenueTrendPointDto[];
  height?: number;
}

export function RevenueTrendChart({ data, height = 260 }: RevenueTrendChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center bg-slate-50 border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs"
      >
        لا توجد بيانات إيرادات مسجلة للفترة المحددة
      </div>
    );
  }

  const padding = { top: 25, right: 35, bottom: 45, left: 55 };
  const width = 650;
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxVal = Math.max(
    ...data.map((d) => Math.max(d.grossPiastres, d.netPiastres, d.paidPiastres)),
    10000 // minimum 100 EGP to prevent div by 0
  );

  const pointsCount = data.length;
  const stepX = pointsCount > 1 ? chartWidth / (pointsCount - 1) : chartWidth / 2;

  // Generate polyline points
  const grossPoints = data
    .map((d, i) => {
      const x = padding.left + (pointsCount > 1 ? i * stepX : chartWidth / 2);
      const y = padding.top + chartHeight - (d.grossPiastres / maxVal) * chartHeight;
      return `${x},${y}`;
    })
    .join(' ');

  const paidPoints = data
    .map((d, i) => {
      const x = padding.left + (pointsCount > 1 ? i * stepX : chartWidth / 2);
      const y = padding.top + chartHeight - (d.paidPiastres / maxVal) * chartHeight;
      return `${x},${y}`;
    })
    .join(' ');

  // Y-axis grid ticks (4 ticks)
  const yTicks = [0, 0.33, 0.66, 1].map((pct) => ({
    val: Math.round(maxVal * pct),
    y: padding.top + chartHeight - pct * chartHeight,
  }));

  return (
    <div className="relative w-full bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
      <div className="flex items-center justify-between mb-3 text-xs">
        <div className="font-bold text-slate-800 flex items-center gap-2">
          <span>اتجاه الإيرادات اليومية</span>
          <span className="text-[11px] font-normal text-slate-500">
            ({data.length} {data.length === 1 ? 'يوم' : 'أيام'})
          </span>
        </div>
        <div className="flex items-center gap-4 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-sky-500 inline-block" />
            <span className="text-slate-600 font-medium">الإجمالي الصافي</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-emerald-500 inline-block" />
            <span className="text-slate-600 font-medium">المحصل فعلياً</span>
          </div>
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full overflow-visible"
          style={{ minWidth: '480px', maxHeight: `${height}px` }}
        >
          {/* Y Axis Grid Lines & Ticks */}
          {yTicks.map((tick, i) => (
            <g key={i}>
              <line
                x1={padding.left}
                y1={tick.y}
                x2={width - padding.right}
                y2={tick.y}
                stroke="#f1f5f9"
                strokeWidth="1"
                strokeDasharray={i === 0 ? undefined : '3 3'}
              />
              <text
                x={padding.left - 8}
                y={tick.y + 3}
                textAnchor="end"
                className="text-[10px] fill-slate-400 font-medium"
              >
                {piastresToEgpNumber(tick.val)}
              </text>
            </g>
          ))}

          {/* Area Fill for Gross */}
          {data.length > 1 && (
            <polygon
              points={`${padding.left},${padding.top + chartHeight} ${grossPoints} ${
                padding.left + (data.length - 1) * stepX
              },${padding.top + chartHeight}`}
              fill="rgba(14, 165, 233, 0.08)"
            />
          )}

          {/* Lines */}
          <polyline
            fill="none"
            stroke="#0ea5e9"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={grossPoints}
          />
          <polyline
            fill="none"
            stroke="#10b981"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="4 2"
            points={paidPoints}
          />

          {/* Data Points / Interaction dots */}
          {data.map((d, i) => {
            const x = padding.left + (pointsCount > 1 ? i * stepX : chartWidth / 2);
            const yGross = padding.top + chartHeight - (d.grossPiastres / maxVal) * chartHeight;
            const yPaid = padding.top + chartHeight - (d.paidPiastres / maxVal) * chartHeight;
            const isHovered = hoveredIndex === i;

            return (
              <g
                key={i}
                className="cursor-pointer transition-all"
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {/* Vertical hover guide */}
                {isHovered && (
                  <line
                    x1={x}
                    y1={padding.top}
                    x2={x}
                    y2={padding.top + chartHeight}
                    stroke="#94a3b8"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                )}

                {/* Gross point circle */}
                <circle
                  cx={x}
                  cy={yGross}
                  r={isHovered ? 5 : 3.5}
                  fill="#0ea5e9"
                  stroke="#ffffff"
                  strokeWidth="2"
                />

                {/* Paid point circle */}
                <circle
                  cx={x}
                  cy={yPaid}
                  r={isHovered ? 5 : 3}
                  fill="#10b981"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />

                {/* X axis date label */}
                <text
                  x={x}
                  y={padding.top + chartHeight + 18}
                  textAnchor="middle"
                  className={`text-[10px] font-medium ${
                    isHovered ? 'fill-sky-700 font-bold' : 'fill-slate-500'
                  }`}
                >
                  {d.date.length > 5 ? d.date.substring(5) : d.date}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Tooltip on hover */}
      {hoveredIndex !== null && data[hoveredIndex] && (
        <div className="mt-3 p-2.5 bg-slate-800 text-white rounded-lg text-xs flex items-center justify-between shadow-lg">
          <div className="font-bold flex items-center gap-2">
            <span>التاريخ:</span>
            <bdi dir="ltr">{data[hoveredIndex].date}</bdi>
            <span className="text-slate-400 text-[11px] mr-2">
              ({data[hoveredIndex].patientCount} مريض)
            </span>
          </div>
          <div className="flex gap-4">
            <span className="text-sky-300">
              الإجمالي: <bdi dir="ltr">{formatEgp(data[hoveredIndex].grossPiastres)}</bdi>
            </span>
            <span className="text-emerald-300">
              المحصل: <bdi dir="ltr">{formatEgp(data[hoveredIndex].paidPiastres)}</bdi>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
