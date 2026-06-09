'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    Legend,
    LabelList,
} from 'recharts';

interface RevenueChartProps {
    data: {
        month: string;
        revenue: number;
    }[];
}

export default function RevenueChart({
    data,
}: RevenueChartProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [mounted, setMounted] = useState(false);
    const [isChartReady, setIsChartReady] = useState(false);
    const gradientId = useId().replace(/:/g, '');

    const safeData = useMemo(
        () =>
            Array.isArray(data)
                ? data.map((item) => ({
                      month: item.month,
                      revenue: Number(item.revenue) || 0,
                  }))
                : [],
        [data]
    );

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted || !containerRef.current) return;

        const element = containerRef.current;
        const updateReadyState = () => {
            const { width, height } = element.getBoundingClientRect();
            setIsChartReady(width > 0 && height > 0);
        };

        updateReadyState();

        const observer = new ResizeObserver(() => {
            updateReadyState();
        });

        observer.observe(element);

        return () => {
            observer.disconnect();
        };
    }, [mounted]);

    return (
        <div className="glass-card p-6 mb-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-xl font-semibold">
                        Revenue Trend
                    </h3>

                    <p className="text-text-secondary text-sm">
                        Monthly revenue growth overview
                    </p>
                </div>

                <div className="glass-card px-3 py-2 text-sm">
                    Monthly
                </div>
            </div>

            {/* Chart */}
            <div ref={containerRef} className="h-[450px] min-h-[450px] w-full min-w-0">
                {mounted && isChartReady ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <AreaChart
                        data={safeData}
                        margin={{
                            top: 40,
                            right: 60,
                            left: 40,
                            bottom: 20,
                        }}
                    >
                        {/* Gradient Fill */}
                        <defs>
                            <linearGradient
                                id={gradientId}
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                            >
                                <stop
                                    offset="5%"
                                    stopColor="#8B5CF6"
                                    stopOpacity={0.35}
                                />
                                <stop
                                    offset="95%"
                                    stopColor="#8B5CF6"
                                    stopOpacity={0}
                                />
                            </linearGradient>
                        </defs>

                        {/* Grid */}
                        <CartesianGrid
                            stroke="#1f2937"
                            strokeDasharray="3 3"
                            vertical={false}
                        />

                        {/* X Axis */}
                        <XAxis
                            dataKey="month"
                            padding={{
                                left: 30,
                                right: 30,
                            }}
                            tick={{ fill: '#94a3b8', fontSize: 13 }}
                            axisLine={false}
                            tickLine={false}
                        />

                        {/* Y Axis */}
                        <YAxis
                            width={55}
                            tickFormatter={(value) => `$${value / 1000}K`}
                            tick={{ fill: '#94a3b8' }}
                            axisLine={false}
                            tickLine={false}
                        />

                        {/* Tooltip */}
                        <Tooltip
                            formatter={(value: number) => [
                                `$${value.toLocaleString()}`,
                                'Revenue',
                            ]}
                            contentStyle={{
                                background: '#0B1020',
                                border: '1px solid #1e293b',
                                borderRadius: '12px',
                                color: '#fff',
                            }}
                        />

                        {/* Legend */}
                        <Legend
                            verticalAlign="bottom"
                            height={40}
                        />

                        {/* Area */}
                        <Area
                            type="monotone"
                            dataKey="revenue"
                            stroke="#8B5CF6"
                            strokeWidth={3}
                            fill={`url(#${gradientId})`}
                            activeDot={{
                                r: 6,
                                strokeWidth: 2,
                                fill: '#8B5CF6',
                            }}
                        >
                            <LabelList
                                dataKey="revenue"
                                position="top"
                                formatter={(value: number) =>
                                    `$${(value / 1000).toFixed(1)}K`
                                }
                                style={{
                                    fill: '#ffffff',
                                    fontSize: 12,
                                    fontWeight: 600,
                                }}
                            />
                        </Area>
                    </AreaChart>
                </ResponsiveContainer>
                ) : null}
            </div>
        </div>
    );
}
