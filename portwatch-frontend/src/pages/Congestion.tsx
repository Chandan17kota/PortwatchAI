import {
    Card,
    Table,
    TableHead,
    TableRow,
    TableHeaderCell,
    TableBody,
    TableCell,
    Text,
    Title,
    Badge,
    Flex,
    TabGroup,
    TabList,
    Tab,
    Icon,
} from "@tremor/react";
import { useEffect, useState } from "react";
import { InformationCircleIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon, MinusIcon, ChartBarSquareIcon } from "@heroicons/react/24/outline";
import AnomalyChartModal from "../components/AnomalyChartModal";

interface AnomalyData {
    date: string;
    port: string;
    predicted_calls: number;
    rolling_mean_7: number;
    upper_bound: number;
    mean: number;
    std: number;
    status: "Normal" | "High" | "Anomalous";
    severity_score?: number;
    trend?: "Increasing" | "Stable" | "Decreasing";
    explanation?: string;
}

interface AnomaliesResponse {
    window_days: number;
    count: number;
    data: AnomalyData[];
}

export default function Congestion() {
    const [allData, setAllData] = useState<AnomalyData[]>([]);
    const [filteredData, setFilteredData] = useState<AnomalyData[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterIndex, setFilterIndex] = useState(0); // 0: All, 1: High+Anomalous, 2: Anomalous

    // Modal State
    const [selectedPort, setSelectedPort] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        fetch("http://localhost:8000/api/anomalies")
            .then((res) => res.json())
            .then((json: AnomaliesResponse) => {
                setAllData(json.data);
                setFilteredData(json.data);
                setLoading(false);
            })
            .catch((err) => {
                console.error("Failed to fetch anomalies:", err);
                setLoading(false);
            });
    }, []);

    useEffect(() => {
        let newData = [...allData];

        if (filterIndex === 1) {
            // High + Anomalous
            newData = newData.filter((d) => d.status === "High" || d.status === "Anomalous");
        } else if (filterIndex === 2) {
            // Anomalous only
            newData = newData.filter((d) => d.status === "Anomalous");
        }

        // Sort by Severity (Anomalous > High > Normal) then by predicted_calls desc
        const severityMap = { Anomalous: 3, High: 2, Normal: 1 };
        newData.sort((a, b) => {
            const sevA = severityMap[a.status];
            const sevB = severityMap[b.status];
            if (sevA !== sevB) return sevB - sevA; // Higher severity first
            return b.predicted_calls - a.predicted_calls;
        });

        setFilteredData(newData);
    }, [filterIndex, allData]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case "Anomalous":
                return "rose"; // Red
            case "High":
                return "orange"; // Orange
            default:
                return "emerald"; // Green
        }
    };

    const getSeverityColor = (score: number) => {
        if (score >= 2.0) return "text-rose-600";
        if (score >= 1.0) return "text-orange-500";
        return "text-emerald-600";
    };

    const renderTrend = (trend: string) => {
        switch (trend) {
            case "Increasing":
                return <Flex justifyContent="start" className="space-x-1"><ArrowTrendingUpIcon className="h-4 w-4 text-rose-500" /><Text>Inc</Text></Flex>;
            case "Decreasing":
                return <Flex justifyContent="start" className="space-x-1"><ArrowTrendingDownIcon className="h-4 w-4 text-emerald-500" /><Text>Dec</Text></Flex>;
            default: // Stable
                return <Flex justifyContent="start" className="space-x-1"><MinusIcon className="h-4 w-4 text-gray-400" /><Text>Stable</Text></Flex>;
        }
    };

    const handleRowClick = (port: string) => {
        setSelectedPort(port);
        setIsModalOpen(true);
    };

    // Get specific port data for the modal
    const portData = selectedPort ? allData.filter(d => d.port === selectedPort) : [];

    if (loading) return <Text>Loading congestion analysis...</Text>;

    return (
        <div className="space-y-6">
            <Title>Port Congestion Analysis</Title>
            <Text>Anomaly detection based on 7-day rolling average. Click a row to view trend analysis.</Text>

            <Flex justifyContent="start" className="space-x-4">
                <TabGroup index={filterIndex} onIndexChange={setFilterIndex}>
                    <TabList>
                        <Tab>All Records</Tab>
                        <Tab>Potential Congestion</Tab>
                        <Tab>Anomalies Only</Tab>
                    </TabList>
                </TabGroup>
            </Flex>

            <Card className="p-0 overflow-hidden">
                <Table className="mt-0">
                    <TableHead>
                        <TableRow>
                            <TableHeaderCell>Date</TableHeaderCell>
                            <TableHeaderCell>Port</TableHeaderCell>
                            <TableHeaderCell>Predicted</TableHeaderCell>
                            <TableHeaderCell>Mean / Std</TableHeaderCell>
                            <TableHeaderCell>Severity (σ)</TableHeaderCell>
                            <TableHeaderCell>Trend</TableHeaderCell>
                            <TableHeaderCell>Status</TableHeaderCell>
                            <TableHeaderCell>Info</TableHeaderCell>
                            <TableHeaderCell></TableHeaderCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filteredData.map((item, idx) => (
                            <TableRow
                                key={idx}
                                className="hover:bg-dark-tremor-background-subtle/50 cursor-pointer transition-colors"
                                onClick={() => handleRowClick(item.port)}
                            >
                                <TableCell>{item.date}</TableCell>
                                <TableCell>
                                    <Text className="font-medium text-ocean">{item.port}</Text>
                                </TableCell>
                                <TableCell>
                                    <Text className="font-bold">{item.predicted_calls}</Text>
                                </TableCell>
                                <TableCell>
                                    <Text className="text-xs text-gray-500">
                                        {item.mean} / ±{item.std}
                                    </Text>
                                </TableCell>
                                <TableCell>
                                    <Text className={`font-bold ${getSeverityColor(item.severity_score || 0)}`}>
                                        {item.severity_score?.toFixed(2) ?? "-"}
                                    </Text>
                                </TableCell>
                                <TableCell>
                                    {item.trend ? renderTrend(item.trend) : "-"}
                                </TableCell>
                                <TableCell>
                                    <Badge color={getStatusColor(item.status)} size="xs">
                                        {item.status}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    {item.explanation && (
                                        <div className="group relative flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                                            <Icon
                                                icon={InformationCircleIcon}
                                                variant="simple"
                                                color="slate"
                                                className="cursor-help"
                                            />
                                            {/* Custom Tooltip */}
                                            <div className="absolute right-full top-1/2 z-50 mr-2 hidden w-max max-w-[280px] -translate-y-1/2 flex-col rounded-md bg-slate-800 px-3 py-2 text-left text-xs text-slate-100 shadow-xl border border-slate-600 group-hover:flex whitespace-normal break-words">
                                                <span className="relative z-10 leading-relaxed">
                                                    {item.explanation}
                                                </span>
                                                {/* Arrow pointing right */}
                                                <div className="absolute top-1/2 -right-1 h-2 w-2 -translate-y-1/2 rotate-45 bg-slate-800 border-r border-t border-slate-600"></div>
                                            </div>
                                        </div>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <Icon icon={ChartBarSquareIcon} size="md" variant="simple" color="slate" className="hover:text-blue-500 transition-colors" />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                {filteredData.length === 0 && (
                    <Text className="text-center mt-6 mb-6">No records found matching criteria.</Text>
                )}
            </Card>

            <AnomalyChartModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                portName={selectedPort || ""}
                data={portData}
            />
        </div>
    );
}
