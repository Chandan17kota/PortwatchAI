import type { ReactNode } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import PortDeepDivePanel from "../components/PortDeepDivePanel";

interface DashboardLayoutProps {
    children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
    return (
        <div className="flex h-screen overflow-hidden bg-dock dark:bg-gray-900">
            {/* Fixed Sidebar */}
            <div className="hidden md:flex w-72 flex-col fixed inset-y-0 z-50">
                <Sidebar />
            </div>

            {/* Main Content Wrapper */}
            <div className="flex flex-1 flex-col md:pl-72 w-full">
                <Header />

                {/* Scrollable Content Area */}
                <main className="flex-1 overflow-y-auto">
                    <div className="py-8">
                        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                            {children}
                        </div>
                    </div>
                </main>
            </div>
            
            {/* Global Slide-over Panels */}
            <PortDeepDivePanel />
        </div>
    );
}
