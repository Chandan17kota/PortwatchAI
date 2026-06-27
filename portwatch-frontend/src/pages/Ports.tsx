import { Card, Grid, Title, Text, Metric, Flex, BadgeDelta } from "@tremor/react";
import { useEffect, useState } from "react";

interface PortSummary {
    port: string;
    region: string;
    total_calls: number;
    avg_daily: number;
    trend: string;
}

export default function Ports() {
    const [data, setData] = useState<PortSummary[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("http://localhost:8000/api/ports")
            .then((res) => res.json())
            .then((data) => {
                setData(data);
                setLoading(false);
            })
            .catch((err) => {
                console.error(err);
                setLoading(false);
            });
    }, []);

    if (loading) return <Text>Loading port details...</Text>;

    return (
        <>
            <Title>Port Performance</Title>
            <Text>Aggregated stats by terminal</Text>

            <Grid numItems={1} numItemsSm={2} numItemsLg={3} className="gap-6 mt-6">
                {data.map((item) => (
                    <Card key={item.port} decoration="top" decorationColor="blue">
                        <Flex justifyContent="between" alignItems="center">
                            <Text>{item.region}</Text>
                            <BadgeDelta deltaType="moderateIncrease" size="xs">
                                {item.trend}
                            </BadgeDelta>
                        </Flex>
                        <Metric className="mt-2">{item.port}</Metric>

                        <Flex className="mt-4 space-x-2">
                            <div>
                                <Text className="text-xs uppercase font-bold text-gray-500 tracking-wider">Total Calls</Text>
                                <Metric>{item.total_calls.toLocaleString()}</Metric>
                            </div>
                            <div className="border-l pl-4 border-gray-200">
                                <Text className="text-xs uppercase font-bold text-gray-500 tracking-wider">Avg Daily</Text>
                                <Metric>{item.avg_daily}</Metric>
                            </div>
                        </Flex>
                    </Card>
                ))}
            </Grid>
        </>
    );
}
