import { Routes, Route, useLocation } from "react-router-dom";
import DashboardLayout from "./layout/DashboardLayout";
import Overview from "./pages/Overview";
import Predictions from "./pages/Predictions";
import Ports from "./pages/Ports";
import Models from "./pages/Models";
import Data from "./pages/Data";
import Settings from "./pages/Settings";
import Congestion from "./pages/Congestion";
import RouteSimulator from "./pages/RouteSimulator";

function App() {
  const location = useLocation();

  return (
    <DashboardLayout>
      <Routes key={location.pathname}>
        <Route path="/" element={<Overview />} />
        <Route path="/predictions" element={<Predictions />} />
        <Route path="/ports" element={<Ports />} />
        <Route path="/models" element={<Models />} />
        <Route path="/data" element={<Data />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/anomalies" element={<Congestion />} />
        <Route path="/route-simulator" element={<RouteSimulator />} />
      </Routes>
    </DashboardLayout>
  );
}

export default App;
