import {
    Card,
    Grid,
    Title,
    Text,
    BarList,
    Table,
    TableHead,
    TableRow,
    TableHeaderCell,
    TableBody,
    TableCell,
    Badge,
} from "@tremor/react";
import { useEffect, useState } from "react";

interface RegionData {
    name: string;
    value: number;
}

interface PortData {
    rank: number;
    port: string;
    calls: number;
    status: string;
}

const getBadgeColor = (status: string) => {
    switch (status) {
        case "High":
            return "rose";
        case "Medium":
            return "orange";
        case "Normal":
            return "emerald";
        default:
            return "gray";
    }
};

export default function RegionalActivity() {
    const [regions, setRegions] = useState<RegionData[]>([]);
    const [ports, setPorts] = useState<PortData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            fetch("http://localhost:8000/api/regions").then((res) => res.json()),
            fetch("http://localhost:8000/api/top-ports").then((res) => res.json()),
        ])
            .then(([regionsData, portsData]) => {
                setRegions(regionsData);
                setPorts(portsData);
                setLoading(false);
            })
            .catch((err) => {
                console.error("Failed to fetch regional data:", err);
                setLoading(false);
            });
    }, []);

    if (loading) {
        return (
            <Grid numItems={1} numItemsLg={2} className="gap-6">
                <Card className="h-64 animate-pulse bg-gray-50" />
                <Card className="h-64 animate-pulse bg-gray-50" />
            </Grid>
        );
    }

    return (
        <Grid numItems={1} numItemsLg={2} className="gap-6">
            {/* Left Card: Region Summary */}
            <Card>
                <Title>Regional Port Activity</Title>
                <Text>Predicted call volume by region (Next 30 Days)</Text>
                <div className="mt-4">
                    <BarList data={regions} className="mt-2" color="blue" />
                </div>
            </Card>

            {/* Right Card: Top Ports Table */}
            <Card>
                <Title>Top Active Ports</Title>
                <Text>Highest volume terminals by traffic</Text>
                <Table className="mt-4">
                    <TableHead>
                        <TableRow>
                            <TableHeaderCell>Rank</TableHeaderCell>
                            <TableHeaderCell>Port</TableHeaderCell>
                            <TableHeaderCell>Calls</TableHeaderCell>
                            <TableHeaderCell>Status</TableHeaderCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {ports.map((item) => (
                            <TableRow key={item.port}>
                                <TableCell>
                                    <Text>#{item.rank}</Text>
                                </TableCell>
                                <TableCell>
                                    <Text className="font-medium text-ocean">{item.port}</Text>
                                </TableCell>
                                <TableCell>
                                    <Text>{item.calls}</Text>
                                </TableCell>
                                <TableCell>
                                    <Badge color={getBadgeColor(item.status)} size="xs">
                                        {item.status}
                                    </Badge>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>
        </Grid>
    );
}
