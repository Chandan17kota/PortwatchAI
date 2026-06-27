import { Card, Title, Text, Metric, Grid, Badge, Callout } from "@tremor/react";
import { useEffect, useState } from "react";
// @ts-ignore
import { CheckCircleIcon, ExclamationCircleIcon } from "@heroicons/react/24/solid";

interface DataInfo {
    mode: string;
    source_path: string;
    last_updated: string;
    file_count: number;
}

export default function Data() {
    const [data, setData] = useState<DataInfo | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("http://localhost:8000/api/data-info")
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

    if (loading || !data) return <Text>Checking pipeline status...</Text>;

    const isCloud = data.mode === "ADLS";

    return (
        <>
            <Title>Pipeline Transparency</Title>
            <Text>Current data source configuration and health</Text>

            <div className="mt-6">
                <Callout
                    title={isCloud ? "System Running in Cloud Mode" : "System Running in Local Mode"}
                    icon={isCloud ? CheckCircleIcon : ExclamationCircleIcon}
                    color={isCloud ? "cyan" : "amber"}
                >
                    {isCloud
                        ? "The backend is currently consuming live Parquet files from Azure Data Lake Gen2."
                        : "The backend is using a local cached file for development/fallback purposes."
                    }
                </Callout>
            </div>

            <Grid numItems={1} numItemsLg={2} className="gap-6 mt-6">
                <Card>
                    <Title>Connection Details</Title>
                    <div className="mt-4">
                        <Text className="uppercase text-xs font-bold text-gray-500">Source Type</Text>
                        <Metric>{data.mode}</Metric>
                    </div>
                    <div className="mt-4">
                        <Text className="uppercase text-xs font-bold text-gray-500">Path URI</Text>
                        <Text className="font-mono text-xs break-all text-gray-600 mt-1">{data.source_path}</Text>
                    </div>
                </Card>

                <Card>
                    <Title>Freshness</Title>
                    <div className="mt-4">
                        <Text className="uppercase text-xs font-bold text-gray-500">Last Updated</Text>
                        <Metric>{data.last_updated}</Metric>
                    </div>
                    <div className="mt-4">
                        <Text className="uppercase text-xs font-bold text-gray-500">File Count</Text>
                        <Badge size="lg">{data.file_count}</Badge>
                    </div>
                </Card>
            </Grid>
        </>
    );
}
