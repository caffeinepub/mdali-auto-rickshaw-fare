import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface DriverProfile {
    name: string;
    upi_id: string;
    phone: string;
    licence: string;
}
export type Time = bigint;
export interface Trip {
    waiting_minutes: bigint;
    total_fare: number;
    timestamp: Time;
    is_night: boolean;
    distance_km: number;
}
export interface backendInterface {
    addTrip(distance_km: number, waiting_minutes: bigint, total_fare: number, is_night: boolean): Promise<void>;
    getLast10Trips(): Promise<Array<Trip>>;
    getProfile(): Promise<DriverProfile>;
    saveProfile(name: string, phone: string, licence: string, upi_id: string): Promise<void>;
}
