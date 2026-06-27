import { Card, Title, Text, Flex } from "@tremor/react";
import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush } from 'recharts';

const dataFormatter = (number: number) => {
    if (number === null || number === undefined) return "0";
    return `${Intl.NumberFormat("us").format(number).toString()}`;
};

interface TrendData {
    date: string;
    actual: number | null;
    predicted: number;
}

export default function TrafficTrendChart() {
    const [data, setData] = useState<TrendData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("http://localhost:8000/api/trends")
            .then((res) => res.json())
            .then((json) => {
                setData(json);
                setLoading(false);
            })
            .catch((err) => {
                console.error("Failed to fetch trends:", err);
                setLoading(false);
            });
    }, []);

    if (loading) {
        return <Card className="h-96 animate-pulse bg-gray-50 flex items-center justify-center"><Text>Loading Forecast...</Text></Card>;
    }

    return (
        <Card>
            <Flex justifyContent="start" alignItems="center" className="mb-2">
                <div>
                    <Title>Forecasted Port Traffic</Title>
                    <Text>Actual vs predicted daily port calls (Zoomable)</Text>
                </div>
            </Flex>
            <div className="mt-6 h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" tick={{fontSize: 12}} minTickGap={30} />
                        <YAxis tickFormatter={dataFormatter} tick={{fontSize: 12}} width={40} />
                        <Tooltip formatter={(value: number) => dataFormatter(value)} />
                        <Legend />
                        <Line type="monotone" dataKey="actual" stroke="#3b82f6" strokeWidth={2} dot={false} connectNulls />
                        <Line type="monotone" dataKey="predicted" stroke="#06b6d4" strokeWidth={2} dot={false} connectNulls />
                        <Brush dataKey="date" height={30} stroke="#8884d8" />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </Card>
    );
}
