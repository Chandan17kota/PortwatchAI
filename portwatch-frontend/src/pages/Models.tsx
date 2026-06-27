import { Card, Title, Text, Grid, Badge, Flex } from "@tremor/react";
import { useEffect, useState } from "react";

interface ModelInfo {
    model_name: string;
    run_id: string;
    mae_local: number;
    mae_cloud: number;
    training_window: string;
    features: string[];
    last_trained: string;
}

interface ModelRegistry {
    lightgbm: ModelInfo;
    arima: ModelInfo;
}

export default function Models() {
    const [data, setData] = useState<ModelRegistry | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("http://localhost:8000/api/models")
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

    if (loading || !data) return <Text className="p-10 text-center">Loading model registry...</Text>;

    const renderModelCard = (model: ModelInfo, isProduction: boolean) => (
        <Card decoration="top" decorationColor={isProduction ? "emerald" : "blue"}>
            <Flex justifyContent="between">
                <div>
                    <Text className="uppercase text-xs font-bold text-gray-500">Algorithm</Text>
                    <Title>{model.model_name}</Title>
                </div>
                <Badge color={isProduction ? "emerald" : "blue"}>
                    {isProduction ? "Production" : "Baseline"}
                </Badge>
            </Flex>
            
            <div className="mt-6 space-y-4">
                <div>
                    <Text className="text-sm text-gray-500">Performance Metrics</Text>
                    <div className="mt-1">
                        <Text className="font-medium text-ocean">
                            MAE (Local): <span className="text-gray-900 dark:text-gray-100">{model.mae_local} calls</span>
                        </Text>
                        <Text className="font-medium text-emerald-600 dark:text-emerald-400">
                            MAE (Cloud - Full Data): <span className="text-gray-900 dark:text-gray-100">{model.mae_cloud} calls</span>
                        </Text>
                    </div>
                </div>

                <Grid numItems={2} className="gap-4">
                    <div>
                        <Text className="uppercase text-xs font-bold text-gray-500">Run ID</Text>
                        <Text className="truncate font-mono text-xs">{model.run_id}</Text>
                    </div>
                    <div>
                        <Text className="uppercase text-xs font-bold text-gray-500">Last Trained</Text>
                        <Text className="text-sm">{model.last_trained}</Text>
                    </div>
                </Grid>

                <div>
                    <Text className="uppercase text-xs font-bold text-gray-500">Features</Text>
                    <div className="flex flex-wrap gap-2 mt-1">
                        {model.features.map(f => (
                            <Badge key={f} size="xs" color="gray">{f}</Badge>
                        ))}
                    </div>
                </div>
            </div>
        </Card>
    );

    return (
        <div className="p-4">
            <div className="flex justify-between items-end">
                <div>
                    <Title>Model Registry</Title>
                    <Text>Performance comparison of available forecasting engines</Text>
                </div>
                <Text className="text-xs italic text-gray-400 max-w-xs text-right">
                    Cloud results from full dataset (Databricks training)
                </Text>
            </div>

            <Grid numItems={1} numItemsLg={2} className="gap-6 mt-6">
                {renderModelCard(data.lightgbm, true)}
                {renderModelCard(data.arima, false)}
            </Grid>

            <Card className="mt-6 bg-gray-50 dark:bg-gray-800/50 border-none">
                <Text className="text-xs text-gray-500">
                    <strong>Note:</strong> Local MAE represents performance on the 60-day validation subset available in this environment. 
                    Cloud MAE represents historical performance across the complete several-year dataset used in the production pipeline.
                </Text>
            </Card>
        </div>
    );
}
