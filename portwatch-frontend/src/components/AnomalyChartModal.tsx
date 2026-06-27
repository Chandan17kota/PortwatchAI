import { Dialog, Transition } from "@headlessui/react";
import { Fragment, useEffect, useState } from "react";
import { Text, LineChart } from "@tremor/react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { useSearchParams } from "react-router-dom";

interface AnomalyData {
    date: string;
    port: string;
    predicted_calls: number;
    rolling_mean_7: number;
    upper_bound: number;
    status: "Normal" | "High" | "Anomalous";
}

interface RerouteRec {
    port_id: string;
    port_name: string;
    distance_km: number;
    predicted_calls: number;
    congestion_score: number;
}

interface AnomalyChartModalProps {
    isOpen: boolean;
    onClose: () => void;
    portName: string;
    data: AnomalyData[]; // All data for this port
}

const valueFormatter = (number: number) =>
    `${Intl.NumberFormat("us").format(number).toString()}`;

const getLoadColor = (load: number): string => {
    if (load >= 25) return "#ef4444";  // red — high
    if (load >= 15) return "#f59e0b";  // yellow — medium
    return "#22c55e";                   // green — low
};

function RerouteSection({ portName, show }: { portName: string; show: boolean }) {
    const [recs, setRecs] = useState<RerouteRec[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!show || !portName) return;
        setLoading(true);
        fetch(`http://localhost:8000/api/reroute?port_name=${encodeURIComponent(portName)}&force=true`)
            .then((res) => {
                if (!res.ok) throw new Error("API error");
                return res.json();
            })
            .then((data) => {
                setRecs(data.recommendations || []);
                setLoading(false);
            })
            .catch(() => {
                setRecs([]);
                setLoading(false);
            });
    }, [portName, show]);

    if (!show) return null;

    if (loading) {
        return (
            <div className="mt-5 pt-4 border-t border-dark-tremor-border">
                <Text className="text-sm text-slate-400 animate-pulse">Checking rerouting alternatives…</Text>
            </div>
        );
    }

    if (recs.length === 0) {
        return (
            <div className="mt-5 pt-4 border-t border-dark-tremor-border">
                <div className="flex items-center space-x-2">
                    <span className="text-emerald-400 text-sm font-semibold">✓</span>
                    <Text className="text-sm text-slate-300">No alternative rerouting needed — port is within acceptable parameters.</Text>
                </div>
            </div>
        );
    }

    return (
        <div className="mt-5 pt-4 border-t border-dark-tremor-border">
            <h4 className="text-sm font-semibold text-rose-400 mb-3 flex items-center space-x-1">
                <span>⚠</span>
                <span>Suggested Rerouting Alternatives</span>
            </h4>
            <div className="grid grid-cols-3 gap-3">
                {recs.map((r) => (
                    <div
                        key={r.port_id}
                        className="rounded-lg border border-dark-tremor-border bg-dark-tremor-background-subtle p-3 transition-all hover:border-slate-500"
                    >
                        <p className="text-sm font-semibold text-slate-200 truncate">{r.port_name}</p>
                        <p className="text-xs text-slate-400 mt-1">{r.distance_km} km away</p>
                        <div className="flex items-center mt-2 space-x-1.5">
                            <div
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: getLoadColor(r.predicted_calls) }}
                            />
                            <span
                                className="text-xs font-bold"
                                style={{ color: getLoadColor(r.predicted_calls) }}
                            >
                                {r.predicted_calls} avg calls
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function AnomalyChartModal({ isOpen, onClose, portName, data }: AnomalyChartModalProps) {
    const [searchParams, setSearchParams] = useSearchParams();

    const handleDeepDive = () => {
        onClose(); // Close the modal
        const newParams = new URLSearchParams(searchParams);
        newParams.set("deepdive", portName);
        setSearchParams(newParams);
    };

    // Transform data for the chart
    // We want to show: Predicted, Mean, Upper Limit (Mean + 2*Std), Lower Limit (Mean - 2*Std)
    // 1. Normalize dates and sort strictly ascending (Oldest -> Newest)
    const sortedData = [...data].sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateA.getTime() - dateB.getTime();
    });

    // 2. Map to chart format
    const chartData = sortedData.map(d => ({
        date: d.date,
        "Predicted Calls": d.predicted_calls,
        "Baseline (Mean)": d.rolling_mean_7,
        "Upper Limit (Mean + 2σ)": d.upper_bound,
    }));

    // Determine if any record for this port is High or Anomalous
    const hasElevatedStatus = data.some(d => d.status === "High" || d.status === "Anomalous");

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/60" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4 text-center">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-dark-tremor-background p-6 text-left align-middle shadow-xl transition-all border border-dark-tremor-border">
                                <div className="flex justify-between items-center mb-4">
                                    <div>
                                        <Dialog.Title
                                            as="h3"
                                            className="text-lg font-medium leading-6 text-slate-200"
                                        >
                                            Predicted Traffic vs Statistical Baseline — {portName}
                                        </Dialog.Title>
                                        <Text>Visualizing anomaly context over the last 7 days</Text>
                                    </div>
                                    <button
                                        onClick={onClose}
                                        className="rounded-full p-1 hover:bg-dark-tremor-background-subtle text-dark-tremor-content-subtle transition-colors"
                                    >
                                        <XMarkIcon className="h-6 w-6" />
                                    </button>
                                </div>

                                <div className="mt-4">
                                    {chartData.length < 3 ? (
                                        <div className="h-72 flex items-center justify-center border border-dashed border-dark-tremor-border rounded-lg">
                                            <Text>Not enough historical data to render trend.</Text>
                                        </div>
                                    ) : (
                                        <LineChart
                                            className="h-72"
                                            data={chartData}
                                            index="date"
                                            categories={["Predicted Calls", "Baseline (Mean)", "Upper Limit (Mean + 2σ)"]}
                                            colors={["blue", "cyan", "rose"]}
                                            valueFormatter={valueFormatter}
                                            yAxisWidth={40}
                                            showAnimation={true}
                                            showLegend={true}
                                        />
                                    )}
                                </div>

                                {/* Rerouting Suggestions — only for High/Anomalous ports */}
                                <RerouteSection portName={portName} show={isOpen && hasElevatedStatus} />

                                <div className="mt-6 flex justify-end border-t border-dark-tremor-border pt-4">
                                    <button
                                        onClick={handleDeepDive}
                                        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                                    >
                                        View Full Port Analysis →
                                    </button>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}

