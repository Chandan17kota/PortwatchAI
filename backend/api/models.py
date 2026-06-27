from fastapi import APIRouter

router = APIRouter(prefix="/api/models", tags=["models"])

@router.get("/compare")
def compare_models():
    """
    Returns model comparison metadata for Production and Baseline models.
    Uses static values computed offline in Databricks.
    This endpoint is additive and does not affect prediction serving.
    """
    return {
        "production_model": {
            "name": "LightGBM",
            "role": "production",
            "mae": 1.52,
            "training_window": "2018–2024",
            "status": "active"
        },
        "baseline_model": {
            "name": "ARIMA",
            "role": "baseline",
            "mae": 1.71,
            "training_window": "2018–2024",
            "status": "evaluation_only"
        }
    }
