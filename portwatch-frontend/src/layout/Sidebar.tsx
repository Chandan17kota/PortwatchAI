import { NavLink } from "react-router-dom";
import {
    HomeIcon,
    ChartBarIcon,
    MapIcon,
    CubeIcon,
    CircleStackIcon,
    Cog6ToothIcon,
    ExclamationTriangleIcon,
    GlobeAltIcon
} from "@heroicons/react/24/outline";

const navigation = [
    { name: "Overview", href: "/", icon: HomeIcon },
    { name: "Predictions", href: "/predictions", icon: ChartBarIcon },
    { name: "Congestion", href: "/anomalies", icon: ExclamationTriangleIcon },
    { name: "Route Simulator", href: "/route-simulator", icon: GlobeAltIcon },
    { name: "Ports", href: "/ports", icon: MapIcon },
    { name: "Models", href: "/models", icon: CubeIcon },
    { name: "Data", href: "/data", icon: CircleStackIcon },
];

function classNames(...classes: string[]) {
    return classes.filter(Boolean).join(" ");
}

export default function Sidebar() {
    return (
        <div className="flex min-h-0 flex-1 flex-col bg-ocean">
            <div className="flex flex-1 flex-col overflow-y-auto pt-5 pb-4">
                <div className="flex flex-shrink-0 items-center px-6">
                    <h1 className="text-2xl font-bold text-white tracking-tight">
                        PortWatch AI
                    </h1>
                </div>
                <nav className="mt-8 flex-1 space-y-1 px-3">
                    {navigation.map((item) => (
                        <NavLink
                            key={item.name}
                            to={item.href}
                            className={({ isActive }) =>
                                classNames(
                                    isActive
                                        ? "bg-teal/10 text-teal"
                                        : "text-blue-100 hover:bg-white/5 hover:text-white",
                                    "group flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors"
                                )
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    <item.icon
                                        className={classNames(
                                            isActive ? "text-teal" : "text-blue-300 group-hover:text-white",
                                            "mr-3 flex-shrink-0 h-6 w-6"
                                        )}
                                        aria-hidden="true"
                                    />
                                    {item.name}
                                </>
                            )}
                        </NavLink>
                    ))}
                </nav>
            </div>
            <div className="flex flex-shrink-0 border-t border-white/10 p-4">
                <NavLink
                    to="/settings"
                    className={({ isActive }) =>
                        classNames(
                            isActive
                                ? "bg-teal/10 text-teal"
                                : "text-blue-100 hover:bg-white/5 hover:text-white",
                            "group flex w-full items-center rounded-md px-3 py-2 text-sm font-medium transition-colors"
                        )
                    }
                >
                    {({ isActive }) => (
                        <>
                            <Cog6ToothIcon
                                className={classNames(
                                    isActive ? "text-teal" : "text-blue-300 group-hover:text-white",
                                    "mr-3 h-6 w-6"
                                )}
                                aria-hidden="true"
                            />
                            Settings
                        </>
                    )}
                </NavLink>
            </div>
        </div>
    );
}
