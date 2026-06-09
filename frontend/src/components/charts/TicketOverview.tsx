import Link from 'next/link';

export default function TicketOverview({ data }: any) {
    const maxValue = Math.max(
        ...data.map((item: any) => item.value),
        1
    );

    return (
        <div className="glass-card p-6">
            <h3 className="text-xl font-semibold">
                Tickets Overview
            </h3>

            <p className="text-sm text-text-secondary mt-1 mb-8">
                Current status of support tickets
            </p>

            <div className="space-y-4">
                {data.map((item: any) => {
                    const percentage =
                        (item.value / maxValue) * 100;

                    return (
                        <div
                            key={item.label}
                            className="rounded-xl border border-border bg-surface/30 p-4"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex gap-3 items-start">
                                    <div
                                        className="w-10 h-10 rounded-full flex items-center justify-center"
                                        style={{
                                            backgroundColor: `${item.color}20`,
                                            border: `1px solid ${item.color}`,
                                        }}
                                    >
                                        <span
                                            style={{
                                                color: item.color,
                                            }}
                                        >
                                            ●
                                        </span>
                                    </div>

                                    <div>
                                        <h4 className="font-medium">
                                            {item.label}
                                        </h4>

                                        <p className="text-xs text-text-secondary">
                                            {item.description}
                                        </p>
                                    </div>
                                </div>

                                <div className="text-right min-w-[120px]">
                                    <div className="font-bold text-xl">
                                        {item.value}
                                    </div>

                                    <div className="mt-2 h-2 rounded-full bg-slate-800 overflow-hidden">
                                        <div
                                            className="h-full rounded-full"
                                            style={{
                                                width: `${percentage}%`,
                                                backgroundColor: item.color,
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="mt-4">
                <Link
                    href="/admin/tickets"
                    className="text-brand-light text-sm hover:underline"
                >
                    View all tickets →
                </Link>
            </div>
        </div>
    );
}