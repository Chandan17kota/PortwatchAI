"""
Rerouting recommendation service.
Given a congested port, suggests nearby alternatives with lower predicted load.
"""
import math


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Compute great-circle distance between two points in km."""
    R = 6371.0  # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


CONGESTION_THRESHOLD = 0.7   # only reroute if congestion >= 70%
MAX_DISTANCE_KM = 2000       # search radius
MAX_RECOMMENDATIONS = 3


def get_reroute_recommendations(port_id: str, map_data: list, force: bool = False) -> list:
    """
    Parameters
    ----------
    port_id : str
        The portid (e.g. "port425") of the congested port.
    map_data : list[dict]
        The full list returned by PredictionsReader.get_map_data().
        Each entry has: port_id, port_name, lat, lon, congestion_score,
        current_value, predicted_7d_avg.

    Returns
    -------
    list[dict]  — up to 3 alternative port recommendations, or [].
    """
    if not map_data:
        return []

    # Find the source port in the map data
    source = None
    for p in map_data:
        if p["port_id"] == port_id:
            source = p
            break

    if source is None:
        return []

    # Only recommend rerouting if congestion exceeds threshold
    # (skip this check when force=True, e.g. anomaly system already confirmed High/Anomalous)
    if not force and source["congestion_score"] < CONGESTION_THRESHOLD:
        return []

    src_lat = source["lat"]
    src_lon = source["lon"]
    src_load = source["predicted_7d_avg"]

    candidates = []
    for p in map_data:
        if p["port_id"] == port_id:
            continue  # skip self

        dist = haversine_km(src_lat, src_lon, p["lat"], p["lon"])
        if dist > MAX_DISTANCE_KM:
            continue  # too far

        # Only suggest ports with lighter load
        if p["predicted_7d_avg"] >= src_load:
            continue

        candidates.append({
            "port_id": p["port_id"],
            "port_name": p["port_name"],
            "distance_km": round(dist, 1),
            "predicted_calls": p["predicted_7d_avg"],
            "congestion_score": p["congestion_score"],
        })

    # Sort: lowest predicted load first, then shortest distance
    candidates.sort(key=lambda c: (c["predicted_calls"], c["distance_km"]))

    return candidates[:MAX_RECOMMENDATIONS]


def get_reroute_by_name(port_name: str, map_data: list, force: bool = False) -> list:
    """
    Lookup by display name (e.g. "Hong Kong") instead of portid.
    Delegates to get_reroute_recommendations once the portid is resolved.
    """
    if not map_data or not port_name:
        return []

    name_lower = port_name.strip().lower()
    for p in map_data:
        if p.get("port_name", "").strip().lower() == name_lower:
            return get_reroute_recommendations(p["port_id"], map_data, force=force)

    return []

