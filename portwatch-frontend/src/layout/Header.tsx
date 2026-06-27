import { Badge, Flex, Text } from "@tremor/react";
import { UserCircleIcon, SunIcon, MoonIcon, ComputerDesktopIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import { useTheme } from "../context/ThemeContext";

interface EnvStatus {
    environment: string;
    use_adls: boolean;
}

export default function Header() {
    const { theme, toggleTheme } = useTheme();
    const [envStatus, setEnvStatus] = useState<EnvStatus>({ environment: "checking...", use_adls: false });

    useEffect(() => {
        fetch("http://localhost:8000/api/env")
            .then((res) => res.json())
            .then((data) => setEnvStatus(data))
            .catch((err) => console.error("Env check failed", err));
    }, []);

    const isProd = envStatus.environment === "production";

    return (
        <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-4 sticky top-0 z-10 transition-colors duration-200">
            <Flex justifyContent="between" alignItems="center">
                <div>
                    <Flex justifyContent="start" alignItems="center" className="space-x-3">
                        <Text className="font-bold text-xl text-ocean dark:text-gray-100">PortWatch AI</Text>

                        <div
                            className="group relative flex items-center cursor-help"
                            title={isProd ? "Connected to Azure Data Lake Gen2" : "Using local cached prediction files"}
                        >
                            <Badge
                                color={isProd ? "emerald" : "gray"}
                                size="xs"
                                icon={isProd ? undefined : ComputerDesktopIcon}
                            >
                                {isProd ? "Production" : "Local Mode"}
                            </Badge>
                        </div>
                    </Flex>
                    <Text className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Global Maritime Prediction Dashboard &bull; {new Date().toLocaleDateString()}
                    </Text>
                </div>

                <Flex justifyContent="end" alignItems="center" className="space-x-4">
                    <button
                        onClick={toggleTheme}
                        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
                        aria-label="Toggle Theme"
                    >
                        {theme === "light" ? (
                            <MoonIcon className="w-6 h-6" />
                        ) : (
                            <SunIcon className="w-6 h-6" />
                        )}
                    </button>

                    <div className="flex items-center space-x-2 border-l pl-4 border-gray-200 dark:border-gray-700">
                        <UserCircleIcon className="w-8 h-8 text-gray-400" />
                        <div className="hidden sm:block">
                            <Text className="text-sm font-medium text-gray-900 dark:text-gray-200">Dishanth</Text>
                            <Text className="text-xs text-gray-500">Data Engineer</Text>
                        </div>
                    </div>
                </Flex>
            </Flex>
        </header>
    );
}
