import { Card, Title, Text, Switch, Flex, Grid, Badge } from "@tremor/react";
import { useEffect, useState } from "react";
import { useTheme } from "../context/ThemeContext";

interface EnvStatus {
    environment: string;
    use_adls: boolean;
}

export default function Settings() {
    const { theme, toggleTheme } = useTheme();
    const [envStatus, setEnvStatus] = useState<EnvStatus>({ environment: "checking...", use_adls: false });

    useEffect(() => {
        fetch("http://localhost:8000/api/env")
            .then((res) => res.json())
            .then((data) => setEnvStatus(data))
            .catch((err) => console.error("Env check failed", err));
    }, []);

    const isDark = theme === "dark";

    return (
        <>
            <Title>System Settings</Title>
            <Text>Configuration and preferences</Text>

            <Grid numItems={1} numItemsLg={2} className="gap-6 mt-6">
                {/* Environment Section */}
                <Card>
                    <Title>Environment</Title>
                    <Text className="mt-2">Backend Connectivity Status</Text>

                    <Flex className="mt-4 border-t pt-4 border-gray-100 dark:border-gray-800">
                        <Text>Current Environment</Text>
                        <Badge color={envStatus.environment === "production" ? "emerald" : "gray"}>
                            {envStatus.environment.toUpperCase()}
                        </Badge>
                    </Flex>

                    <Flex className="mt-4 border-t pt-4 border-gray-100 dark:border-gray-800">
                        <Text>Data Source</Text>
                        <Text className="font-mono text-ocean dark:text-sky-400">
                            {envStatus.use_adls ? "Azure Data Lake Gen2" : "Local Parquet File"}
                        </Text>
                    </Flex>

                    <Text className="text-xs text-gray-400 mt-4 italic">
                        To change the environment, please update the server .env file and restart.
                    </Text>
                </Card>

                {/* Preferences Section */}
                <Card>
                    <Title>Preferences</Title>
                    <Text className="mt-2">User Interface Customization</Text>

                    <Flex className="mt-4 border-t pt-4 border-gray-100 dark:border-gray-800">
                        <div>
                            <Text className="font-medium text-gray-900 dark:text-gray-100">Dark Mode</Text>
                            <Text className="text-xs text-gray-500">
                                Switch between light and dark themes
                            </Text>
                        </div>
                        <Switch
                            checked={isDark}
                            onChange={toggleTheme}
                        />
                    </Flex>
                </Card>
            </Grid>
        </>
    );
}
