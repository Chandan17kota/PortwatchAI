import { Card, Metric, Text, Flex, Grid, Badge } from "@tremor/react";
import { useEffect, useState } from "react";

interface KPIData {
    totalPredictedCalls: number;
    avgDailyCalls: number;
    topPort: string;
    modelMae: number;
}

interface AnomaliesResponse {
    data: { status: string }[];
}

export default function KPICards() {
    const [data, setData] = useState<KPIData | null>(null);
    const [anomalyCount, setAnomalyCount] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Fetch KPIs and anomalies independently so one failure doesn't block the other
        fetch("http://localhost:8000/api/kpis")
            .then((res) => res.json())
            .then((kpiData) => {
                console.log("KPI data:", kpiData);
                setData(kpiData);
                setLoading(false);
            })
            .catch((err) => {
                console.error("Failed to fetch KPI data:", err);
                setLoading(false);
            });

        fetch("http://localhost:8000/api/anomalies")
            .then((res) => {
                if (!res.ok) throw new Error(`Anomalies API error: ${res.status}`);
                return res.json();
            })
            .then((anomalyData) => {
                console.log("Congestion data:", anomalyData);
                const count = (anomalyData as AnomaliesResponse).data.filter(
                    (d) => d.status === "Anomalous"
                ).length;
                setAnomalyCount(count);
            })
            .catch((err) => {
                console.error("Failed to fetch anomaly data:", err);
                setAnomalyCount(0);
            });
    }, []);

    if (loading || !data) {
        return (
            <Grid numItems={1} numItemsSm={2} numItemsLg={4} className="gap-6">
                {[1, 2, 3, 4].map((i) => (
                    <Card key={i} className="animate-pulse h-32 bg-gray-50" />
                ))}
            </Grid>
        );
    }

    const cards = [
        {
            title: "Ports Under Congestion",
            metric: anomalyCount?.toString() ?? "-",
            subtext: "Anomalous levels (7-day)",
            trend: anomalyCount && anomalyCount > 0 ? "Critical" : "Stable",
            trendColor: anomalyCount && anomalyCount > 0 ? "rose" : "emerald",
        },
        {
            title: "Total Predicted Calls",
            metric: data.totalPredictedCalls.toLocaleString(),
            subtext: "Next 30 days",
            trend: "+6.2%",
            trendColor: "emerald",
        },
        {
            title: "Average Daily Calls",
            metric: data.avgDailyCalls.toString(),
            subtext: "Rolling mean",
            trend: "+1.1%",
            trendColor: "emerald",
        },
        {
            title: "Top Active Port",
            metric: data.topPort,
            subtext: "Highest volume",
            trend: "Neutral",
            trendColor: "gray",
        },
    ];

    return (
        <Grid numItems={1} numItemsSm={2} numItemsLg={4} className="gap-6">
            {cards.map((item) => (
                <Card key={item.title} decoration="top" decorationColor={item.trendColor}>
                    <Flex justifyContent="start" alignItems="center" className="space-x-2">
                        <Text>{item.title}</Text>
                    </Flex>

                    <Flex justifyContent="between" alignItems="baseline" className="space-x-3 truncate">
                        <Metric>{item.metric}</Metric>
                        <Badge color={item.trendColor} size="xs">
                            {item.trend}
                        </Badge>
                    </Flex>

                    <Text className="mt-1">{item.subtext}</Text>
                </Card>
            ))}
        </Grid>
    );
}
