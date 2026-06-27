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
} from "@tremor/react";
import { useEffect, useState } from "react";

interface Prediction {
    date: string;
    port: string;
    region: string;
    actual: number | null;
    predicted: number;
}

export default function Predictions() {
    const [data, setData] = useState<Prediction[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("http://localhost:8000/api/predictions")
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

    if (loading) return <Text>Loading forecasts...</Text>;

    return (
        <Card>
            <Flex justifyContent="between" alignItems="start" className="mb-2">
                <div>
                    <Title>Daily Port Predictions</Title>
                    <Text>Forecasted call volumes vs actuals (Latest 100 records)</Text>
                </div>
                <Badge color="blue" size="xs">Auto-refreshed (≤5 min delay)</Badge>
            </Flex>
            <Table className="mt-5">
                <TableHead>
                    <TableRow>
                        <TableHeaderCell>Date</TableHeaderCell>
                        <TableHeaderCell>Port</TableHeaderCell>
                        <TableHeaderCell>Region</TableHeaderCell>
                        <TableHeaderCell>Actual</TableHeaderCell>
                        <TableHeaderCell>Predicted</TableHeaderCell>
                        <TableHeaderCell>Delta</TableHeaderCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {data.map((item, idx) => {
                        const isFuture = item.actual === null;
                        const delta = item.actual !== null ? item.predicted - item.actual : 0;
                        const deltaColor =
                            Math.abs(delta) < 5 ? "gray" : delta > 0 ? "rose" : "emerald";

                        return (
                            <TableRow key={idx} className={isFuture ? "opacity-75" : ""}>
                                <TableCell>
                                    <Text className={isFuture ? "text-gray-500" : ""}>
                                        {item.date}
                                        {isFuture && <span className="ml-2 text-xs text-blue-500">(Forecast)</span>}
                                    </Text>
                                </TableCell>
                                <TableCell>
                                    <Text className={`font-medium ${isFuture ? "text-gray-500" : "text-ocean"}`}>{item.port}</Text>
                                </TableCell>
                                <TableCell>{item.region}</TableCell>
                                <TableCell>
                                    {item.actual !== null ? (
                                        item.actual
                                    ) : (
                                        <Text className="text-gray-400 italic">Pending</Text>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <Text className="font-bold">{item.predicted}</Text>
                                </TableCell>
                                <TableCell>
                                    {item.actual !== null ? (
                                        <Badge color={deltaColor} size="xs">
                                            {delta > 0 ? "+" : ""}
                                            {delta}
                                        </Badge>
                                    ) : (
                                        <Text className="text-gray-400 italic">N/A</Text>
                                    )}
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </Card>
    );
}
