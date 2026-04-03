import { mapTripFromDb } from "../../services/tripMapper";

describe("mapTripFromDb", () => {
  test("returns null for null input", () => {
    expect(mapTripFromDb(null)).toBeNull();
  });

  test("maps legacy DB trip row to normalized app shape", () => {
    const trip = {
      id: "trip_1",
      status: "in_progress",
      created_at: "2026-01-01T00:00:00.000Z",
      pickup_location: JSON.stringify({
        address: "Pickup Address",
      }),
      dropoff_location: {
        formatted_address: "Dropoff Address",
      },
      pickup_photos: ["https://example.com/a.jpg"],
      pricing: {
        total: 44.2,
        distance: 11.3,
        durationMinutes: 37,
      },
      items: [
        { value: 30 },
        { value: "20.5" },
      ],
      insurance_booking_id: "ins_1",
      insurance_status: "purchased",
      insurance_premium: "4.25",
      customer_id: "customer_1",
      driver_id: "driver_1",
    };

    const result = mapTripFromDb(trip);

    expect(result).not.toBeNull();
    expect(result.id).toBe("trip_1");
    expect(result.status).toBe("inProgress");
    expect(result.pickupAddress).toBe("Pickup Address");
    expect(result.dropoffAddress).toBe("Dropoff Address");
    expect(result.pickupPhotos).toEqual(["https://example.com/a.jpg"]);
    expect(result.distance).toBe(11.3);
    expect(result.duration).toBe(37);
    expect(result.itemValue).toBe(50.5);
    expect(result.customerId).toBe("customer_1");
    expect(result.driverId).toBe("driver_1");
    expect(result.insurance).toEqual({
      included: true,
      purchaseFailed: false,
      bookingId: "ins_1",
      quoteId: null,
      premium: 4.25,
      status: "purchased",
    });
  });

  test("prefers actual duration for completed trips when lifecycle timestamps are available", () => {
    const trip = {
      id: "trip_2",
      status: "completed",
      created_at: "2026-04-08T09:00:00.000Z",
      picked_up_at: "2026-04-08T10:00:00.000Z",
      completed_at: "2026-04-08T10:26:30.000Z",
      pickup_location: {
        address: "Pickup Address",
        pricing: {
          durationMinutes: 42,
        },
      },
      dropoff_location: {
        address: "Dropoff Address",
      },
    };

    const result = mapTripFromDb(trip);

    expect(result.actualDurationMinutes).toBe(27);
    expect(result.durationMinutes).toBe(27);
    expect(result.duration).toBe(27);
  });
});
