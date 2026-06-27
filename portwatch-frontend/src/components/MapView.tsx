import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { useSearchParams } from "react-router-dom";
import "leaflet/dist/leaflet.css";

interface PortData {
    port_id: string;
    port_name: string;
    lat: number;
    lon: number;
    congestion_score: number;
    current_value: number;
    predicted_7d_avg: number;
}

interface RerouteRec {
    port_id: string;
    port_name: string;
    distance_km: number;
    predicted_calls: number;
    congestion_score: number;
}

const getMarkerColor = (score: number) => {
    if (score > 0.8) return "#ef4444"; // red
    if (score > 0.5) return "#f97316"; // orange
    return "#22c55e"; // green
};

const ReroutePanel = ({ portId }: { portId: string }) => {
    const [recs, setRecs] = useState<RerouteRec[] | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        fetch(`http://localhost:8000/api/reroute?port=${portId}`)
            .then((res) => res.json())
            .then((data) => {
                setRecs(data.recommendations || []);
                setLoading(false);
            })
            .catch(() => {
                setRecs([]);
                setLoading(false);
            });
    }, [portId]);

    if (loading) {
        return <p className="text-xs text-gray-400 mt-2 animate-pulse">Checking alternatives…</p>;
    }

    if (!recs || recs.length === 0) {
        return (
            <div className="mt-2 pt-2 border-t border-slate-200">
                <p className="text-xs text-emerald-600 font-medium">✓ No rerouting needed</p>
            </div>
        );
    }

    return (
        <div className="mt-2 pt-2 border-t border-slate-200">
            <p className="text-xs font-bold text-rose-600 mb-1">⚠ Recommended Alternatives</p>
            <table className="text-xs w-full">
                <thead>
                    <tr className="text-gray-500">
                        <th className="text-left font-medium pr-2">Port</th>
                        <th className="text-right font-medium pr-2">Dist</th>
                        <th className="text-right font-medium">Load</th>
                    </tr>
                </thead>
                <tbody>
                    {recs.map((r) => (
                        <tr key={r.port_id}>
                            <td className="pr-2 font-semibold text-blue-700">{r.port_name}</td>
                            <td className="text-right pr-2 text-gray-600">{r.distance_km} km</td>
                            <td className="text-right" style={{ color: getMarkerColor(r.congestion_score) }}>
                                {r.predicted_calls}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const MapView = () => {
    const [ports, setPorts] = useState<PortData[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchParams, setSearchParams] = useSearchParams();

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch("http://localhost:8000/api/map-data");
                if (!response.ok) throw new Error("Backend not available");
                const data = await response.json();
                console.log("Total ports fetched:", data.length);
                setPorts(data);
            } catch (error) {
                console.error("Map data fetch failed:", error);
                setPorts([]);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    console.log("Total ports rendering:", ports.length);

    return (
        <div className="w-full h-full rounded-xl overflow-hidden border border-slate-700/50 shadow-2xl bg-[#0B1229]">
            <MapContainer
                center={[20, 0]}
                zoom={2}
                scrollWheelZoom={true}
                className="h-full w-full z-0"
                style={{ height: "100%", width: "100%" }}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {!loading && ports.map((port) => (
                    <CircleMarker
                        key={port.port_id}
                        center={[port.lat, port.lon]}
                        radius={5 + port.current_value * 0.1}
                        pathOptions={{
                            color: getMarkerColor(port.congestion_score),
                            fillColor: getMarkerColor(port.congestion_score),
                            fillOpacity: 0.7,
                            weight: 2,
                        }}
                    >
                        <Popup minWidth={220} maxWidth={300}>
                            <div className="p-1">
                                <h3 className="font-bold text-lg">{port.port_name}</h3>
                                <div className="space-y-1 mt-2">
                                    <p className="text-sm">Current Vessels: <span className="font-semibold text-ocean">{port.current_value}</span></p>
                                    <p className="text-sm">Congestion: <span className="font-semibold" style={{ color: getMarkerColor(port.congestion_score) }}>{(port.congestion_score * 100).toFixed(0)}%</span></p>
                                    <p className="border-t border-slate-200 pt-1 text-sm font-medium">7-Day Forecast: <span className="text-teal">{port.predicted_7d_avg} avg</span></p>
                                </div>
                                <ReroutePanel portId={port.port_id} />
                                <button
                                    onClick={() => {
                                        const newParams = new URLSearchParams(searchParams);
                                        newParams.set("deepdive", port.port_name);
                                        setSearchParams(newParams);
                                    }}
                                    className="mt-3 w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                                >
                                    Port Deep Dive →
                                </button>
                            </div>
                        </Popup>
                    </CircleMarker>
                ))}
            </MapContainer>
        </div>
    );
};

export default MapView;

