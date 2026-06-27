import { Fragment, useEffect, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { Text, Badge, LineChart, Card, CategoryBar, Divider } from "@tremor/react";
import { useSearchParams } from "react-router-dom";
import portMetadataFull from "../data/port_metadata.json";

interface PortMetadata {
    type: string;
    region: string;
    importance: string;
    cargo: {
        containers: number;
        bulk: number;
        liquid: number;
    };
}

const metadataMap = portMetadataFull as Record<string, PortMetadata>;

interface DeepDiveData {
    congestionScore: number | null;
    currentCalls: number | null;
    predictions: any[];
    anomaly: any | null;
    reroutes: any[];
    loading: boolean;
}

const getLoadColor = (load: number): string => {
    if (load >= 25) return "#ef4444";  // red
    if (load >= 15) return "#f59e0b";  // yellow
    return "#22c55e";                   // green
};

const getStatusColor = (status: string) => {
    switch (status) {
        case "Anomalous": return "rose";
        case "High": return "orange";
        case "Normal": return "emerald";
        default: return "slate";
    }
};

export default function PortDeepDivePanel() {
    const [searchParams, setSearchParams] = useSearchParams();
    const portName = searchParams.get("deepdive");
    
    const [data, setData] = useState<DeepDiveData>({
        congestionScore: null,
        currentCalls: null,
        predictions: [],
        anomaly: null,
        reroutes: [],
        loading: false
    });

    useEffect(() => {
        if (!portName) return;
        
        let isMounted = true;
        setData(prev => ({ ...prev, loading: true }));

        const fetchData = async () => {
            try {
                // Fetch all data in parallel to eliminate sequential loading lag
                const [mapRes, predRes, anomalyRes, rerouteRes] = await Promise.all([
                    fetch("http://localhost:8000/api/map-data"),
                    fetch("http://localhost:8000/api/predictions"),
                    fetch("http://localhost:8000/api/anomalies?limit=0"),
                    fetch(`http://localhost:8000/api/reroute?port_name=${encodeURIComponent(portName)}&force=true`)
                ]);

                const [mapData, predData, anomalyData, rerouteData] = await Promise.all([
                    mapRes.json(),
                    predRes.json(),
                    anomalyRes.json(),
                    rerouteRes.json()
                ]);

                const portMap = mapData.find((p: any) => p.port_name === portName);
                const portPreds = predData.filter((p: any) => p.port === portName);
                
                // Sort predictions and take roughly last 30 + next 7
                const sortedPreds = portPreds.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
                const chartData = sortedPreds.slice(-37).map((d: any) => ({
                    date: d.date,
                    "Actual Calls": d.actual,
                    "Predicted Calls": d.predicted
                }));
                
                // Get the most recent anomaly status for this port
                const portAnomalies = anomalyData.data.filter((a: any) => a.port === portName);
                const latestAnomaly = portAnomalies.length > 0 ? portAnomalies[0] : null;

                if (isMounted) {
                    setData({
                        congestionScore: portMap?.congestion_score ?? null,
                        currentCalls: portMap?.current_value ?? null,
                        predictions: chartData,
                        anomaly: latestAnomaly,
                        reroutes: rerouteData.recommendations || [],
                        loading: false
                    });
                }
            } catch (error) {
                console.error("Failed to fetch deep dive data", error);
                if (isMounted) setData(prev => ({ ...prev, loading: false }));
            }
        };

        fetchData();

        return () => { isMounted = false; };
    }, [portName]);

    const closePanel = () => {
        const newParams = new URLSearchParams(searchParams);
        newParams.delete("deepdive");
        setSearchParams(newParams);
    };

    if (!portName) return null;

    const meta = metadataMap[portName] || {
        type: "Mixed",
        region: "Unknown",
        importance: "Regional trade port.",
        cargo: { containers: 40, bulk: 30, liquid: 30 }
    };

    const isOpen = !!portName;
    const { loading, congestionScore, currentCalls, predictions, anomaly, reroutes } = data;

    // Derived Operational Insights
    const getInsights = () => {
        if (!anomaly) return ["Monitoring traffic for baseline variations."];
        const insights = [];
        if (anomaly.status === "Anomalous") {
            insights.push(`High congestion risk due to traffic exceeding 7-day baseline by ${anomaly.severity_score}σ.`);
            insights.push("Immediate payload diversion to alternative ports is recommended.");
        } else if (anomaly.status === "High") {
            insights.push("Elevated traffic levels detected compared to historical bounds.");
            insights.push("Review transit schedules and prioritize essential cargo.");
        } else {
            insights.push("Port operations are running within expected historical parameters.");
            if (anomaly.trend === "Increasing") {
                insights.push("Traffic is trending upwards. Monitor for potential delays over next 3 days.");
            }
        }
        return insights;
    };

    return (
        <Transition.Root show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-[100]" onClose={closePanel}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-in-out duration-500"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in-out duration-500"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/60 transition-opacity" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-hidden">
                    <div className="absolute inset-0 overflow-hidden">
                        <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
                            <Transition.Child
                                as={Fragment}
                                enter="transform transition ease-in-out duration-500 sm:duration-700"
                                enterFrom="translate-x-full"
                                enterTo="translate-x-0"
                                leave="transform transition ease-in-out duration-500 sm:duration-700"
                                leaveFrom="translate-x-0"
                                leaveTo="translate-x-full"
                            >
                                <Dialog.Panel className="pointer-events-auto w-screen max-w-md">
                                    <div className="flex h-full flex-col overflow-y-scroll bg-dark-tremor-background border-l border-dark-tremor-border shadow-2xl py-6">
                                        <div className="px-4 sm:px-6">
                                            <div className="flex items-start justify-between">
                                                <Dialog.Title className="text-xl font-bold leading-6 text-slate-100">
                                                    {portName}
                                                </Dialog.Title>
                                                <div className="ml-3 flex h-7 items-center">
                                                    <button
                                                        type="button"
                                                        className="rounded-md bg-dark-tremor-background text-slate-400 hover:text-slate-200 focus:outline-none"
                                                        onClick={closePanel}
                                                    >
                                                        <span className="sr-only">Close panel</span>
                                                        <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="mt-2">
                                                <div className="flex space-x-2">
                                                    <Badge color="blue">{meta.region}</Badge>
                                                    <Badge color="zinc">{meta.type}</Badge>
                                                </div>
                                                <Text className="mt-2 text-sm text-slate-400">{meta.importance}</Text>
                                            </div>
                                        </div>

                                        <Divider />

                                        {loading ? (
                                            <div className="px-4 py-6 flex justify-center text-slate-400"><p className="animate-pulse">Loading port intelligence...</p></div>
                                        ) : (
                                            <div className="relative mt-2 flex-1 px-4 sm:px-6 space-y-8">
                                                
                                                {/* Overview */}
                                                <div>
                                                    <h3 className="text-sm border-l-2 border-ocean pl-2 font-semibold text-slate-300 mb-4 uppercase tracking-wider">Current Status</h3>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <Card decoration="top" decorationColor="blue" className="bg-dark-tremor-background-subtle py-3 px-4">
                                                            <Text className="text-xs">Current Calls</Text>
                                                            <p className="text-xl font-bold text-slate-100">{currentCalls ?? '--'}</p>
                                                        </Card>
                                                        <Card decoration="top" decorationColor={congestionScore && congestionScore > 0.7 ? "red" : "emerald"} className="bg-dark-tremor-background-subtle py-3 px-4">
                                                            <Text className="text-xs">Congestion</Text>
                                                            <p className="text-xl font-bold text-slate-100">
                                                                {congestionScore !== null ? (congestionScore * 100).toFixed(0) + '%' : '--'}
                                                            </p>
                                                        </Card>
                                                    </div>
                                                </div>

                                                {/* Traffic Analytics */}
                                                <div>
                                                    <h3 className="text-sm border-l-2 border-emerald-500 pl-2 font-semibold text-slate-300 mb-3 uppercase tracking-wider">Traffic Analytics</h3>
                                                    <Card className="bg-dark-tremor-background-subtle py-3 px-4">
                                                        <Text className="text-xs mb-2">30-Day Actual vs Predicted</Text>
                                                        {predictions.length > 0 ? (
                                                            <LineChart
                                                                className="h-40"
                                                                data={predictions}
                                                                index="date"
                                                                categories={["Actual Calls", "Predicted Calls"]}
                                                                colors={["teal", "blue"]}
                                                                yAxisWidth={30}
                                                                showLegend={false}
                                                                showAnimation={true}
                                                            />
                                                        ) : (
                                                            <div className="h-40 flex items-center justify-center border border-dashed border-dark-tremor-border">
                                                                <Text className="text-xs">No chart data</Text>
                                                            </div>
                                                        )}
                                                    </Card>
                                                </div>

                                                {/* Congestion Intelligence */}
                                                {anomaly && (
                                                    <div>
                                                        <h3 className="text-sm border-l-2 border-rose-500 pl-2 font-semibold text-slate-300 mb-3 uppercase tracking-wider">Congestion Intelligence</h3>
                                                        <Card className="bg-dark-tremor-background-subtle py-3 px-4">
                                                            <div className="flex justify-between items-center mb-3">
                                                                <Text className="font-medium text-slate-200">Status</Text>
                                                                <Badge color={getStatusColor(anomaly.status)}>{anomaly.status}</Badge>
                                                            </div>
                                                            <Text className="text-xs text-slate-400 mb-4">{anomaly.explanation}</Text>
                                                            
                                                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-dark-tremor-border">
                                                                <div>
                                                                    <Text className="text-xs">7-Day Baseline</Text>
                                                                    <p className="text-base font-semibold text-slate-200">{anomaly.rolling_mean_7?.toFixed(1)} calls</p>
                                                                </div>
                                                                <div>
                                                                    <Text className="text-xs">Upper Tolerance Limit</Text>
                                                                    <p className="text-base font-semibold text-slate-200">{anomaly.upper_bound?.toFixed(1)} calls</p>
                                                                </div>
                                                            </div>
                                                        </Card>
                                                    </div>
                                                )}

                                                {/* Cargo Profile */}
                                                <div>
                                                    <h3 className="text-sm border-l-2 border-yellow-500 pl-2 font-semibold text-slate-300 mb-3 uppercase tracking-wider">Cargo Profile</h3>
                                                    <Card className="bg-dark-tremor-background-subtle py-4 px-4">
                                                        <CategoryBar
                                                            values={[meta.cargo.containers, meta.cargo.bulk, meta.cargo.liquid]}
                                                            colors={["blue", "gray", "amber"]}
                                                            showLabels={false}
                                                            className="mb-2"
                                                        />
                                                        <div className="flex justify-between text-xs mt-3 text-slate-100">
                                                            <span className="flex items-center"><div className="w-2 h-2 rounded-full bg-blue-500 mr-1" /> Containers ({meta.cargo.containers}%)</span>
                                                            <span className="flex items-center"><div className="w-2 h-2 rounded-full bg-gray-400 mr-1" /> Bulk ({meta.cargo.bulk}%)</span>
                                                            <span className="flex items-center"><div className="w-2 h-2 rounded-full bg-amber-500 mr-1" /> Liquid ({meta.cargo.liquid}%)</span>
                                                        </div>
                                                    </Card>
                                                </div>

                                                {/* Rerouting */}
                                                {reroutes && reroutes.length > 0 && (
                                                    <div>
                                                        <h3 className="text-sm border-l-2 border-indigo-500 pl-2 font-semibold text-slate-300 mb-3 uppercase tracking-wider">Suggested Rerouting</h3>
                                                        <div className="space-y-2">
                                                            {reroutes.map(r => (
                                                                <div key={r.port_id} className="rounded-lg border border-dark-tremor-border bg-dark-tremor-background p-3 flex justify-between items-center">
                                                                    <div>
                                                                        <p className="text-sm font-semibold text-slate-200">{r.port_name}</p>
                                                                        <p className="text-xs text-slate-400">{r.distance_km} km away</p>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <span className="text-sm font-bold block" style={{ color: getLoadColor(r.predicted_calls) }}>
                                                                            {r.predicted_calls}
                                                                        </span>
                                                                        <span className="text-[10px] text-slate-500 uppercase tracking-widest">Calls</span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Insights */}
                                                <div className="mb-8">
                                                    <h3 className="text-sm border-l-2 border-purple-500 pl-2 font-semibold text-slate-300 mb-3 uppercase tracking-wider">Operational Insights</h3>
                                                    <Card className="bg-dark-tremor-background-subtle py-3 px-4 border-l-[3px] border-l-purple-500/50">
                                                        <ul className="list-disc pl-4 space-y-2 text-sm text-slate-300">
                                                            {getInsights().map((insight, idx) => (
                                                                <li key={idx}>{insight}</li>
                                                            ))}
                                                            <li>Port configuration strongly optimized for {meta.cargo.containers > 50 ? 'containerized' : meta.cargo.bulk > 50 ? 'dry bulk' : 'mixed'} cargo handling.</li>
                                                        </ul>
                                                    </Card>
                                                </div>

                                            </div>
                                        )}
                                    </div>
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </div>
            </Dialog>
        </Transition.Root>
    );
}
