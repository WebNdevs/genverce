'use client';

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
    return (
        <div className="glass-card p-6 mb-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-xl font-semibold text-text-primary">
                        Revenue Trend
                    </h3>

                    <p className="text-text-secondary text-sm">
                        Monthly revenue growth overview
                    </p>
                </div>

                <div className="glass-card px-3 py-2 text-sm text-text-primary">
                    Monthly
                </div>
            </div>

            {/* Chart */}
            <div className="h-[450px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                        data={data}
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
                                id="revenueFill"
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                            >
                                <stop
                                    offset="5%"
                                    stopColor="#6366F1"
                                    stopOpacity={0.4}
                                />
                                <stop
                                    offset="95%"
                                    stopColor="#6366F1"
                                    stopOpacity={0.02}
                                />
                            </linearGradient>
                        </defs>

                        {/* Grid */}
                        <CartesianGrid
                            stroke="var(--border)"
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
                            tick={{ fill: 'var(--text-secondary)', fontSize: 13 }}
                            axisLine={false}
                            tickLine={false}
                        />

                        {/* Y Axis */}
                        <YAxis
                            width={55}
                            tickFormatter={(value) => `$${(Number(value) || 0) / 1000}K`}
                            tick={{ fill: 'var(--text-secondary)', fontSize: 13 }}
                            axisLine={false}
                            tickLine={false}
                        />

                        {/* Tooltip */}
                        <Tooltip
                            formatter={(value: any) => [
                                `$${Number(value || 0).toLocaleString()}`,
                                'Revenue',
                            ]}
                            contentStyle={{
                                backgroundColor: 'var(--surface)',
                                borderColor: 'var(--border)',
                                borderRadius: '12px',
                                color: 'var(--text-primary)',
                                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15)',
                            }}
                            itemStyle={{
                                color: 'var(--text-primary)',
                                fontWeight: 500,
                            }}
                            labelStyle={{
                                color: 'var(--text-secondary)',
                                fontWeight: 600,
                                marginBottom: '4px',
                            }}
                        />

                        {/* Legend */}
                        <Legend
                            verticalAlign="bottom"
                            height={40}
                            wrapperStyle={{
                                color: 'var(--text-secondary)',
                            }}
                        />

                        {/* Area */}
                        <Area
                            type="monotone"
                            dataKey="revenue"
                            stroke="#6366F1"
                            strokeWidth={3}
                            fill="url(#revenueFill)"
                            activeDot={{
                                r: 6,
                                strokeWidth: 2,
                                fill: '#6366F1',
                                stroke: 'var(--surface)',
                            }}
                        >
                            <LabelList
                                dataKey="revenue"
                                position="top"
                                formatter={(value: any) =>
                                    `$${((Number(value) || 0) / 1000).toFixed(1)}K`
                                }
                                style={{
                                    fill: 'var(--text-primary)',
                                    fontSize: 12,
                                    fontWeight: 600,
                                }}
                            />
                        </Area>
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}