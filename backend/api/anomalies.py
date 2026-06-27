from fastapi import APIRouter, Request, HTTPException
import pandas as pd
import numpy as np

router = APIRouter()

@router.get("/api/anomalies")
def get_anomalies(request: Request, limit: int = 1000):
    # Access the shared reader from app.state
    reader = getattr(request.app.state, "reader", None)
    if not reader:
        raise HTTPException(status_code=500, detail="PredictionsReader not initialized")

    # Get raw dataframe
    df = reader.get_raw_data()
    if df is None or df.empty:
        return {"window_days": 7, "count": 0, "data": []}

    # Ensure we work on a copy to avoid mutating cache
    df = df.copy()

    # Convert date to datetime for correct sorting
    df["date"] = pd.to_datetime(df["date"])
    
    # Process each port
    processed_frames = []
    
    # We need to compute rolling stats per port
    # Sort first by port and date
    df = df.sort_values(["port", "date"])

    # Use precomputed rolling stats from simulation (MANDATORY)
    if "rolling_mean_7" in df.columns and "rolling_std_7" in df.columns:
        df["mean"] = df["rolling_mean_7"]
        df["std"] = df["rolling_std_7"]
        # upper_bound is already precomputed in simulation
    else:
        # Fallback recursive logic for safety (should not be triggered with latest simulation.py)
        df["hybrid_value"] = df["actual_calls"].fillna(df["predicted_calls"])
        df = df.sort_values(["port", "date"])
        df["mean"] = df.groupby("port")["hybrid_value"].transform(lambda x: x.rolling(window=7, min_periods=1).mean())
        df["std"] = df.groupby("port")["hybrid_value"].transform(lambda x: x.rolling(window=7, min_periods=1).std()).fillna(0)
        df["upper_bound"] = df["mean"] + 2 * df["std"]
    
    # Drop rows with NaN std (can happen at very start of series)
    df = df.dropna(subset=["mean", "std"])
    processed_frames = [df]

    if not processed_frames:
        return {"window_days": 7, "count": 0, "data": []}

    result_df = pd.concat(processed_frames)

    # Calculate Trend Slope (5-day window)
    def calc_slope(y):
        n = len(y)
        if n < 2:
            return 0.0
        sum_x = (n - 1) * n / 2
        sum_x2 = (n - 1) * n * (2 * n - 1) / 6
        sum_y = y.sum()
        sum_xy = np.dot(np.arange(n), y)
        denom = n * sum_x2 - sum_x * sum_x
        if denom == 0:
            return 0.0
        return (n * sum_xy - sum_x * sum_y) / denom
    
    # Apply slope calculation per port to respect boundaries
    # We must do this before formatting or concat if we want it vectorised, but doing it on result_df grouped by port is fine
    # Actually, easier to do it in the loop above? 
    # Let's do it on the result_df since we have to group by port anyway for safety or presume result_df is mixed.
    # But result_df is a concat of processed_frames.
    
    # Recalculate slope on result_df to be safe and clean
    # We need to sort by date again to be sure rolling is correct
    result_df = result_df.sort_values(["port", "date"])
    
    # Use pandas transform for efficiency if possible, or just apply
    # Since we need a custom rolling window function which is slow-ish, we'll do it.
    # Note: rolling().apply() is somewhat slow. For performance we could strictly optimize, but for < vài k rows it's fine.
    
    slopes = result_df.groupby("port")["predicted_calls"].transform(
        lambda x: x.rolling(window=5, min_periods=3).apply(calc_slope, raw=True)
    )
    result_df["slope"] = slopes.fillna(0.0)

    # Calculate Severity Score
    # Avoid division by zero
    result_df["severity_score"] = np.where(
        result_df["std"] > 0,
        (result_df["predicted_calls"] - result_df["mean"]) / result_df["std"],
        0.0
    )


    # Classify Status
    def classify(row):
        score = row["severity_score"]
        if score > 2:
            return "Anomalous"
        elif score > 1:
            return "High"
        else:
            return "Normal"

    result_df["status"] = result_df.apply(classify, axis=1)

    # Determine Trend Label
    def get_trend_label(slope):
        if slope > 0.5: return "Increasing"
        elif slope < -0.5: return "Decreasing"
        else: return "Stable"
    
    result_df["trend"] = result_df["slope"].apply(get_trend_label)

    # Generate Explanation
    def explain(row):
        trend = row["trend"]
        score = round(row["severity_score"], 2)
        if row["status"] == "Anomalous":
            return f"Traffic exceeded the 7-day baseline by {score}σ with a {trend.lower()} trend."
        elif row["status"] == "High":
            return f"Traffic is above average and showing a {trend.lower()} trend."
        else:
            return "Traffic is within normal limits."

    result_df["explanation"] = result_df.apply(explain, axis=1)

    # Format necessary fields for output
    # Round mean/std for clean JSON
    result_df["mean"] = result_df["mean"].round(2)
    result_df["std"] = result_df["std"].round(2)
    result_df["severity_score"] = result_df["severity_score"].round(2)
    
    # Convert date back to string
    result_df["date"] = result_df["date"].dt.strftime("%Y-%m-%d")

    # Prepare response list
    # The requirement asks for a specific JSON structure
    data = []
    # To ensure deterministic output, sort by date desc, then port
    result_df = result_df.sort_values(["date", "port"], ascending=[False, True])
    
    if limit > 0:
        result_df = result_df.head(limit)
    
    for _, row in result_df.iterrows():
        data.append({
            "date": row["date"],
            "port": row["port"],
            "predicted_calls": int(row["predicted_calls"]),
            "rolling_mean_7": float(row["mean"]),
            "upper_bound": float(row["upper_bound"]),
            "mean": float(row["mean"]), # Keep for legacy compatibility
            "std": float(row["std"]),
            "status": row["status"],
            "severity_score": float(row["severity_score"]),
            "trend": row["trend"],
            "explanation": row["explanation"]
        })

    return {
        "window_days": 7,
        "count": len(data),
        "data": data
    }
