from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from services.predictions_reader import PredictionsReader
from services.rerouting import get_reroute_recommendations, get_reroute_by_name
from api.anomalies import router as anomalies_router

app = FastAPI()

# Enable CORS for frontend
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Service Instance
reader = PredictionsReader()
app.state.reader = reader

# Register Routers
# Register Routers
app.include_router(anomalies_router)

from api.models import router as models_router
app.include_router(models_router)

# Initialize Cache
app.state.model_metrics = None

@app.get("/api/kpis")
def get_kpis():
    return reader.get_kpis()

@app.get("/api/trends")
def get_trends():
    return reader.get_trends()

@app.get("/api/regions")
def get_regions():
    return reader.get_regions()

@app.get("/api/top-ports")
def get_top_ports():
    return reader.get_top_ports()

@app.get("/api/predictions")
def get_predictions():
    return reader.get_predictions()

@app.get("/api/ports")
def get_ports():
    return reader.get_ports_summary()

@app.get("/api/models")
def get_models():
    return reader.get_model_metadata()

@app.get("/api/data-info")
def get_data_info():
    return reader.get_data_info()

@app.get("/api/map-data")
def get_map_data():
    return reader.get_map_data()

@app.get("/api/env")
def get_env_status():
    return reader.get_env_status()

@app.get("/api/reroute")
def get_reroute(
    port: str = Query(None, description="Port ID to find alternatives for"),
    port_name: str = Query(None, description="Port display name to find alternatives for"),
    force: bool = Query(False, description="Bypass congestion threshold (used when anomaly system confirms elevated status)"),
):
    map_data = reader.get_map_data()
    if port_name:
        recommendations = get_reroute_by_name(port_name, map_data, force=force)
    elif port:
        recommendations = get_reroute_recommendations(port, map_data, force=force)
    else:
        return {"port_id": None, "recommendations": []}
    return {"port_id": port, "port_name": port_name, "recommendations": recommendations}

@app.get("/")
def health_check():
    return {"status": "ok", "service": "PortWatch AI Backend"}
