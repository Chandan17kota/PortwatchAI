import { Title, Text } from "@tremor/react";
import KPICards from "../components/KPICards";
import TrafficTrendChart from "../components/TrafficTrendChart";
import RegionalActivity from "../components/RegionalActivity";
import MapView from "../components/MapView";

export default function Overview() {
    return (
        <div className="space-y-6">

            {/* Section 0: Global Map */}
            <div>
                <Title>Global Port Overview</Title>
                <Text>Real-time vessel density and port status</Text>
                <div className="mt-4 h-[400px]">
                    <MapView />
                </div>
            </div>

            {/* Section 1: Key Metrics */}
            <div>
                <Title>Key Metrics</Title>
                <Text>Real-time operational indicators</Text>
                <div className="mt-4">
                    <KPICards />
                </div>
            </div>

            {/* Section 2: Trends */}
            <div className="mt-8">
                <Title>Trends</Title>
                <Text className="mb-4">Forecasted traffic volume over time</Text>
                <TrafficTrendChart />
            </div>

            {/* Section 3: Detailed Activity */}
            <div className="mt-8">
                <Title>Regional Activity</Title>
                <Text className="mb-4">Global distribution and top contributors</Text>
                <RegionalActivity />
            </div>

        </div>
    );
}
