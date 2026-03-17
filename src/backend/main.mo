import List "mo:core/List";
import Time "mo:core/Time";
import Array "mo:core/Array";
import Map "mo:core/Map";
import Runtime "mo:core/Runtime";
import Principal "mo:core/Principal";

actor {
  type Trip = {
    distance_km : Float;
    waiting_minutes : Nat;
    total_fare : Float;
    is_night : Bool;
    timestamp : Time.Time;
  };

  type DriverProfile = {
    name : Text;
    phone : Text;
    licence : Text;
    upi_id : Text;
  };

  let tripHistory = Map.empty<Principal, List.List<Trip>>();
  let driverProfiles = Map.empty<Principal, DriverProfile>();

  public shared ({ caller }) func addTrip(distance_km : Float, waiting_minutes : Nat, total_fare : Float, is_night : Bool) : async () {
    let profile = driverProfiles.get(caller);
    if (profile == null) {
      Runtime.trap("Driver profile not found");
    };

    let trip : Trip = {
      distance_km;
      waiting_minutes;
      total_fare;
      is_night;
      timestamp = Time.now();
    };

    let existingHistory = switch (tripHistory.get(caller)) {
      case (null) { List.empty<Trip>() };
      case (?trips) { trips };
    };

    existingHistory.add(trip);
    tripHistory.add(caller, existingHistory);
  };

  public query ({ caller }) func getLast10Trips() : async [Trip] {
    switch (tripHistory.get(caller)) {
      case (null) { [] };
      case (?trips) { trips.toArray().sliceToArray(0, 10) };
    };
  };

  public shared ({ caller }) func saveProfile(name : Text, phone : Text, licence : Text, upi_id : Text) : async () {
    let profile : DriverProfile = {
      name;
      phone;
      licence;
      upi_id;
    };
    driverProfiles.add(caller, profile);
  };

  public query ({ caller }) func getProfile() : async DriverProfile {
    switch (driverProfiles.get(caller)) {
      case (null) { Runtime.trap("Driver profile not found") };
      case (?profile) { profile };
    };
  };
};
