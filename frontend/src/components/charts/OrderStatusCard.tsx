import Link from 'next/link';

export default function OrderStatusCard({ data }: any) {
    const total = data.reduce(
        (sum: number, item: any) => sum + item.value,
        0
    );

    return (
        <div className="glass-card p-6">
            <h3 className="text-xl font-semibold">
                Orders By Status
            </h3>

            <p className="text-sm text-text-secondary mt-1 mb-8">
                Distribution of orders by status
            </p>

            <div className="space-y-5">
                {data.map((item: any) => {
                    const percentage =
                        total > 0
                            ? (item.value / total) * 100
                            : 0;

                    return (
                        <div key={item.label}>
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-medium">
                                    {item.label}
                                </span>

                                <span className="text-sm text-text-secondary">
                                    {item.value} ({percentage.toFixed(1)}%)
                                </span>
                            </div>

                            {/* Progress Track */}
                            <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
                                {/* Progress Fill */}
                                <div
                                    className={`h-full rounded-full ${item.color}`}
                                    style={{
                                        width: `${percentage}%`,
                                        minWidth: item.value > 0 ? '8px' : '0px',
                                    }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="mt-4">
                <Link
                    href="/admin/orders"
                    className="text-brand-light text-sm hover:underline"
                >
                    View all orders →
                </Link>
            </div>
        </div>
    );
}