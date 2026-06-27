import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { 
    Card, 
    Title, 
    Text, 
    Select, 
    SelectItem, 
    Button, 
    Divider, 
    Switch,
    Badge
} from "@tremor/react";
import { PlayIcon, PauseIcon, ArrowPathIcon, ExclamationTriangleIcon, CheckCircleIcon, MapPinIcon, ChartBarIcon, CpuChipIcon, ShieldCheckIcon } from "@heroicons/react/24/solid";
import { MapContainer, TileLayer, CircleMarker, Polyline, useMap, Tooltip, Circle } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import portMetadataFull from "../data/port_metadata.json";

interface PortData {
    port_id: string;
    port_name: string;
    lat: number;
    lon: number;
    congestion_score: number;
    current_value: number;
    predicted_7d_avg: number;
}

const ports = Object.keys(portMetadataFull).sort();

const calcDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return R * c;
};

// Phase 2: Maritime Waypoints for realistic sea routing
const WAYPOINTS: Record<string, { lat: number, lon: number, edges: string[] }> = {
    // Japan Coast (Pacific Side)
    "TokyoApproach": { lat: 34.5, lon: 140.0, edges: ["JapanPacific1", "NorthPacificMid"] },
    "JapanPacific1": { lat: 33.5, lon: 136.5, edges: ["TokyoApproach", "JapanPacific2"] },
    "JapanPacific2": { lat: 32.5, lon: 133.5, edges: ["JapanPacific1", "KyushuSouth"] },
    "KyushuSouth": { lat: 30.5, lon: 130.5, edges: ["JapanPacific2", "EastChinaSeaNorth", "OkinawaNorth"] },
    
    // Sea of Japan & Korea
    "HokkaidoWest": { lat: 43.0, lon: 140.0, edges: ["TsugaruStrait", "JapanSeaMid"] },
    "TsugaruStrait": { lat: 41.5, lon: 140.5, edges: ["HokkaidoWest", "TokyoApproach"] },
    "JapanSeaMid": { lat: 39.0, lon: 135.0, edges: ["HokkaidoWest", "KoreaStraitEast"] },
    "KoreaStraitEast": { lat: 35.5, lon: 130.5, edges: ["JapanSeaMid", "KoreaStraitWest", "BusanApproach"] },
    "BusanApproach": { lat: 34.5, lon: 129.5, edges: ["KoreaStraitEast", "KoreaStraitWest"] },
    "KoreaStraitWest": { lat: 33.5, lon: 128.0, edges: ["KoreaStraitEast", "BusanApproach", "YellowSeaSouth"] },
    
    // Yellow Sea & China Coast
    "YellowSeaNorth": { lat: 37.0, lon: 123.0, edges: ["YellowSeaMid", "QingdaoApproach"] },
    "QingdaoApproach": { lat: 35.5, lon: 121.0, edges: ["YellowSeaNorth", "YellowSeaMid"] },
    "YellowSeaMid": { lat: 35.0, lon: 124.0, edges: ["YellowSeaNorth", "YellowSeaSouth", "QingdaoApproach"] },
    "YellowSeaSouth": { lat: 33.0, lon: 124.0, edges: ["YellowSeaMid", "KoreaStraitWest", "ShanghaiApproach"] },
    "ShanghaiApproach": { lat: 31.0, lon: 123.0, edges: ["YellowSeaSouth", "EastChinaSeaMid", "NingboApproach"] },
    "NingboApproach": { lat: 29.5, lon: 123.0, edges: ["ShanghaiApproach", "EastChinaSeaMid", "FuzhouApproach"] },
    "FuzhouApproach": { lat: 26.0, lon: 120.5, edges: ["NingboApproach", "TaiwanStraitNorth"] },
    
    // East China Sea & Taiwan
    "EastChinaSeaNorth": { lat: 31.0, lon: 127.0, edges: ["KyushuSouth", "EastChinaSeaMid", "OkinawaNorth"] },
    "EastChinaSeaMid": { lat: 28.0, lon: 124.5, edges: ["EastChinaSeaNorth", "ShanghaiApproach", "NingboApproach", "TaiwanStraitNorth", "OkinawaMid"] },
    "TaiwanStraitNorth": { lat: 25.5, lon: 120.5, edges: ["FuzhouApproach", "EastChinaSeaMid", "TaiwanStraitMid"] },
    "TaiwanStraitMid": { lat: 24.0, lon: 119.0, edges: ["TaiwanStraitNorth", "TaiwanStraitSouth", "XiamenApproach"] },
    "XiamenApproach": { lat: 24.0, lon: 118.5, edges: ["TaiwanStraitMid", "TaiwanStraitSouth"] },
    "TaiwanStraitSouth": { lat: 22.0, lon: 118.0, edges: ["TaiwanStraitMid", "XiamenApproach", "HongKongApproach"] },
    
    // South China Sea Coast
    "HongKongApproach": { lat: 21.0, lon: 114.5, edges: ["TaiwanStraitSouth", "SouthChinaSeaNorth", "HainanEast"] },
    "HainanEast": { lat: 19.0, lon: 111.5, edges: ["HongKongApproach", "SouthChinaSeaMid", "GulfOfTonkin"] },
    "GulfOfTonkin": { lat: 19.5, lon: 107.0, edges: ["HainanEast"] },
    
    // Okinawa & Philippine Sea
    "OkinawaNorth": { lat: 28.0, lon: 129.0, edges: ["KyushuSouth", "EastChinaSeaNorth", "OkinawaMid"] },
    "OkinawaMid": { lat: 25.5, lon: 126.0, edges: ["OkinawaNorth", "EastChinaSeaMid", "PhilippineSeaNorth"] },
    "PhilippineSeaNorth": { lat: 22.0, lon: 128.0, edges: ["OkinawaMid", "LuzonStraitEast", "MidPacific1"] },
    "LuzonStraitEast": { lat: 20.5, lon: 122.0, edges: ["PhilippineSeaNorth", "LuzonStraitWest", "PhilippineEastCoast"] },
    "LuzonStraitWest": { lat: 20.0, lon: 119.5, edges: ["LuzonStraitEast", "SouthChinaSeaNorth", "ManilaApproach"] },
    "ManilaApproach": { lat: 14.5, lon: 119.5, edges: ["LuzonStraitWest", "SouthChinaSeaMid"] },
    "PhilippineEastCoast": { lat: 13.0, lon: 126.0, edges: ["LuzonStraitEast", "MindanaoEast", "MidPacific2"] },
    "MindanaoEast": { lat: 7.0, lon: 127.0, edges: ["PhilippineEastCoast", "CelebesSeaEast"] },
    
    // South China Sea Central Route
    "SouthChinaSeaNorth": { lat: 19.0, lon: 116.0, edges: ["HongKongApproach", "LuzonStraitWest", "SouthChinaSeaMid"] },
    "SouthChinaSeaMid": { lat: 14.0, lon: 113.5, edges: ["SouthChinaSeaNorth", "HainanEast", "ManilaApproach", "SouthChinaSeaSouth"] },
    "SouthChinaSeaSouth": { lat: 8.0, lon: 110.0, edges: ["SouthChinaSeaMid", "VietnamSouth", "NatunaSea"] },
    "VietnamSouth": { lat: 9.0, lon: 108.0, edges: ["SouthChinaSeaSouth", "GulfOfThailand", "SingaporeApproachEast"] },
    "GulfOfThailand": { lat: 11.0, lon: 102.0, edges: ["VietnamSouth"] },
    "NatunaSea": { lat: 4.0, lon: 108.0, edges: ["SouthChinaSeaSouth", "SingaporeApproachEast", "KarimataStrait"] },
    
    // Indonesia & Straits
    "SingaporeApproachEast": { lat: 1.5, lon: 104.5, edges: ["VietnamSouth", "NatunaSea", "SingaporeStrait"] },
    "SingaporeStrait": { lat: 1.2, lon: 103.5, edges: ["SingaporeApproachEast", "MalaccaSouth"] },
    "MalaccaSouth": { lat: 2.5, lon: 101.5, edges: ["SingaporeStrait", "MalaccaMid"] },
    "MalaccaMid": { lat: 4.0, lon: 99.5, edges: ["MalaccaSouth", "MalaccaNorth"] },
    "MalaccaNorth": { lat: 5.5, lon: 98.0, edges: ["MalaccaMid", "AndamanSeaSouth"] },
    
    "KarimataStrait": { lat: -2.0, lon: 108.0, edges: ["NatunaSea", "JavaSeaWest"] },
    "JavaSeaWest": { lat: -5.0, lon: 108.0, edges: ["KarimataStrait", "JakartaApproach", "SundaStraitEast"] },
    "JakartaApproach": { lat: -5.8, lon: 106.8, edges: ["JavaSeaWest", "JavaSeaMid"] },
    "SundaStraitEast": { lat: -6.0, lon: 105.5, edges: ["JavaSeaWest", "SundaStraitWest"] },
    "SundaStraitWest": { lat: -6.5, lon: 104.5, edges: ["SundaStraitEast", "IndianOceanEast"] },
    "JavaSeaMid": { lat: -5.5, lon: 112.0, edges: ["JakartaApproach", "SurabayaApproach", "MakassarStraitSouth"] },
    "SurabayaApproach": { lat: -6.5, lon: 112.5, edges: ["JavaSeaMid", "BaliSea"] },
    "BaliSea": { lat: -7.5, lon: 115.0, edges: ["SurabayaApproach", "LombokStraitNorth"] },
    "LombokStraitNorth": { lat: -8.0, lon: 115.5, edges: ["BaliSea", "LombokStraitSouth"] },
    "LombokStraitSouth": { lat: -9.0, lon: 115.5, edges: ["LombokStraitNorth", "IndianOceanEast"] },
    
    "CelebesSeaEast": { lat: 4.0, lon: 125.0, edges: ["MindanaoEast", "MakassarStraitNorth", "MoluccaSea"] },
    "MakassarStraitNorth": { lat: 1.0, lon: 119.0, edges: ["CelebesSeaEast", "MakassarStraitSouth"] },
    "MakassarStraitSouth": { lat: -4.0, lon: 118.0, edges: ["MakassarStraitNorth", "JavaSeaMid", "BandaSeaWest"] },
    "MoluccaSea": { lat: -1.0, lon: 126.0, edges: ["CelebesSeaEast", "BandaSeaWest"] },
    "BandaSeaWest": { lat: -5.0, lon: 126.0, edges: ["MakassarStraitSouth", "MoluccaSea", "TimorSea"] },
    "TimorSea": { lat: -10.0, lon: 126.0, edges: ["BandaSeaWest", "IndianOceanEast", "ArafuraSea"] },
    
    // Indian Ocean & India Coast
    "AndamanSeaSouth": { lat: 8.0, lon: 96.0, edges: ["MalaccaNorth", "AndamanSeaNorth", "SriLankaEast"] },
    "AndamanSeaNorth": { lat: 12.0, lon: 95.0, edges: ["AndamanSeaSouth", "BayOfBengalEast"] },
    "BayOfBengalEast": { lat: 16.0, lon: 90.0, edges: ["AndamanSeaNorth", "KolkataApproach"] },
    "KolkataApproach": { lat: 20.0, lon: 88.0, edges: ["BayOfBengalEast", "IndiaEastCoastNorth"] },
    "IndiaEastCoastNorth": { lat: 17.0, lon: 84.0, edges: ["KolkataApproach", "IndiaEastCoastMid"] },
    "IndiaEastCoastMid": { lat: 14.0, lon: 81.0, edges: ["IndiaEastCoastNorth", "ChennaiApproach"] },
    "ChennaiApproach": { lat: 13.0, lon: 80.5, edges: ["IndiaEastCoastMid", "SriLankaEast"] },
    "SriLankaEast": { lat: 7.0, lon: 82.0, edges: ["AndamanSeaSouth", "ChennaiApproach", "SriLankaSouth"] },
    "SriLankaSouth": { lat: 5.5, lon: 80.0, edges: ["SriLankaEast", "ColomboApproach", "IndianOceanMid"] },
    "ColomboApproach": { lat: 6.5, lon: 79.0, edges: ["SriLankaSouth", "IndiaWestCoastSouth"] },
    "IndiaWestCoastSouth": { lat: 10.0, lon: 75.0, edges: ["ColomboApproach", "IndiaWestCoastMid"] },
    "IndiaWestCoastMid": { lat: 15.0, lon: 73.0, edges: ["IndiaWestCoastSouth", "MumbaiApproach"] },
    "MumbaiApproach": { lat: 18.5, lon: 72.0, edges: ["IndiaWestCoastMid", "IndiaWestCoastNorth"] },
    "IndiaWestCoastNorth": { lat: 21.0, lon: 69.0, edges: ["MumbaiApproach", "KarachiApproach", "ArabianSeaNorth"] },
    "KarachiApproach": { lat: 24.0, lon: 66.0, edges: ["IndiaWestCoastNorth", "GulfOfOman"] },
    
    "IndianOceanEast": { lat: -5.0, lon: 95.0, edges: ["SundaStraitWest", "LombokStraitSouth", "IndianOceanMid", "AustraliaWestCoast"] },
    "IndianOceanMid": { lat: 0.0, lon: 75.0, edges: ["SriLankaSouth", "IndianOceanEast", "ArabianSeaMid"] },
    "ArabianSeaMid": { lat: 10.0, lon: 65.0, edges: ["IndianOceanMid", "ArabianSeaNorth", "GulfOfAdenEast"] },
    "ArabianSeaNorth": { lat: 18.0, lon: 63.0, edges: ["ArabianSeaMid", "IndiaWestCoastNorth", "GulfOfOman"] },
    
    // Middle East
    "GulfOfOman": { lat: 24.0, lon: 59.0, edges: ["KarachiApproach", "ArabianSeaNorth", "HormuzStrait"] },
    "HormuzStrait": { lat: 26.5, lon: 56.5, edges: ["GulfOfOman", "PersianGulfSouth"] },
    "PersianGulfSouth": { lat: 25.5, lon: 54.0, edges: ["HormuzStrait", "PersianGulfNorth"] },
    "PersianGulfNorth": { lat: 28.0, lon: 50.0, edges: ["PersianGulfSouth"] },
    "GulfOfAdenEast": { lat: 13.0, lon: 52.0, edges: ["ArabianSeaMid", "GulfOfAdenWest"] },
    "GulfOfAdenWest": { lat: 12.0, lon: 45.0, edges: ["GulfOfAdenEast", "BabElMandeb"] },
    "BabElMandeb": { lat: 12.5, lon: 43.3, edges: ["GulfOfAdenWest", "RedSeaSouth"] },
    "RedSeaSouth": { lat: 17.0, lon: 40.0, edges: ["BabElMandeb", "JeddahApproach"] },
    "JeddahApproach": { lat: 21.5, lon: 38.5, edges: ["RedSeaSouth", "RedSeaNorth"] },
    "RedSeaNorth": { lat: 26.0, lon: 35.0, edges: ["JeddahApproach", "SuezApproachSouth"] },
    "SuezApproachSouth": { lat: 29.8, lon: 32.5, edges: ["RedSeaNorth", "SuezCanalSouth"] },
    "SuezCanalSouth": { lat: 30.5, lon: 32.3, edges: ["SuezApproachSouth", "SuezCanalNorth"] },
    "SuezCanalNorth": { lat: 31.5, lon: 32.3, edges: ["SuezCanalSouth", "EastMedSouth"] },
    
    // Mediterranean (Denser)
    "EastMedSouth": { lat: 32.5, lon: 31.0, edges: ["SuezCanalNorth", "EastMedNorth", "CyprusApproach"] },
    "CyprusApproach": { lat: 34.0, lon: 33.0, edges: ["EastMedSouth", "EastMedNorth"] },
    "EastMedNorth": { lat: 35.0, lon: 28.0, edges: ["EastMedSouth", "CyprusApproach", "AegeanSeaSouth", "CentralMedEast"] },
    "AegeanSeaSouth": { lat: 36.5, lon: 25.5, edges: ["EastMedNorth", "AegeanSeaNorth"] },
    "AegeanSeaNorth": { lat: 39.0, lon: 25.0, edges: ["AegeanSeaSouth", "DardanellesStrait"] },
    "DardanellesStrait": { lat: 40.0, lon: 26.0, edges: ["AegeanSeaNorth", "MarmaraSea"] },
    "MarmaraSea": { lat: 40.5, lon: 28.0, edges: ["DardanellesStrait", "BosphorusStrait"] },
    "BosphorusStrait": { lat: 41.2, lon: 29.1, edges: ["MarmaraSea", "BlackSeaWest"] },
    "BlackSeaWest": { lat: 43.0, lon: 30.0, edges: ["BosphorusStrait", "BlackSeaEast"] },
    "BlackSeaEast": { lat: 43.0, lon: 36.0, edges: ["BlackSeaWest"] },
    
    "CentralMedEast": { lat: 35.5, lon: 20.0, edges: ["EastMedNorth", "CentralMedMid", "AdriaticSouth"] },
    "AdriaticSouth": { lat: 40.0, lon: 18.5, edges: ["CentralMedEast", "AdriaticNorth"] },
    "AdriaticNorth": { lat: 44.0, lon: 13.5, edges: ["AdriaticSouth", "VeniceApproach"] },
    "VeniceApproach": { lat: 45.3, lon: 12.5, edges: ["AdriaticNorth"] },
    
    "CentralMedMid": { lat: 36.0, lon: 15.0, edges: ["CentralMedEast", "MaltaApproach", "SicilyStrait"] },
    "MaltaApproach": { lat: 35.5, lon: 14.5, edges: ["CentralMedMid", "SicilyStrait"] },
    "SicilyStrait": { lat: 37.0, lon: 11.5, edges: ["CentralMedMid", "MaltaApproach", "WestMedEast", "TyrrhenianSeaSouth"] },
    
    "TyrrhenianSeaSouth": { lat: 39.0, lon: 14.0, edges: ["SicilyStrait", "TyrrhenianSeaNorth"] },
    "TyrrhenianSeaNorth": { lat: 42.0, lon: 11.0, edges: ["TyrrhenianSeaSouth", "GenoaApproach", "WestMedNorth"] },
    "GenoaApproach": { lat: 44.0, lon: 9.0, edges: ["TyrrhenianSeaNorth", "WestMedNorth"] },
    
    "WestMedEast": { lat: 38.0, lon: 8.0, edges: ["SicilyStrait", "WestMedNorth", "WestMedWest"] },
    "WestMedNorth": { lat: 41.0, lon: 5.0, edges: ["WestMedEast", "TyrrhenianSeaNorth", "GenoaApproach", "BarcelonaApproach"] },
    "BarcelonaApproach": { lat: 41.0, lon: 2.5, edges: ["WestMedNorth", "WestMedWest"] },
    "WestMedWest": { lat: 37.0, lon: 1.0, edges: ["WestMedEast", "BarcelonaApproach", "GibraltarEast"] },
    "GibraltarEast": { lat: 36.2, lon: -4.0, edges: ["WestMedWest", "GibraltarStrait"] },
    "GibraltarStrait": { lat: 35.9, lon: -5.5, edges: ["GibraltarEast", "GibraltarWest"] },
    "GibraltarWest": { lat: 36.0, lon: -7.0, edges: ["GibraltarStrait", "PortugalCoastSouth", "MoroccoCoastNorth"] },
    
    // Europe Atlantic Coast & North Sea
    "PortugalCoastSouth": { lat: 37.0, lon: -9.5, edges: ["GibraltarWest", "PortugalCoastNorth"] },
    "PortugalCoastNorth": { lat: 41.0, lon: -9.5, edges: ["PortugalCoastSouth", "BiscaySouth"] },
    "BiscaySouth": { lat: 44.0, lon: -8.0, edges: ["PortugalCoastNorth", "BiscayNorth"] },
    "BiscayNorth": { lat: 47.0, lon: -6.0, edges: ["BiscaySouth", "EnglishChannelWest"] },
    
    "EnglishChannelWest": { lat: 49.0, lon: -4.5, edges: ["BiscayNorth", "EnglishChannelMid", "IrishSeaSouth"] },
    "IrishSeaSouth": { lat: 51.5, lon: -6.0, edges: ["EnglishChannelWest", "IrishSeaNorth"] },
    "IrishSeaNorth": { lat: 54.0, lon: -5.0, edges: ["IrishSeaSouth", "ScotlandWest"] },
    "ScotlandWest": { lat: 57.0, lon: -8.0, edges: ["IrishSeaNorth", "NorthAtlanticEast"] },
    
    "EnglishChannelMid": { lat: 50.0, lon: -1.0, edges: ["EnglishChannelWest", "EnglishChannelEast"] },
    "EnglishChannelEast": { lat: 51.0, lon: 1.5, edges: ["EnglishChannelMid", "NorthSeaSouth"] },
    "NorthSeaSouth": { lat: 52.5, lon: 3.5, edges: ["EnglishChannelEast", "RotterdamApproach", "NorthSeaMid"] },
    "RotterdamApproach": { lat: 52.0, lon: 4.0, edges: ["NorthSeaSouth", "AntwerpApproach"] },
    "AntwerpApproach": { lat: 51.5, lon: 3.0, edges: ["RotterdamApproach", "EnglishChannelEast"] },
    "NorthSeaMid": { lat: 55.0, lon: 4.0, edges: ["NorthSeaSouth", "NorthSeaNorth", "BalticApproach"] },
    "NorthSeaNorth": { lat: 58.0, lon: 2.0, edges: ["NorthSeaMid", "NorwegianSeaSouth"] },
    "NorwegianSeaSouth": { lat: 62.0, lon: 4.0, edges: ["NorthSeaNorth", "NorthAtlanticEast"] },
    
    "BalticApproach": { lat: 57.5, lon: 9.0, edges: ["NorthSeaMid", "Skagerrak"] },
    "Skagerrak": { lat: 57.8, lon: 10.5, edges: ["BalticApproach", "Kattegat"] },
    "Kattegat": { lat: 56.5, lon: 11.5, edges: ["Skagerrak", "BalticSeaWest"] },
    "BalticSeaWest": { lat: 54.5, lon: 13.0, edges: ["Kattegat", "BalticSeaMid"] },
    "BalticSeaMid": { lat: 56.0, lon: 18.0, edges: ["BalticSeaWest", "BalticSeaNorth", "GulfOfFinland"] },
    "BalticSeaNorth": { lat: 60.0, lon: 20.0, edges: ["BalticSeaMid", "GulfOfBothnia"] },
    "GulfOfBothnia": { lat: 63.0, lon: 20.0, edges: ["BalticSeaNorth"] },
    "GulfOfFinland": { lat: 59.5, lon: 25.0, edges: ["BalticSeaMid"] },
    
    // Africa Coast
    "MoroccoCoastNorth": { lat: 33.0, lon: -9.5, edges: ["GibraltarWest", "CanaryIslands"] },
    "CanaryIslands": { lat: 28.0, lon: -16.0, edges: ["MoroccoCoastNorth", "WestAfricaMid"] },
    "WestAfricaMid": { lat: 15.0, lon: -18.0, edges: ["CanaryIslands", "GuineaCoastWest"] },
    "GuineaCoastWest": { lat: 5.0, lon: -10.0, edges: ["WestAfricaMid", "GuineaCoastEast"] },
    "GuineaCoastEast": { lat: 2.0, lon: 0.0, edges: ["GuineaCoastWest", "AngolaCoast"] },
    "AngolaCoast": { lat: -10.0, lon: 10.0, edges: ["GuineaCoastEast", "NamibiaCoast"] },
    "NamibiaCoast": { lat: -25.0, lon: 13.0, edges: ["AngolaCoast", "CapeGoodHopeWest"] },
    "CapeGoodHopeWest": { lat: -34.5, lon: 18.0, edges: ["NamibiaCoast", "CapeGoodHopeEast"] },
    "CapeGoodHopeEast": { lat: -35.0, lon: 21.0, edges: ["CapeGoodHopeWest", "SouthAfricaEast"] },
    "SouthAfricaEast": { lat: -31.0, lon: 31.0, edges: ["CapeGoodHopeEast", "MozambiqueChannelSouth"] },
    "MozambiqueChannelSouth": { lat: -25.0, lon: 35.0, edges: ["SouthAfricaEast", "MozambiqueChannelNorth"] },
    "MozambiqueChannelNorth": { lat: -15.0, lon: 42.0, edges: ["MozambiqueChannelSouth", "TanzaniaCoast"] },
    "TanzaniaCoast": { lat: -5.0, lon: 40.0, edges: ["MozambiqueChannelNorth", "SomaliaCoastSouth"] },
    "SomaliaCoastSouth": { lat: 2.0, lon: 46.0, edges: ["TanzaniaCoast", "SomaliaCoastNorth"] },
    "SomaliaCoastNorth": { lat: 10.0, lon: 52.0, edges: ["SomaliaCoastSouth", "GulfOfAdenEast", "ArabianSeaMid"] },
    
    // Americas
    "NorthAtlanticEast": { lat: 55.0, lon: -15.0, edges: ["ScotlandWest", "NorthAtlanticMid", "NorwegianSeaSouth"] },
    "NorthAtlanticMid": { lat: 50.0, lon: -30.0, edges: ["NorthAtlanticEast", "NewfoundlandApproach"] },
    "NewfoundlandApproach": { lat: 45.0, lon: -50.0, edges: ["NorthAtlanticMid", "StLawrenceGulf", "USEastCoastNorth"] },
    "StLawrenceGulf": { lat: 47.0, lon: -60.0, edges: ["NewfoundlandApproach"] },
    
    "USEastCoastNorth": { lat: 40.0, lon: -70.0, edges: ["NewfoundlandApproach", "NewYorkApproach"] },
    "NewYorkApproach": { lat: 40.0, lon: -73.0, edges: ["USEastCoastNorth", "USEastCoastMid"] },
    "USEastCoastMid": { lat: 35.0, lon: -74.5, edges: ["NewYorkApproach", "USEastCoastSouth"] },
    "USEastCoastSouth": { lat: 30.0, lon: -80.0, edges: ["USEastCoastMid", "FloridaStraitNorth"] },
    
    "FloridaStraitNorth": { lat: 26.0, lon: -79.5, edges: ["USEastCoastSouth", "FloridaStraitSouth", "Bahamas"] },
    "FloridaStraitSouth": { lat: 24.0, lon: -82.0, edges: ["FloridaStraitNorth", "GulfOfMexicoEast"] },
    "GulfOfMexicoEast": { lat: 25.0, lon: -86.0, edges: ["FloridaStraitSouth", "HoustonApproach", "GulfOfMexicoWest"] },
    "HoustonApproach": { lat: 29.0, lon: -94.0, edges: ["GulfOfMexicoEast", "GulfOfMexicoWest"] },
    "GulfOfMexicoWest": { lat: 22.0, lon: -95.0, edges: ["HoustonApproach", "GulfOfMexicoEast", "YucatanChannel"] },
    "YucatanChannel": { lat: 21.0, lon: -86.0, edges: ["GulfOfMexicoWest", "CaribbeanWest"] },
    
    "Bahamas": { lat: 24.0, lon: -75.0, edges: ["FloridaStraitNorth", "CaribbeanEast"] },
    "CaribbeanEast": { lat: 18.0, lon: -65.0, edges: ["Bahamas", "CaribbeanMid"] },
    "CaribbeanMid": { lat: 15.0, lon: -73.0, edges: ["CaribbeanEast", "CaribbeanWest"] },
    "CaribbeanWest": { lat: 16.0, lon: -80.0, edges: ["CaribbeanMid", "YucatanChannel", "PanamaCanalEast"] },
    "PanamaCanalEast": { lat: 9.5, lon: -79.8, edges: ["CaribbeanWest", "PanamaCanalWest"] },
    "PanamaCanalWest": { lat: 8.5, lon: -79.6, edges: ["PanamaCanalEast", "USWestCoastSouth", "PeruCoast"] },
    
    "USWestCoastSouth": { lat: 15.0, lon: -95.0, edges: ["PanamaCanalWest", "BajaCaliforniaCoast"] },
    "BajaCaliforniaCoast": { lat: 25.0, lon: -115.0, edges: ["USWestCoastSouth", "LosAngelesApproach"] },
    "LosAngelesApproach": { lat: 33.5, lon: -118.5, edges: ["BajaCaliforniaCoast", "SanFranciscoApproach"] },
    "SanFranciscoApproach": { lat: 37.5, lon: -123.0, edges: ["LosAngelesApproach", "SeattleApproach", "NorthPacificMid"] },
    "SeattleApproach": { lat: 48.0, lon: -125.0, edges: ["SanFranciscoApproach", "AlaskaCoast"] },
    "AlaskaCoast": { lat: 55.0, lon: -140.0, edges: ["SeattleApproach", "NorthPacificMid"] },
    
    "PeruCoast": { lat: -10.0, lon: -80.0, edges: ["PanamaCanalWest", "ChileCoastNorth"] },
    "ChileCoastNorth": { lat: -25.0, lon: -72.0, edges: ["PeruCoast", "ChileCoastSouth"] },
    "ChileCoastSouth": { lat: -40.0, lon: -75.0, edges: ["ChileCoastNorth", "CapeHornWest"] },
    "CapeHornWest": { lat: -54.0, lon: -75.0, edges: ["ChileCoastSouth", "CapeHornEast"] },
    "CapeHornEast": { lat: -55.0, lon: -65.0, edges: ["CapeHornWest", "ArgentinaCoastSouth"] },
    "ArgentinaCoastSouth": { lat: -45.0, lon: -60.0, edges: ["CapeHornEast", "ArgentinaCoastNorth"] },
    "ArgentinaCoastNorth": { lat: -35.0, lon: -55.0, edges: ["ArgentinaCoastSouth", "BrazilCoastSouth"] },
    "BrazilCoastSouth": { lat: -25.0, lon: -45.0, edges: ["ArgentinaCoastNorth", "BrazilCoastMid"] },
    "BrazilCoastMid": { lat: -15.0, lon: -38.0, edges: ["BrazilCoastSouth", "BrazilCoastNorth"] },
    "BrazilCoastNorth": { lat: 0.0, lon: -45.0, edges: ["BrazilCoastMid", "CaribbeanEast"] },
    
    // Open Oceans
    "NorthPacificMid": { lat: 40.0, lon: 180.0, edges: ["SanFranciscoApproach", "AlaskaCoast", "PhilippineSeaNorth", "TokyoApproach"] },
    "MidPacific1": { lat: 15.0, lon: 150.0, edges: ["PhilippineSeaNorth", "MidPacific2"] },
    "MidPacific2": { lat: 10.0, lon: 180.0, edges: ["MidPacific1", "BajaCaliforniaCoast", "SouthPacificMid"] },
    "SouthPacificMid": { lat: -20.0, lon: -140.0, edges: ["MidPacific2", "ChileCoastNorth", "AustraliaEastCoast"] },
    
    "AustraliaWestCoast": { lat: -25.0, lon: 110.0, edges: ["IndianOceanEast", "AustraliaSouthCoast"] },
    "AustraliaSouthCoast": { lat: -35.0, lon: 130.0, edges: ["AustraliaWestCoast", "BassStrait"] },
    "BassStrait": { lat: -39.0, lon: 145.0, edges: ["AustraliaSouthCoast", "TasmanSeaMid"] },
    "AustraliaEastCoast": { lat: -25.0, lon: 155.0, edges: ["BassStrait", "CoralSea", "SouthPacificMid"] },
    "ArafuraSea": { lat: -10.0, lon: 135.0, edges: ["CoralSea", "TimorSea"] },
    "TasmanSeaMid": { lat: -35.0, lon: 160.0, edges: ["BassStrait", "NewZealandWest"] },
    "NewZealandWest": { lat: -40.0, lon: 170.0, edges: ["TasmanSeaMid", "SouthPacificMid"] }
};

const getSplinePoint = (t: number, p0: [number, number], p1: [number, number], p2: [number, number], p3: [number, number]): [number, number] => {
    const normalizeLon = (lon: number, base: number) => {
        if (lon - base > 180) return lon - 360;
        if (base - lon > 180) return lon + 360;
        return lon;
    };
    
    const lon1 = p1[1];
    const lon0 = normalizeLon(p0[1], lon1);
    const lon2 = normalizeLon(p2[1], lon1);
    const lon3 = normalizeLon(p3[1], lon1);

    const t2 = t * t;
    const t3 = t2 * t;
    
    let lon = 0.5 * ((2 * lon1) + (-lon0 + lon2) * t + (2 * lon0 - 5 * lon1 + 4 * lon2 - lon3) * t2 + (-lon0 + 3 * lon1 - 3 * lon2 + lon3) * t3);
    
    return [
        0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        lon
    ];
};

const getInterpolatedPosition = (p1: [number, number], p2: [number, number], fraction: number): [number, number] => {
    let lon2 = p2[1];
    if (lon2 - p1[1] > 180) lon2 -= 360;
    else if (p1[1] - lon2 > 180) lon2 += 360;
    return [
        p1[0] + (p2[0] - p1[0]) * fraction,
        p1[1] + (lon2 - p1[1]) * fraction
    ];
};

const createStraightSegment = (p1: [number, number], p2: [number, number], numPoints: number): [number, number][] => {
    const res: [number, number][] = [];
    for (let i = 0; i <= numPoints; i++) {
        res.push(getInterpolatedPosition(p1, p2, i / numPoints));
    }
    return res;
};

const makeContinuous = (pts: [number, number][]): [number, number][] => {
    if (pts.length === 0) return [];
    const res: [number, number][] = [[pts[0][0], pts[0][1]]];
    for (let i = 1; i < pts.length; i++) {
        let prevLon = res[i - 1][1];
        let currLon = pts[i][1];
        if (currLon - prevLon > 180) currLon -= 360;
        else if (prevLon - currLon > 180) currLon += 360;
        res.push([pts[i][0], currLon]);
    }
    return res;
};

const generateSmoothPath = (pts: [number, number][], segments = 10): [number, number][] => {
    if (pts.length < 2) return pts;
    if (pts.length === 2) {
        return createStraightSegment(pts[0], pts[1], segments);
    }
    
    const p0 = [2*pts[0][0] - pts[1][0], 2*pts[0][1] - pts[1][1]] as [number, number];
    const pn = [2*pts[pts.length-1][0] - pts[pts.length-2][0], 2*pts[pts.length-1][1] - pts[pts.length-2][1]] as [number, number];
    const p = [p0, ...pts, pn];
    
    const result: [number, number][] = [];
    for (let i = 1; i < p.length - 2; i++) {
        for (let t = 0; t <= 1; t += 1/segments) {
            if (t === 0 && i > 1) continue;
            result.push(getSplinePoint(t, p[i - 1], p[i], p[i + 1], p[i + 2]));
        }
    }
    return result;
};

const HAZARDS = [
    { id: "storm_scs", type: "storm", lat: 15.0, lon: 115.0, radius: 400, severity: "Critical" }, 
    { id: "storm_atl", type: "storm", lat: 30.0, lon: -65.0, radius: 500, severity: "High" },
    { id: "storm_pac", type: "storm", lat: 20.0, lon: 135.0, radius: 600, severity: "Critical" },
    { id: "storm_ind", type: "storm", lat: -10.0, lon: 80.0, radius: 450, severity: "Medium" },
    { id: "piracy_aden", type: "piracy", lat: 12.0, lon: 45.0, radius: 300, severity: "Critical" },
    { id: "piracy_malacca", type: "piracy", lat: 3.0, lon: 100.0, radius: 200, severity: "High" },
    { id: "naval_taiwan", type: "naval", lat: 24.0, lon: 120.0, radius: 150, severity: "High" },
    { id: "naval_blacksea", type: "naval", lat: 43.0, lon: 34.0, radius: 250, severity: "Critical" }
];

const findMaritimeRoute = (
    start: [number, number], 
    end: [number, number],
    pref: string = "Fastest",
    weather: boolean = false,
    piracy: boolean = false,
    naval: boolean = false
): [number, number][] => {
    let startWp = "", endWp = "";
    let minStartDist = Infinity, minEndDist = Infinity;
    
    if (calcDistance(start[0], start[1], end[0], end[1]) < 150) {
        return makeContinuous(createStraightSegment(start, end, 10));
    }

    for (const wp in WAYPOINTS) {
        const dStart = calcDistance(start[0], start[1], WAYPOINTS[wp].lat, WAYPOINTS[wp].lon);
        const dEnd = calcDistance(end[0], end[1], WAYPOINTS[wp].lat, WAYPOINTS[wp].lon);
        if (dStart < minStartDist) { minStartDist = dStart; startWp = wp; }
        if (dEnd < minEndDist) { minEndDist = dEnd; endWp = wp; }
    }

    if (startWp === endWp) {
        const path = [
            ...createStraightSegment(start, [WAYPOINTS[startWp].lat, WAYPOINTS[startWp].lon], 5),
            ...createStraightSegment([WAYPOINTS[startWp].lat, WAYPOINTS[startWp].lon], end, 5)
        ];
        return makeContinuous(path);
    }

    // Dijkstra
    const dists: Record<string, number> = {};
    const prev: Record<string, string> = {};
    const unvisited = new Set(Object.keys(WAYPOINTS));
    
    for (const wp in WAYPOINTS) dists[wp] = Infinity;
    dists[startWp] = 0;

    while (unvisited.size > 0) {
        let curr: string | null = null;
        let minDist = Infinity;
        for (const wp of unvisited) {
            if (dists[wp] < minDist) { minDist = dists[wp]; curr = wp; }
        }
        if (!curr || minDist === Infinity) break;
        if (curr === endWp) break;
        
        unvisited.delete(curr);
        
        for (const neighbor of WAYPOINTS[curr].edges) {
            if (!unvisited.has(neighbor)) continue;
            
            const nLat = WAYPOINTS[neighbor].lat;
            const nLon = WAYPOINTS[neighbor].lon;
            const d = calcDistance(WAYPOINTS[curr].lat, WAYPOINTS[curr].lon, nLat, nLon);
            
            let penalty = 1;
            HAZARDS.forEach(h => {
                if ((h.type === "storm" && weather) || (h.type === "piracy" && piracy) || (h.type === "naval" && naval)) {
                    const distToHaz = calcDistance(h.lat, h.lon, nLat, nLon);
                    if (distToHaz < h.radius * 1.2) { 
                        const sevMult = h.severity === "Critical" ? 4 : h.severity === "High" ? 2.5 : 1.5;
                        if (pref === "Safest") {
                            penalty += sevMult * 5; 
                        } else if (pref === "Fastest") {
                            penalty += sevMult * 0.5; 
                        } else {
                            penalty += sevMult * 1.5; 
                        }
                    }
                }
            });
            
            const alt = dists[curr] + (d * penalty);
            if (alt < dists[neighbor]) {
                dists[neighbor] = alt;
                prev[neighbor] = curr;
            }
        }
    }

    const pathWps: string[] = [];
    let u = endWp;
    if (prev[u] || u === startWp) {
        while (u) {
            pathWps.unshift(u);
            u = prev[u];
        }
    } else {
        const path = [
            ...createStraightSegment(start, [WAYPOINTS[startWp].lat, WAYPOINTS[startWp].lon], 5),
            ...createStraightSegment([WAYPOINTS[startWp].lat, WAYPOINTS[startWp].lon], end, 5)
        ];
        return makeContinuous(path);
    }

    const routePts: [number, number][] = [];
    for (const wp of pathWps) {
        routePts.push([WAYPOINTS[wp].lat, WAYPOINTS[wp].lon]);
    }
    
    let smoothedCorridor: [number, number][] = [];
    if (routePts.length > 1) {
        smoothedCorridor = generateSmoothPath(routePts, 15); 
    } else {
        smoothedCorridor = [routePts[0]];
    }
    
    const startSegment = createStraightSegment(start, routePts[0], 5);
    const endSegment = createStraightSegment(routePts[routePts.length - 1], end, 5);
    
    const finalPath = [
        ...startSegment, 
        ...smoothedCorridor.slice(1, -1), 
        ...endSegment
    ];
    return makeContinuous(finalPath);
};

const getPositionAlongPath = (path: [number, number][], fraction: number): [number, number] => {
    if (path.length === 0) return [0, 0];
    if (fraction <= 0) return path[0];
    if (fraction >= 1) return path[path.length - 1];
    
    const idxExact = fraction * (path.length - 1);
    const idx1 = Math.floor(idxExact);
    const idx2 = Math.ceil(idxExact);
    const t = idxExact - idx1;
    
    return getInterpolatedPosition(path[idx1], path[idx2], t);
};

const calcPathDistance = (path: [number, number][]) => {
    let d = 0;
    for(let i=0; i<path.length-1; i++){
        d += calcDistance(path[i][0], path[i][1], path[i+1][0], path[i+1][1]);
    }
    return d;
};

const getSeverityColor = (sev: string) => {
    switch (sev) {
        case "Low": return "#eab308"; // yellow
        case "Medium": return "#f97316"; // orange
        case "High": return "#ef4444"; // red
        case "Critical": return "#dc2626"; // flashing handled in css
        default: return "#22c55e"; // green
    }
};

function MapController({ source, dest, reroute }: { source?: [number, number], dest?: [number, number], reroute?: [number, number] }) {
    const map = useMap();
    useEffect(() => {
        if (source && dest) {
            const bounds = L.latLngBounds([source, dest]);
            if (reroute) bounds.extend(reroute);
            map.fitBounds(bounds, { padding: [50, 50], animate: true });
        }
    }, [source, dest, reroute, map]);
    return null;
}

interface EventLog {
    time: string;
    message: string;
    type: "info" | "warning" | "success" | "error" | "critical" | "ai_action";
}

export default function RouteSimulator() {
    const [sourcePort, setSourcePort] = useState("");
    const [destPort, setDestPort] = useState("");
    const [shipType, setShipType] = useState("");
    const [shipSize, setShipSize] = useState("");
    const [cargoType, setCargoType] = useState("");
    const [priority, setPriority] = useState("");
    const [delayTolerance, setDelayTolerance] = useState("");
    const [routingPref, setRoutingPref] = useState("");
    const [isHazardous, setIsHazardous] = useState(false);
    const [isPerishable, setIsPerishable] = useState(false);

    const [isSimDestCongested, setIsSimDestCongested] = useState(false);
    const [simCongestionSeverity, setSimCongestionSeverity] = useState("High");

    const [enableWeather, setEnableWeather] = useState(false);
    const [enablePiracy, setEnablePiracy] = useState(false);
    const [enableNaval, setEnableNaval] = useState(false);

    const [portDataList, setPortDataList] = useState<PortData[]>([]);

    const [simState, setSimState] = useState<"idle" | "running" | "paused" | "evaluating" | "rerouted" | "completed">("idle");
    const [simSpeed, setSimSpeed] = useState<number>(1);
    const [progress, setProgress] = useState(0); 
    const [rerouteProgress, setRerouteProgress] = useState(0);
    const [reroutePort, setReroutePort] = useState<PortData | null>(null);
    const [intersectionPoint, setIntersectionPoint] = useState<[number, number] | null>(null);
    const [shipStateText, setShipStateText] = useState("Idle");
    const [events, setEvents] = useState<EventLog[]>([]);
    const [lastEventProgress, setLastEventProgress] = useState(0);
    
    const [aiDecision, setAiDecision] = useState<{
        confidence: number;
        reason: string;
        tradeoff: string;
        factors: Array<{ name: string; score: number; max: number; isNegative: boolean }>;
        commentary: string;
        quality: string;
        action: string;
    } | null>(null);

    const [ecoDecision, setEcoDecision] = useState<{
        originalCost: number;
        rerouteCost: number;
        costSaved: number;
        fuelIncreased: number;
        delayAvoidedHrs: number;
        commentary: string;
        breakdown: {
            origFuel: number; origDelay: number; origRisk: number;
            newFuel: number; newDelay: number; newRisk: number; handling: number;
        }
    } | null>(null);

    const eventsEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        eventsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [events]);

    useEffect(() => {
        fetch("http://localhost:8000/api/map-data")
            .then(res => res.json())
            .then(data => setPortDataList(data))
            .catch(err => console.error("Failed to load map data", err));
    }, []);

    const srcObj = portDataList.find(p => p.port_name === sourcePort);
    const dstObj = portDataList.find(p => p.port_name === destPort);

    const srcPos: [number, number] | undefined = srcObj ? [srcObj.lat, srcObj.lon] : undefined;
    const dstPos: [number, number] | undefined = dstObj ? [dstObj.lat, dstObj.lon] : undefined;
    const rrPos: [number, number] | undefined = reroutePort ? [reroutePort.lat, reroutePort.lon] : undefined;

    const mainPolylinePositions = useMemo(() => {
        if (!srcPos || !dstPos) return [];
        return findMaritimeRoute(srcPos, dstPos, routingPref, enableWeather, enablePiracy, enableNaval);
    }, [srcPos, dstPos, routingPref, enableWeather, enablePiracy, enableNaval]);

    const rrPolylinePositions = useMemo(() => {
        if (!intersectionPoint || !rrPos) return [];
        return findMaritimeRoute(intersectionPoint, rrPos, routingPref, enableWeather, enablePiracy, enableNaval);
    }, [intersectionPoint, rrPos, routingPref, enableWeather, enablePiracy, enableNaval]);

    const originalDist = useMemo(() => calcPathDistance(mainPolylinePositions), [mainPolylinePositions]);
    const rerouteDist = useMemo(() => calcPathDistance(rrPolylinePositions), [rrPolylinePositions]);
    const traveledDist = useMemo(() => {
        if (!intersectionPoint || mainPolylinePositions.length === 0) return 0;
        const traveledPath = [];
        for(let i=0; i<mainPolylinePositions.length; i++){
            const frac = i / (mainPolylinePositions.length - 1);
            if(frac <= progress) traveledPath.push(mainPolylinePositions[i]);
            else break;
        }
        traveledPath.push(intersectionPoint);
        return calcPathDistance(traveledPath);
    }, [mainPolylinePositions, intersectionPoint, progress]);

    const totalNewDist = traveledDist + rerouteDist;
    const distDiff = totalNewDist - originalDist;
    
    const speedKmh = 40; // Approx 21 knots

    const getSimTimeStr = useCallback((p: number, isReroute = false) => {
        const baseDate = new Date();
        baseDate.setHours(8, 0, 0, 0);
        const simHours = isReroute 
            ? (traveledDist + (rerouteDist * p)) / speedKmh
            : (originalDist * p) / speedKmh;
        baseDate.setMinutes(baseDate.getMinutes() + (simHours || 0) * 60);
        return baseDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }, [originalDist, traveledDist, rerouteDist, speedKmh]);

    const logEvent = useCallback((msg: string, type: EventLog["type"], p: number, isReroute = false) => {
        setEvents(prev => [...prev, { time: getSimTimeStr(p, isReroute), message: msg, type }]);
    }, [getSimTimeStr]);

    useEffect(() => {
        let interval: any;
        if (simState === "running" && srcPos && dstPos && mainPolylinePositions.length > 0) {
            interval = setInterval(() => {
                setProgress(p => {
                    if (p >= 1) {
                        setSimState("completed");
                        setShipStateText("Arrived");
                        logEvent(`Vessel arrived successfully at ${destPort}`, "success", 1);
                        return 1;
                    }
                    const newP = p + (0.005 * simSpeed); 
                    
                    if (newP >= 0.1 && lastEventProgress < 0.1) {
                        setLastEventProgress(0.1);
                        logEvent(`Entered maritime corridor`, "info", newP);
                    }
                    if (newP >= 0.25 && lastEventProgress < 0.25) {
                        setLastEventProgress(0.25);
                        if (enableWeather) logEvent(`Severe storm cell detected in path`, "warning", newP);
                        else logEvent(`Weather conditions nominal`, "info", newP);
                    }
                    if (newP >= 0.35 && lastEventProgress < 0.35) {
                        setLastEventProgress(0.35);
                        if (enablePiracy) logEvent(`Piracy corridor risk elevated`, "critical", newP);
                        if (enableNaval) logEvent(`Restricted naval zone ahead`, "warning", newP);
                    }
                    if (newP >= 0.4 && isSimDestCongested && dstObj && lastEventProgress < 0.4) {
                        setLastEventProgress(0.4);
                        setShipStateText("Evaluating");
                        logEvent(`Destination congestion rising rapidly (${simCongestionSeverity})`, "critical", newP);
                        logEvent(`Queue delay projected at destination`, "warning", newP);
                        logEvent(`PortWatch AI evaluating alternatives`, "ai_action", newP);
                        setSimState("evaluating");
                        return p; 
                    }

                    if (newP >= 0.7 && !isSimDestCongested && lastEventProgress < 0.7) {
                        setLastEventProgress(0.7);
                        logEvent(`Initiated final docking sequence`, "info", newP);
                    }
                    
                    return newP;
                });
            }, 100);
        } else if (simState === "evaluating") {
            interval = setTimeout(() => {
                setShipStateText("Simulating Alternatives");
                logEvent(`Simulating alternative port routing...`, "ai_action", progress);
                
                setTimeout(() => {
                    setShipStateText("Selecting Optimal Route");
                    logEvent(`Cargo compatibility verified`, "info", progress);
                    
                    setTimeout(() => {
                        const metadataMap = portMetadataFull as Record<string, any>;
                        const alternatives = portDataList.filter(port => 
                            port.port_name !== sourcePort && 
                            port.port_name !== destPort && 
                            port.congestion_score < 0.4 &&
                            (!isHazardous || metadataMap[port.port_name]?.type !== "Bulk") 
                        );
                        
                        if (alternatives.length > 0) {
                            const sorted = alternatives.sort((a, b) => 
                                calcDistance(dstPos![0], dstPos![1], a.lat, a.lon) - 
                                calcDistance(dstPos![0], dstPos![1], b.lat, b.lon)
                            );
                            
                            const confidence = Math.floor(Math.random() * 15) + 82; // 82-96%
                            const delaySaved = Math.floor(Math.random() * 24) + 12; // 12-36 hrs
                            
                            const currentP = getPositionAlongPath(mainPolylinePositions, progress);
                            const dDest = calcDistance(currentP[0], currentP[1], dstPos![0], dstPos![1]);
                            const dNew = calcDistance(currentP[0], currentP[1], sorted[0].lat, sorted[0].lon);
                            const estAddedDist = Math.max(0, dNew - dDest);
                            const estFuelAdded = Math.round(estAddedDist * 0.15);
                            
                            let reasonStr = `Avoid ${simCongestionSeverity} Congestion`;
                            if (enableWeather && routingPref === "Safest") reasonStr = "Route adjusted to avoid severe storm activity.";
                            else if (routingPref === "Fuel Efficient") reasonStr = "Fuel-efficient corridor selected.";
                            else if (routingPref === "Safest") reasonStr = "Operational safety prioritized over ETA.";

                            let delaySavedFactor = Math.floor(delaySaved * 1.5);
                            let fuelPenaltyFactor = Math.floor(estFuelAdded * -0.5);
                            let congestionRedFactor = simCongestionSeverity === "Critical" ? 40 : 25;
                            let hazardAvoidanceFactor = enableWeather || enablePiracy || enableNaval ? 15 : 0;
                            if (routingPref === "Safest") hazardAvoidanceFactor += 15;
                            
                            let cargoFactor = 10;

                            const factors = [
                                { name: "Congestion Reduction", score: congestionRedFactor, max: 50, isNegative: false },
                                { name: "Delay Saved", score: delaySavedFactor, max: 40, isNegative: false },
                                { name: "Fuel Penalty", score: fuelPenaltyFactor, max: 20, isNegative: true }, 
                                { name: "Hazard Avoidance", score: hazardAvoidanceFactor, max: 30, isNegative: false },
                                { name: "Cargo Compatibility", score: cargoFactor, max: 10, isNegative: false }
                            ];
                            
                            let commentaryStr = `PortWatch AI selected ${sorted[0].port_name} due to lower congestion exposure and acceptable operational delay.`;
                            if (routingPref === "Safest" && hazardAvoidanceFactor > 0) {
                                commentaryStr = `PortWatch AI prioritized ${sorted[0].port_name} to navigate away from environmental hazards while minimizing queue delay.`;
                            } else if (routingPref === "Fastest") {
                                commentaryStr = `ETA optimized by selecting ${sorted[0].port_name}, accepting slight hazard exposure.`;
                            } else if (routingPref === "Fuel Efficient") {
                                commentaryStr = `Fuel impact increased slightly, but unloading delay was significantly reduced at ${sorted[0].port_name}.`;
                            }

                            // Economic Impact
                            const origDelayHrs = simCongestionSeverity === "Critical" ? 72 : 48;
                            const newDelayHrs = Math.max(0, origDelayHrs - delaySaved);
                            
                            let costPerHour = 5000;
                            if (isPerishable) costPerHour += 15000;
                            if (cargoType === "High Value") costPerHour += 10000;
                            if (shipType === "Bulk") costPerHour -= 2000;
                            if (isHazardous) costPerHour += 5000;
                            
                            let fuelPerKm = 0.2;
                            if (shipSize === "Panamax") fuelPerKm = 0.3;
                            if (shipSize === "Suezmax") fuelPerKm = 0.45;
                            if (shipSize === "VLCC") fuelPerKm = 0.6;
                            if (shipType === "Container") fuelPerKm *= 1.1;

                            const origFuelTons = originalDist * fuelPerKm;
                            const newFuelTons = totalNewDist * fuelPerKm;

                            const origFuelCost = origFuelTons * 600;
                            const newFuelCost = newFuelTons * 600;

                            const origDelayCost = origDelayHrs * costPerHour;
                            const newDelayCost = newDelayHrs * costPerHour;

                            const origRiskCost = (enableWeather || enablePiracy) ? 50000 : 0;
                            const newRiskCost = (enableWeather || enablePiracy) && routingPref !== "Safest" ? 25000 : 0;
                            const handlingCost = isHazardous ? 20000 : 0;

                            const origTotal = origFuelCost + origDelayCost + origRiskCost;
                            const newTotal = newFuelCost + newDelayCost + newRiskCost + handlingCost;
                            
                            const costSaved = origTotal - newTotal;
                            const fuelIncreased = newFuelTons - origFuelTons;
                            
                            let ecoCommentary = `Rerouting increased fuel usage slightly but reduced congestion delay significantly.`;
                            if (costSaved > 100000) ecoCommentary = `Massive operational savings achieved through congestion avoidance.`;
                            else if (isPerishable) ecoCommentary = `Delay-sensitive cargo prioritized to drastically reduce waiting penalty.`;
                            else if (routingPref === "Fuel Efficient") ecoCommentary = `Reroute balances fuel economy with moderate delay penalty reduction.`;

                            setEcoDecision({
                                originalCost: origTotal,
                                rerouteCost: newTotal,
                                costSaved,
                                fuelIncreased,
                                delayAvoidedHrs: delaySaved,
                                commentary: ecoCommentary,
                                breakdown: {
                                    origFuel: origFuelCost, origDelay: origDelayCost, origRisk: origRiskCost,
                                    newFuel: newFuelCost, newDelay: newDelayCost, newRisk: newRiskCost, handling: handlingCost
                                }
                            });

                            setReroutePort(sorted[0]);
                            setIntersectionPoint(currentP);
                            setAiDecision({
                                confidence,
                                reason: reasonStr,
                                tradeoff: `+${estFuelAdded} Tons Fuel / -${delaySaved}h Delay`,
                                factors,
                                commentary: commentaryStr,
                                quality: confidence > 90 ? "Optimal" : "Acceptable",
                                action: `Reroute to ${sorted[0].port_name}`
                            });
                            
                            setSimState("rerouted");
                            setShipStateText("Reroute Approved");
                            logEvent(`Reroute confidence exceeded threshold (${confidence}%)`, "ai_action", progress);
                            logEvent(`Alternative port approved: ${sorted[0].port_name}`, "success", progress);
                            logEvent(`Course redirected to new sea-lane`, "info", progress, true);
                            setLastEventProgress(0.4); 
                        } else {
                            setSimState("running"); 
                            setIsSimDestCongested(false); 
                            logEvent(`No valid alternatives found. Proceeding.`, "error", progress);
                        }
                    }, 1500 / simSpeed);
                }, 1000 / simSpeed);
            }, 1000 / simSpeed);
        } else if (simState === "rerouted" && intersectionPoint && rrPos && rrPolylinePositions.length > 0) {
            interval = setInterval(() => {
                setRerouteProgress(p => {
                    if (p >= 1) {
                        setSimState("completed");
                        setShipStateText("Arrived");
                        logEvent(`Vessel arrived successfully at ${reroutePort?.port_name}`, "success", 1, true);
                        return 1;
                    }
                    const newP = p + (0.005 * simSpeed);
                    if (newP >= 0.7 && lastEventProgress < 0.7) {
                        setLastEventProgress(0.7);
                        logEvent(`Initiated final docking sequence`, "info", newP, true);
                    }
                    return newP;
                });
            }, 100);
        }
        return () => {
            clearInterval(interval);
            clearTimeout(interval);
        };
    }, [simState, srcPos, dstPos, dstObj, portDataList, sourcePort, destPort, isHazardous, intersectionPoint, rrPos, isSimDestCongested, mainPolylinePositions, progress, simCongestionSeverity, reroutePort, simSpeed, lastEventProgress, logEvent, rrPolylinePositions]);

    const handleStart = () => {
        if (!srcObj || !dstObj) return;
        setEvents([]);
        setAiDecision(null);
        logEvent(`Vessel departed ${sourcePort}`, "info", 0);
        setSimState("running");
        setShipStateText("Sailing Normally");
        setProgress(0);
        setRerouteProgress(0);
        setReroutePort(null);
        setIntersectionPoint(null);
        setLastEventProgress(0);
    };

    const handlePause = () => {
        setSimState("paused");
        setShipStateText("Paused");
    };

    const handleResume = () => {
        if (reroutePort) setSimState("rerouted");
        else setSimState("running");
        setShipStateText(reroutePort ? "New Course Active" : "Sailing Normally");
    };

    const handleReset = () => {
        setSimState("idle");
        setShipStateText("Idle");
        setEvents([]);
        setAiDecision(null);
        setProgress(0);
        setRerouteProgress(0);
        setReroutePort(null);
        setIntersectionPoint(null);
        setLastEventProgress(0);
    };

    const currentShipPos = useMemo(() => {
        if (!srcPos || !dstPos || mainPolylinePositions.length === 0) return null;
        if (simState === "idle") return srcPos;
        if (simState === "running" || simState === "evaluating" || simState === "paused" || (simState === "completed" && !reroutePort)) {
            return getPositionAlongPath(mainPolylinePositions, progress);
        }
        if (simState === "rerouted" || (simState === "completed" && reroutePort)) {
            if (intersectionPoint && rrPos && rrPolylinePositions.length > 0) {
                return getPositionAlongPath(rrPolylinePositions, rerouteProgress);
            }
        }
        return srcPos;
    }, [srcPos, dstPos, mainPolylinePositions, progress, simState, reroutePort, intersectionPoint, rrPos, rrPolylinePositions, rerouteProgress]);


    
    
    const originalETA = Math.round(originalDist / speedKmh);
    const newETA = Math.round(totalNewDist / speedKmh);
    const hoursRemaining = simState === "idle" ? originalETA :
        (simState === "running" || simState === "evaluating") ? Math.round((originalDist * (1 - progress)) / speedKmh) :
        simState === "rerouted" ? Math.round((rerouteDist * (1 - rerouteProgress)) / speedKmh) : 0;
    
    const fuelImpact = Math.round(distDiff * 0.15); // Mock fuel multiplier
    const riskLevel = isSimDestCongested ? (simCongestionSeverity === "Critical" ? "Extreme" : "Elevated") : "Standard";

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <Title>Route Simulator</Title>
                    <Text>Configure simulation parameters to forecast route efficiency, congestion impact, and environmental cost.</Text>
                </div>
                {simState !== "idle" && (
                    <Button icon={ArrowPathIcon} color="slate" variant="secondary" onClick={handleReset}>
                        Reset Simulator
                    </Button>
                )}
            </div>

            <div className="flex flex-col xl:flex-row gap-6 items-stretch">
                {/* LEFT PANEL: Configuration */}
                <div className="w-full xl:w-[320px] flex-shrink-0">
                    <Card className="h-full bg-dark-tremor-background-subtle border-dark-tremor-border p-5 overflow-y-auto max-h-[80vh] custom-scrollbar">
                        <Title className="text-base mb-4">Scenario Controls</Title>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-slate-300">Dest Congested</label>
                                <Switch checked={isSimDestCongested} onChange={setIsSimDestCongested} color="rose" disabled={simState !== "idle"} />
                            </div>
                            {isSimDestCongested && (
                                <div className="animate-fade-in">
                                    <label className="text-xs font-medium text-slate-400 block mb-1">Severity</label>
                                    <Select value={simCongestionSeverity} onValueChange={setSimCongestionSeverity} disabled={simState !== "idle"}>
                                        <SelectItem value="Low">Low</SelectItem>
                                        <SelectItem value="Medium">Medium</SelectItem>
                                        <SelectItem value="High">High</SelectItem>
                                        <SelectItem value="Critical">Critical</SelectItem>
                                    </Select>
                                </div>
                            )}
                        </div>

                        <Divider className="my-6" />

                        <Title className="text-base mb-4">Environmental Conditions</Title>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-slate-300">Enable Weather Simulation</label>
                                <Switch checked={enableWeather} onChange={setEnableWeather} color="blue" disabled={simState !== "idle"} />
                            </div>
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-slate-300">Enable Piracy Risk</label>
                                <Switch checked={enablePiracy} onChange={setEnablePiracy} color="rose" disabled={simState !== "idle"} />
                            </div>
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-slate-300">Enable Restricted Zones</label>
                                <Switch checked={enableNaval} onChange={setEnableNaval} color="amber" disabled={simState !== "idle"} />
                            </div>
                        </div>

                        <Divider className="my-6" />

                        <Title className="text-base mb-4">Voyage Parameters</Title>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-medium text-slate-400 block mb-1">Source Port</label>
                                <Select value={sourcePort} onValueChange={setSourcePort} placeholder="Select Origin..." disabled={simState !== "idle"}>
                                    {ports.map(port => (
                                        <SelectItem key={`src-${port}`} value={port}>{port}</SelectItem>
                                    ))}
                                </Select>
                            </div>

                            <div>
                                <label className="text-xs font-medium text-slate-400 block mb-1">Destination Port</label>
                                <Select value={destPort} onValueChange={setDestPort} placeholder="Select Destination..." disabled={simState !== "idle"}>
                                    {ports.map(port => (
                                        <SelectItem key={`dst-${port}`} value={port}>{port}</SelectItem>
                                    ))}
                                </Select>
                            </div>
                        </div>

                        <Divider className="my-6" />

                        <Title className="text-base mb-4">Vessel Profile</Title>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-medium text-slate-400 block mb-1">Ship Type</label>
                                <Select value={shipType} onValueChange={setShipType} placeholder="Select Type...">
                                    <SelectItem value="Container">Container</SelectItem>
                                    <SelectItem value="Bulk">Bulk</SelectItem>
                                    <SelectItem value="Liquid">Liquid / Tanker</SelectItem>
                                </Select>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-slate-400 block mb-1">Ship Size</label>
                                <Select value={shipSize} onValueChange={setShipSize} placeholder="Select Size...">
                                    <SelectItem value="Feeder">Feeder (&lt; 3,000 TEU)</SelectItem>
                                    <SelectItem value="Panamax">Panamax (3,000 - 5,000 TEU)</SelectItem>
                                    <SelectItem value="Post-Panamax">Post-Panamax (5,000 - 10,000 TEU)</SelectItem>
                                    <SelectItem value="VLCC">VLCC / Ultra Large</SelectItem>
                                </Select>
                            </div>
                        </div>

                        <Divider className="my-6" />

                        <Title className="text-base mb-4">Cargo & Constraints</Title>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-medium text-slate-400 block mb-1">Cargo Type</label>
                                <Select value={cargoType} onValueChange={setCargoType} placeholder="Select Cargo...">
                                    <SelectItem value="General">General</SelectItem>
                                    <SelectItem value="High-Value">High-Value</SelectItem>
                                    <SelectItem value="Raw Materials">Raw Materials</SelectItem>
                                </Select>
                            </div>
                            
                            <div className="flex items-center justify-between pt-2">
                                <label className="text-sm text-slate-300">Hazardous Cargo</label>
                                <Switch checked={isHazardous} onChange={setIsHazardous} color="rose" />
                            </div>
                            
                            <div className="flex items-center justify-between">
                                <label className="text-sm text-slate-300">Perishable Cargo</label>
                                <Switch checked={isPerishable} onChange={setIsPerishable} color="teal" />
                            </div>
                        </div>

                        <Divider className="my-6" />

                        <Title className="text-base mb-4">Optimization Strategy</Title>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-medium text-slate-400 block mb-1">Routing Preference</label>
                                <Select value={routingPref} onValueChange={setRoutingPref} placeholder="Select Preference..." disabled={simState !== "idle"}>
                                    <SelectItem value="Fastest">Fastest Time</SelectItem>
                                    <SelectItem value="Cheapest">Lowest Cost</SelectItem>
                                    <SelectItem value="Safest">Safest Route</SelectItem>
                                    <SelectItem value="Fuel Efficient">Fuel Efficient</SelectItem>
                                </Select>
                            </div>
                        </div>

                        <div className="mt-8 space-y-3">
                            <div className="flex gap-2">
                                {simState === "idle" || simState === "completed" ? (
                                    <Button 
                                        className="flex-1" 
                                        icon={PlayIcon} 
                                        color="blue"
                                        disabled={!sourcePort || !destPort || sourcePort === destPort}
                                        onClick={handleStart}
                                    >
                                        Start
                                    </Button>
                                ) : simState === "paused" ? (
                                    <Button 
                                        className="flex-1" 
                                        icon={PlayIcon} 
                                        color="emerald"
                                        onClick={handleResume}
                                    >
                                        Resume
                                    </Button>
                                ) : (
                                    <Button 
                                        className="flex-1" 
                                        icon={PauseIcon} 
                                        color="orange"
                                        onClick={handlePause}
                                    >
                                        Pause
                                    </Button>
                                )}
                                <Button 
                                    className="flex-shrink-0" 
                                    icon={ArrowPathIcon} 
                                    color="slate"
                                    variant="secondary"
                                    disabled={simState === "idle"}
                                    onClick={handleReset}
                                >
                                    Reset
                                </Button>
                            </div>
                            <div className="flex items-center justify-between bg-slate-800/50 p-2 rounded-lg border border-slate-800">
                                <label className="text-xs font-medium text-slate-400">Simulation Speed</label>
                                <div className="flex gap-1">
                                    {[1, 2, 5].map(spd => (
                                        <button
                                            key={spd}
                                            onClick={() => setSimSpeed(spd)}
                                            className={`px-2 py-1 text-xs font-bold rounded transition-colors ${simSpeed === spd ? "bg-blue-600 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"}`}
                                        >
                                            {spd}x
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* CENTER PANEL: Map Component */}
                <div className="flex-1 min-w-0 flex flex-col relative rounded-xl overflow-hidden border border-dark-tremor-border">
                    {/* Floating Alerts */}
                    {(simState === "rerouted" || simState === "evaluating") && (
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-dark-tremor-background/90 border border-rose-500/50 text-slate-200 px-6 py-3 rounded-full shadow-2xl backdrop-blur-md flex items-center space-x-3">
                            <ExclamationTriangleIcon className="h-6 w-6 text-rose-500 animate-pulse" />
                            <div>
                                <p className="text-sm font-bold text-rose-400 leading-tight">
                                    {simState === "evaluating" ? "Destination Congested — Evaluating Alternatives" : "New Reroute Executed Successfully"}
                                </p>
                                <p className="text-xs text-slate-400">
                                    {simState === "evaluating" ? "Algorithm analyzing valid diversions..." : `Targeting nearest optimized port: ${reroutePort?.port_name}`}
                                </p>
                            </div>
                        </div>
                    )}
                    {simState === "completed" && (
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-dark-tremor-background/90 border border-emerald-500/50 text-slate-200 px-6 py-3 rounded-full shadow-2xl backdrop-blur-md flex items-center space-x-3">
                            <CheckCircleIcon className="h-6 w-6 text-emerald-500" />
                            <p className="text-sm font-bold text-emerald-400">Voyage Completed</p>
                        </div>
                    )}

                    <MapContainer
                        center={[20, 0]}
                        zoom={2}
                        className="h-[600px] xl:h-full min-h-[600px] w-full z-0 bg-slate-900"
                        zoomControl={false}
                    >
                        <TileLayer
                            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                        />
                        
                        <MapController source={srcPos} dest={dstPos} reroute={rrPos} />

                        {HAZARDS.map(h => {
                            if ((h.type === "storm" && enableWeather) || (h.type === "piracy" && enablePiracy) || (h.type === "naval" && enableNaval)) {
                                return (
                                    <Circle 
                                        key={h.id} 
                                        center={[h.lat, h.lon]} 
                                        radius={h.radius * 1000} 
                                        color={h.type === "storm" ? "#3b82f6" : h.type === "piracy" ? "#ef4444" : "#f59e0b"}
                                        fillColor={h.type === "storm" ? "#3b82f6" : h.type === "piracy" ? "#ef4444" : "#f59e0b"}
                                        className="animate-pulse"
                                        fillOpacity={0.15}
                                        weight={1}
                                    >
                                        <Tooltip permanent={false} sticky>
                                            <div className="bg-slate-900 border border-slate-700 p-2 rounded text-slate-200">
                                                <p className="text-xs font-bold uppercase">{h.severity} {h.type} Zone</p>
                                            </div>
                                        </Tooltip>
                                    </Circle>
                                );
                            }
                            return null;
                        })}

                        {portDataList.map((port) => (
                            <CircleMarker
                                key={port.port_id}
                                center={[port.lat, port.lon]}
                                radius={3}
                                color="#475569"
                                weight={1}
                                fillOpacity={0.6}
                            >
                                <Tooltip>{port.port_name}</Tooltip>
                            </CircleMarker>
                        ))}

                        {srcPos && (
                            <CircleMarker center={srcPos} radius={6} color="#3b82f6" fillColor="#3b82f6" fillOpacity={1}>
                                <Tooltip permanent direction="top" className="bg-slate-800 text-slate-200 border-none">Origin: {sourcePort}</Tooltip>
                            </CircleMarker>
                        )}
                        {dstPos && (
                            <CircleMarker 
                                center={dstPos} 
                                radius={6} 
                                color={isSimDestCongested ? getSeverityColor(simCongestionSeverity) : "#22c55e"} 
                                fillColor={isSimDestCongested ? getSeverityColor(simCongestionSeverity) : "#22c55e"} 
                                fillOpacity={1}
                                className={simCongestionSeverity === "Critical" && isSimDestCongested ? "animate-ping" : ""}
                            >
                                <Tooltip permanent direction="top" className="bg-slate-800 text-slate-200 border-none">Dest: {destPort}</Tooltip>
                            </CircleMarker>
                        )}

                        {rrPos && reroutePort && (
                            <CircleMarker center={rrPos} radius={6} color="#10b981" fillColor="#10b981" fillOpacity={1}>
                                <Tooltip permanent direction="bottom" className="bg-emerald-900 text-emerald-100 border-emerald-500">New Target: {reroutePort.port_name}</Tooltip>
                            </CircleMarker>
                        )}

                        {mainPolylinePositions.length > 0 && (
                            <Polyline 
                                positions={mainPolylinePositions} 
                                color={simState === "rerouted" || (simState === "completed" && reroutePort) ? "#ef4444" : "#3b82f6"} 
                                weight={3} 
                                dashArray={simState === "rerouted" || (simState === "completed" && reroutePort) ? "5, 10" : undefined}
                                opacity={0.7}
                            />
                        )}

                        {rrPolylinePositions.length > 0 && (
                            <Polyline 
                                positions={rrPolylinePositions} 
                                color="#10b981" 
                                weight={4}
                                className="animate-pulse"
                            />
                        )}

                        {currentShipPos && simState !== "idle" && (
                            <CircleMarker 
                                center={currentShipPos} 
                                radius={5} 
                                color="#ffffff" 
                                fillColor="#ffffff" 
                                fillOpacity={1}
                                className="shadow-2xl shadow-white drop-shadow-lg"
                            />
                        )}
                    </MapContainer>
                </div>

                {/* RIGHT PANEL: Intelligence Dashboard */}
                <div className="w-full xl:w-[320px] flex-shrink-0 flex flex-col space-y-5 max-h-[80vh] overflow-y-auto overflow-x-hidden custom-scrollbar pr-2 pb-6">
                    {/* Operational Metrics */}
                    <Card className="bg-dark-tremor-background border-dark-tremor-border p-5 shrink-0 shadow-lg">
                        <Title className="text-slate-300 text-sm font-semibold border-l-2 border-blue-500 pl-2 uppercase tracking-wider mb-5 flex justify-between items-center">
                            Operations
                            <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full normal-case tracking-normal">{shipStateText}</span>
                        </Title>
                        {!srcObj || !dstObj ? (
                            <Text className="text-xs text-slate-500">Configure origin and destination.</Text>
                        ) : (
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <Text className="text-xs text-slate-400">Total Route Dist.</Text>
                                    <Text className="text-sm font-bold text-slate-200">{Math.round(totalNewDist || originalDist).toLocaleString()} km</Text>
                                </div>
                                <div className="flex justify-between items-center">
                                    <Text className="text-xs text-blue-400">Remaining Time</Text>
                                    <Badge color={simState === "completed" ? "emerald" : "blue"}>{simState === "idle" ? "--" : `${hoursRemaining}h`}</Badge>
                                </div>
                                <div className="flex justify-between items-center">
                                    <Text className="text-xs text-slate-400">Speed Status</Text>
                                    <Text className="text-xs font-bold text-slate-200">{simState === "idle" || simState === "completed" || simState === "paused" ? "0" : speedKmh} km/h</Text>
                                </div>
                                <Divider className="my-3 opacity-50" />
                                <div className="flex justify-between items-center">
                                    <Text className="text-xs text-slate-400">Delay Added</Text>
                                    <Text className={`text-xs font-bold ${distDiff > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                                        {Math.round(distDiff / speedKmh)} hrs
                                    </Text>
                                </div>
                                <div className="flex justify-between items-center">
                                    <Text className="text-xs text-slate-400">Fuel Impact</Text>
                                    <Text className={`text-xs font-bold ${distDiff > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                                        {distDiff > 0 ? `+${fuelImpact} Tons` : "Standard"}
                                    </Text>
                                </div>
                            </div>
                        )}
                    </Card>

                    {/* Operational Risk */}
                    <Card className="bg-dark-tremor-background border-dark-tremor-border p-5 shrink-0 shadow-lg">
                        <Title className="text-slate-300 text-sm font-semibold border-l-2 border-amber-500 pl-2 uppercase tracking-wider mb-5 flex items-center gap-2">
                            <ShieldCheckIcon className="h-4 w-4 text-amber-500" /> Operational Risk
                        </Title>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <Text className="text-xs text-slate-400">Weather Risk</Text>
                                <Badge color={enableWeather ? "amber" : "emerald"}>{enableWeather ? "Elevated" : "Low"}</Badge>
                            </div>
                            <div className="flex justify-between items-center">
                                <Text className="text-xs text-slate-400">Piracy Exposure</Text>
                                <Badge color={enablePiracy ? "rose" : "emerald"}>{enablePiracy ? "High" : "Low"}</Badge>
                            </div>
                            <div className="flex justify-between items-center">
                                <Text className="text-xs text-slate-400">Route Stability</Text>
                                <Badge color={(enableWeather || enablePiracy || enableNaval) && routingPref !== "Safest" ? "rose" : "emerald"}>
                                    {(enableWeather || enablePiracy || enableNaval) && routingPref !== "Safest" ? "Volatile" : "Stable"}
                                </Badge>
                            </div>
                        </div>
                    </Card>

                    {/* Timeline Event Log */}
                    <Card className="bg-dark-tremor-background border-dark-tremor-border p-5 flex flex-col shrink-0 shadow-lg">
                        <Title className="text-slate-300 text-sm font-semibold border-l-2 border-indigo-500 pl-2 uppercase tracking-wider mb-4 flex items-center gap-2 shrink-0">
                            <ChartBarIcon className="h-4 w-4" /> Timeline Log
                        </Title>
                        <div className="space-y-3 overflow-y-auto max-h-[180px] custom-scrollbar pr-2 pb-2">
                            {events.length === 0 ? (
                                <Text className="text-xs text-slate-500 italic">No voyage events recorded yet.</Text>
                            ) : (
                                events.map((ev, idx) => (
                                    <div key={idx} className="flex flex-col border-b border-slate-800 pb-2 last:border-0 animate-fade-in">
                                        <span className="text-[10px] text-slate-500">{ev.time}</span>
                                        <span className={`text-xs font-medium mt-0.5 ${
                                            ev.type === "info" ? "text-blue-400" : 
                                            ev.type === "warning" ? "text-amber-400" : 
                                            ev.type === "critical" ? "text-rose-400 font-bold" : 
                                            ev.type === "success" ? "text-emerald-400" : 
                                            ev.type === "ai_action" ? "text-cyan-400 font-bold drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]" : 
                                            "text-slate-400"
                                        }`}>
                                            {ev.message}
                                        </span>
                                    </div>
                                ))
                            )}
                            <div ref={eventsEndRef} />
                        </div>
                    </Card>

                    {/* AI Decision Engine */}
                    {aiDecision && (
                        <Card className="bg-dark-tremor-background border-dark-tremor-border p-5 animate-fade-in relative overflow-hidden shrink-0 shadow-lg mt-2">
                            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent pointer-events-none" />
                            <Title className="text-cyan-400 text-sm font-semibold border-l-2 border-cyan-400 pl-2 uppercase tracking-wider mb-5 flex items-center justify-between drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]">
                                <span className="flex items-center gap-2"><CpuChipIcon className="h-4 w-4" /> AI Route Decision Analysis</span>
                                <Badge color={aiDecision.quality === "Optimal" ? "emerald" : "blue"} size="xs" className="font-bold tracking-widest">{aiDecision.quality}</Badge>
                            </Title>
                            <div className="space-y-5 relative">
                                {/* Final Action */}
                                <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700 shadow-inner">
                                    <Text className="text-[10px] text-slate-500 font-semibold tracking-wide uppercase mb-1">Recommended Action</Text>
                                    <Text className="text-sm text-slate-200 font-bold">{aiDecision.action}</Text>
                                    <Text className="text-[11px] text-slate-400 mt-2 italic leading-relaxed">"{aiDecision.commentary}"</Text>
                                </div>

                                {/* Factors */}
                                <div>
                                    <Text className="text-[10px] text-slate-500 font-semibold tracking-wide uppercase mb-3">Weighted Scoring Factors</Text>
                                    <div className="space-y-3">
                                        {aiDecision.factors.map((f, idx) => (
                                            <div key={idx}>
                                                <div className="flex justify-between items-center mb-1">
                                                    <Text className="text-[10px] text-slate-300">{f.name}</Text>
                                                    <Text className={`text-[10px] font-bold ${f.isNegative ? 'text-rose-400' : 'text-emerald-400'}`}>
                                                        {f.score > 0 ? `+${f.score}` : f.score}
                                                    </Text>
                                                </div>
                                                <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden flex">
                                                    {f.isNegative ? (
                                                        <div className="h-full bg-rose-500" style={{ width: `${Math.min(100, (Math.abs(f.score) / f.max) * 100)}%` }} />
                                                    ) : (
                                                        <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, (f.score / f.max) * 100)}%` }} />
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <Divider className="my-2 opacity-50" />

                                {/* Confidence Score */}
                                <div className="flex items-center justify-between">
                                    <Text className="text-xs text-slate-400 font-semibold uppercase">Overall Confidence</Text>
                                    <div className="flex items-center gap-3">
                                        <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                            <div className="h-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.8)]" style={{ width: `${aiDecision.confidence}%` }} />
                                        </div>
                                        <Text className="text-sm font-bold text-cyan-400 drop-shadow-[0_0_3px_rgba(34,211,238,0.8)]">
                                            {aiDecision.confidence}%
                                        </Text>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    )}

                    {/* Operational Cost Impact */}
                    {ecoDecision && (
                        <Card className="bg-dark-tremor-background border-dark-tremor-border p-5 animate-fade-in shrink-0 shadow-lg mt-2">
                            <Title className="text-slate-300 text-sm font-semibold border-l-2 border-indigo-500 pl-2 uppercase tracking-wider mb-5 flex items-center justify-between">
                                <span className="flex items-center gap-2"><ChartBarIcon className="h-4 w-4 text-indigo-400" /> Operational Cost Impact</span>
                            </Title>
                            <div className="space-y-5">
                                {/* Insights */}
                                <div className="bg-slate-800/30 p-3 rounded-lg border border-slate-700/50 shadow-inner">
                                    <Text className="text-[10px] text-slate-500 font-semibold tracking-wide uppercase mb-1">Economic Insight</Text>
                                    <Text className="text-xs text-slate-300 italic leading-relaxed">"{ecoDecision.commentary}"</Text>
                                </div>

                                {/* Financial Impact Badges */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="flex flex-col bg-slate-900/50 p-2.5 rounded border border-slate-800">
                                        <Text className="text-[10px] text-slate-400 font-semibold uppercase mb-1">Cost Saved</Text>
                                        <Text className={`text-sm font-bold ${ecoDecision.costSaved > 0 ? 'text-emerald-400 drop-shadow-[0_0_2px_rgba(52,211,153,0.8)]' : 'text-rose-400'}`}>
                                            {ecoDecision.costSaved > 0 ? '+' : ''}${Math.round(ecoDecision.costSaved).toLocaleString()}
                                        </Text>
                                    </div>
                                    <div className="flex flex-col bg-slate-900/50 p-2.5 rounded border border-slate-800">
                                        <Text className="text-[10px] text-slate-400 font-semibold uppercase mb-1">Delay Avoided</Text>
                                        <Text className="text-sm font-bold text-emerald-400">
                                            {ecoDecision.delayAvoidedHrs} Hrs
                                        </Text>
                                    </div>
                                    <div className="flex flex-col bg-slate-900/50 p-2.5 rounded border border-slate-800">
                                        <Text className="text-[10px] text-slate-400 font-semibold uppercase mb-1">Fuel Increased</Text>
                                        <Text className="text-sm font-bold text-rose-400">
                                            {Math.round(ecoDecision.fuelIncreased)} Tons
                                        </Text>
                                    </div>
                                    <div className="flex flex-col bg-slate-900/50 p-2.5 rounded border border-slate-800">
                                        <Text className="text-[10px] text-slate-400 font-semibold uppercase mb-1">Risk Reduced</Text>
                                        <Text className="text-sm font-bold text-emerald-400">
                                            ${(ecoDecision.breakdown.origRisk - ecoDecision.breakdown.newRisk).toLocaleString()}
                                        </Text>
                                    </div>
                                </div>

                                <Divider className="my-2 opacity-50" />

                                {/* Detailed Breakdown Comparison */}
                                <div>
                                    <Text className="text-[10px] text-slate-500 font-semibold tracking-wide uppercase mb-3">Cost Breakdown</Text>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-slate-400">Fuel Cost</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-slate-500 line-through">${Math.round(ecoDecision.breakdown.origFuel).toLocaleString()}</span>
                                                <span className="text-rose-400 font-bold">${Math.round(ecoDecision.breakdown.newFuel).toLocaleString()}</span>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-slate-400">Delay Penalty</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-slate-500 line-through">${Math.round(ecoDecision.breakdown.origDelay).toLocaleString()}</span>
                                                <span className="text-emerald-400 font-bold">${Math.round(ecoDecision.breakdown.newDelay).toLocaleString()}</span>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-slate-400">Risk & Handling</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-slate-500 line-through">${Math.round(ecoDecision.breakdown.origRisk).toLocaleString()}</span>
                                                <span className="text-emerald-400 font-bold">${Math.round(ecoDecision.breakdown.newRisk + ecoDecision.breakdown.handling).toLocaleString()}</span>
                                            </div>
                                        </div>
                                        <div className="pt-2 mt-2 border-t border-slate-700/50 flex justify-between items-center">
                                            <span className="text-xs font-bold text-slate-300">Total Est. Cost</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-slate-500 line-through">${Math.round(ecoDecision.originalCost).toLocaleString()}</span>
                                                <span className={`text-sm font-bold ${ecoDecision.costSaved > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                                    ${Math.round(ecoDecision.rerouteCost).toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    )}

                    {/* Route Comparison */}
                    {(simState === "rerouted" || (simState === "completed" && reroutePort)) && (
                        <Card className="bg-dark-tremor-background border-dark-tremor-border p-5 animate-fade-in shrink-0 shadow-lg mt-2">
                            <Title className="text-slate-300 text-sm font-semibold border-l-2 border-indigo-400 pl-2 uppercase tracking-wider mb-5 flex items-center gap-2">
                                <ArrowPathIcon className="h-4 w-4" /> Route Comparison
                            </Title>
                            <div className="space-y-4">
                                <div>
                                    <Text className="text-[10px] text-slate-500 font-bold mb-2 tracking-wide uppercase">Original Route (Abandoned)</Text>
                                    <div className="grid grid-cols-3 gap-2 bg-slate-800/30 p-2.5 rounded-lg">
                                        <div className="flex flex-col">
                                            <Text className="text-[10px] text-slate-400 font-medium mb-0.5">ETA</Text>
                                            <Text className="text-xs text-slate-300 line-through">{originalETA}h</Text>
                                        </div>
                                        <div className="flex flex-col">
                                            <Text className="text-[10px] text-slate-400 font-medium mb-0.5">Fuel</Text>
                                            <Text className="text-xs text-slate-300 line-through">Std</Text>
                                        </div>
                                        <div className="flex flex-col">
                                            <Text className="text-[10px] text-slate-400 font-medium mb-0.5">Risk</Text>
                                            <Text className="text-xs text-rose-400 font-semibold">{simCongestionSeverity}</Text>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <Text className="text-[10px] text-emerald-500 font-bold mb-2 tracking-wide uppercase">New Route (Active)</Text>
                                    <div className="grid grid-cols-3 gap-2 bg-emerald-900/10 p-2.5 rounded-lg border border-emerald-500/20">
                                        <div className="flex flex-col">
                                            <Text className="text-[10px] text-emerald-500/80 font-medium mb-0.5">ETA</Text>
                                            <Text className="text-xs text-emerald-400 font-bold">{newETA}h</Text>
                                        </div>
                                        <div className="flex flex-col">
                                            <Text className="text-[10px] text-emerald-500/80 font-medium mb-0.5">Fuel</Text>
                                            <Text className="text-xs text-emerald-400 font-bold">+{fuelImpact}T</Text>
                                        </div>
                                        <div className="flex flex-col">
                                            <Text className="text-[10px] text-emerald-500/80 font-medium mb-0.5">Risk</Text>
                                            <Text className="text-xs text-emerald-400 font-bold">Low</Text>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    )}

                    {/* Congestion Target */}
                    {simState !== "rerouted" && !(simState === "completed" && reroutePort) && (
                        <Card className="bg-dark-tremor-background border-dark-tremor-border p-5 shrink-0 shadow-lg">
                            <Title className="text-slate-300 text-sm font-semibold border-l-2 border-orange-500 pl-2 uppercase tracking-wider mb-5 flex items-center gap-2">
                                <MapPinIcon className="h-4 w-4" /> Destination Status
                            </Title>
                            {!dstObj ? (
                                <Text className="text-xs text-slate-500">Awaiting destination.</Text>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <Text className="text-xs text-slate-400">Current Target</Text>
                                        <Text className="text-sm font-bold text-slate-200">{destPort}</Text>
                                    </div>
                                    <div className="flex justify-between items-center pt-1">
                                        <Text className="text-xs text-slate-400">Risk Level</Text>
                                        <Badge color={simState === "completed" ? "emerald" : isSimDestCongested ? "rose" : "emerald"} className="font-bold">
                                            {simState === "completed" ? "Secured" : riskLevel}
                                        </Badge>
                                    </div>
                                </div>
                            )}
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
