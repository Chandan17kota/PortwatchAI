import pandas as pd
import numpy as np

def compute_metrics(df: pd.DataFrame, model_name: str) -> dict:
    """
    Computes performance metrics for a given model dataframe.
    
    Args:
        df: DataFrame containing 'actual_calls' and 'predicted_calls' columns
        model_name: Name of the model (e.g., 'XGBoost', 'ARIMA')
        
    Returns:
        dict: {
            "model": str,
            "mae": float,
            "start_date": str,
            "end_date": str,
            "num_ports": int
        }
    """
    if df is None or df.empty:
        return {
            "model": model_name,
            "mae": None,
            "start_date": None,
            "end_date": None,
            "num_ports": 0
        }

    # Ensure date is datetime
    if not np.issubdtype(df["date"].dtype, np.datetime64):
         df["date"] = pd.to_datetime(df["date"])

    # Filter for valid rows (where we have both actual and predicted)
    valid_df = df.dropna(subset=["actual_calls", "predicted_calls"])
    
    if valid_df.empty:
        return {
            "model": model_name,
            "mae": None,
            "start_date": str(df["date"].min().date()) if not df.empty else None,
            "end_date": str(df["date"].max().date()) if not df.empty else None,
            "num_ports": df["port"].nunique() if "port" in df.columns else 0
        }

    # Compute MAE
    mae = float((valid_df["actual_calls"] - valid_df["predicted_calls"]).abs().mean())
    
    return {
        "model": model_name,
        "mae": round(mae, 2),
        "start_date": str(valid_df["date"].min().date()),
        "end_date": str(valid_df["date"].max().date()),
        "num_ports": valid_df["port"].nunique()
    }
