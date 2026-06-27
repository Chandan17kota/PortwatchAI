import os
import pandas as pd
import numpy as np
import lightgbm as lgb
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

def run_dynamic_simulation():
    # Load model and validation data
    local_dir = os.getenv("LOCAL_OUTPUT_PATH", ".")
    val_path = os.path.join(local_dir, "validation_predictions.parquet")
    model_path = os.path.join(local_dir, "../models/portwatch_lightgbm.pkl")
    
    if not os.path.exists(val_path) or not os.path.exists(model_path):
        print(f"Simulation failed: Missing files in {local_dir}")
        return None
        
    df = pd.read_parquet(val_path)
    import joblib
    model = joblib.load(model_path)
    
    # 1. Timeline Alignment: Shift timeline so last actual is Today
    df["date"] = pd.to_datetime(df["event_date"])
    # Standardize column names early
    df = df.rename(columns={
        "portid": "port",
        "daily_port_calls": "actual_calls",
        "pred_daily_port_calls": "predicted_calls"
    })
    
    # Find the last date where we have actual data
    last_actual_date = df[df["actual_calls"].notna()]["date"].max()
    today = pd.Timestamp.today().normalize()
    date_delta = today - last_actual_date
    df["date"] = df["date"] + date_delta
    
    # 3. Hybrid Series: We need a combined series for feature engineering
    # Create the base history (last 60 days to support rolling_30 and lag_30)
    history_start = today - pd.Timedelta(days=60)
    sim_df = df[(df["date"] > history_start) & (df["date"] <= today)].copy()
    
    if "region" not in sim_df.columns:
        sim_df["region"] = "Global"
    
    # Keep only target columns to avoid index errors during concat later
    cols_to_keep = ["date", "port", "actual_calls", "predicted_calls", "region"]
    sim_df = sim_df[cols_to_keep].copy()
        
    # Hybrid Value: Actual if available, else Predicted (MANDATORY Single Source)
    sim_df["hybrid_value"] = sim_df["actual_calls"].fillna(sim_df["predicted_calls"])
    
    # Initialize port_state: a dictionary of lists containing recent hybrid values
    # We keep up to 60 days of history to support all lags/rolling windows
    ports = sim_df["port"].unique()
    port_state = {}
    sim_df = sim_df.sort_values(["port", "date"])
    
    for port in ports:
        port_state[port] = sim_df[sim_df["port"] == port]["hybrid_value"].tolist()
        
    # Pre-calculate initial rolling stats for 'today' to seed the first prediction
    for w in [7, 14, 30]:
        sim_df[f"roll_mean_{w}"] = sim_df.groupby("port")["hybrid_value"].transform(lambda x: x.rolling(window=w, min_periods=1).mean())
        sim_df[f"roll_std_{w}"] = sim_df.groupby("port")["hybrid_value"].transform(lambda x: x.rolling(window=w, min_periods=1).std())
    
    # Port encoded stats from history
    port_stats = sim_df.groupby("port")["hybrid_value"].agg(["mean", "count"]).reset_index()
    port_stats = port_stats.rename(columns={"mean": "port_mean_prev", "count": "port_count_prev"})
    
    feature_cols = [
        'lag_1', 'lag_2', 'lag_3', 'lag_7', 'lag_14', 'lag_30',
        'roll_mean_7', 'roll_mean_14', 'roll_mean_30',
        'roll_std_7', 'roll_std_14', 'roll_std_30',
        'lag_1_is_null', 'lag_2_is_null', 'lag_3_is_null', 'lag_7_is_null',
        'lag_14_is_null', 'lag_30_is_null', 'roll_mean_7_is_null',
        'roll_mean_14_is_null', 'roll_mean_30_is_null', 'roll_std_7_is_null',
        'roll_std_14_is_null', 'roll_std_30_is_null', 'dow', 'is_weekend',
        'port_mean_prev', 'port_count_prev'
    ]
    
    # 2. Recursive Hybrid loop for 7 days
    results_list = [sim_df]
    
    for day_offset in range(1, 8):
        current_date = today + pd.Timedelta(days=day_offset)
        
        # Prepare day frame
        day_df = pd.DataFrame({"port": ports})
        day_df["date"] = current_date
        day_df["region"] = "Global"
        day_df["actual_calls"] = pd.NA
        
        # Merge port metadata
        day_df = day_df.merge(port_stats, on="port", how="left")
        day_df["dow"] = current_date.dayofweek
        day_df["is_weekend"] = day_df["dow"].isin([5, 6]).astype(int)
        
        # Compute features for each port
        # This part gathers the 'current' lags and rolling stats from port_state
        # which are based on everything BEFORE this current step
        for port in ports:
            series = port_state[port]
            # Lags
            for lag in [1, 2, 3, 7, 14, 30]:
                val = series[-lag] if len(series) >= lag else day_df[day_df["port"] == port]["port_mean_prev"].iloc[0]
                day_df.loc[day_df["port"] == port, f"lag_{lag}"] = val
                day_df.loc[day_df["port"] == port, f"lag_{lag}_is_null"] = 0 if len(series) >= lag else 1
            
            # Rolling Stats (features for the model)
            for w in [7, 14, 30]:
                window_data = series[-w:]
                day_df.loc[day_df["port"] == port, f"roll_mean_{w}"] = np.mean(window_data)
                day_df.loc[day_df["port"] == port, f"roll_std_{w}"] = np.std(window_data)
                day_df.loc[day_df["port"] == port, f"roll_mean_{w}_is_null"] = 0
                day_df.loc[day_df["port"] == port, f"roll_std_{w}_is_null"] = 0

        # Predict
        X = day_df[feature_cols].copy()
        preds = model.predict(X)
        preds = np.maximum(preds, 0)
        
        day_df["predicted_calls"] = preds
        day_df["hybrid_value"] = preds 
        
        # UPDATE port_state with the new predicted point (CRITICAL RECURSION)
        for i, port in enumerate(ports):
            port_state[port].append(preds[i])
            
            # RECOMPUTE Rolling Stats for the OUTPUT row (must include the current prediction)
            for w in [7, 14, 30]:
                window_data = port_state[port][-w:]
                day_df.loc[day_df["port"] == port, f"roll_mean_{w}"] = np.mean(window_data)
                day_df.loc[day_df["port"] == port, f"roll_std_{w}"] = np.std(window_data)
        
        results_list.append(day_df)
        
    # Combine everything
    full_df = pd.concat(results_list, ignore_index=True)
    
    # 4. Global Anomaly Baseline Computation (AFTER simulation loop)
    # Ensure stable sorting for rolling calculations
    full_df = full_df.sort_values(["port", "date"])
    
    # Compute Hybrid Series (Single Source of Truth)
    full_df["hybrid_value"] = full_df["actual_calls"].fillna(full_df["predicted_calls"])
    
    # Compute Rolling Statistics PER ROW
    full_df["rolling_mean_7"] = full_df.groupby("port")["hybrid_value"].transform(
        lambda x: x.rolling(window=7, min_periods=1).mean()
    )
    full_df["rolling_std_7"] = full_df.groupby("port")["hybrid_value"].transform(
        lambda x: x.rolling(window=7, min_periods=1).std()
    ).fillna(0)
    
    # Compute Dynamic Upper Bound
    full_df["upper_bound"] = full_df["rolling_mean_7"] + 2 * full_df["rolling_std_7"]
    
    # Return last 60 days history + 7 days forecast (STRICT REQUIREMENT)
    final_start = today - pd.Timedelta(days=60)
    final_df = full_df[full_df["date"] > final_start].sort_values(["date", "port"]).copy()
    
    return final_df




