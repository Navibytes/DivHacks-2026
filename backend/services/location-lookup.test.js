import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import { lookupVenue } from "./location-lookup.js";

const originalFetch = globalThis.fetch;
const originalEndpoint = process.env.NOMINATIM_URL;
let sequence = 0;
let rows;
let requests;
beforeEach(() => {
  process.env.NOMINATIM_URL = `https://locations.test/${++sequence}`;
  rows = [{ name: "Strand Bookstore", lat: "40.7332796", lon: "-73.9909401", address: { house_number: "828", road: "Broadway", city: "New York" } }];
  requests = [];
  globalThis.fetch = async () => {
    requests.push(Date.now());
    return new Response(JSON.stringify(rows));
  };
});
after(() => {
  globalThis.fetch = originalFetch;
  if (originalEndpoint === undefined) delete process.env.NOMINATIM_URL;
  else process.env.NOMINATIM_URL = originalEndpoint;
});

test("simultaneous and repeated identical queries share one cached response", async () => {
  const results = await Promise.all([lookupVenue("Strand Book Store", "New York City"), lookupVenue("Strand Book Store", "New York City")]);
  assert.equal(results[0].latitude, 40.7332796);
  assert.deepEqual(results[0], results[1]);
  await lookupVenue("Strand Book Store", "New York City");
  assert.equal(requests.length, 1);
});

test("different searches are spaced at least one second apart", async () => {
  await Promise.all([lookupVenue("Strand Bookstore", "New York"), lookupVenue("Strand Bookstore", "828 Broadway, New York")]);
  assert.equal(requests.length, 2);
  assert.ok(requests[1] - requests[0] >= 1000);
});

test("ambiguous branches and conflicting street numbers are rejected", async () => {
  rows.push({ ...rows[0], lat: "40.7764195", lon: "-73.9818364", address: { ...rows[0].address, house_number: "2020" } });
  assert.equal(await lookupVenue("Strand Bookstore", "New York"), null);
  assert.equal(await lookupVenue("Strand Bookstore", "123 Broadway, New York"), null);
  const exact = await lookupVenue("Strand Bookstore", "828 Broadway, New York");
  assert.equal(exact.latitude, 40.7332796);
});

test("Google Places is used first when GOOGLE_PLACES_API_KEY is set", async () => {
  process.env.GOOGLE_PLACES_API_KEY = "test-key";
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push(String(url));
    if (String(url).startsWith("https://places.googleapis.com/")) {
      assert.equal(init.headers["X-Goog-Api-Key"], "test-key");
      assert.match(init.headers["X-Goog-FieldMask"], /places\.location/);
      return new Response(JSON.stringify({
        places: [{
          displayName: { text: "Blank Street Coffee" },
          formattedAddress: "140 Prince St, New York, NY 10012, USA",
          location: { latitude: 40.7264761, longitude: -74.0020131 },
          addressComponents: [{ longText: "SoHo", types: ["neighborhood", "political"] }],
          googleMapsUri: "https://maps.google.com/?cid=123",
        }],
      }));
    }
    return new Response(JSON.stringify(rows));
  };
  try {
    const found = await lookupVenue("Blank Street", "SoHo, New York");
    assert.equal(found.latitude, 40.7264761);
    assert.equal(found.location, "140 Prince St, New York, NY 10012");
    assert.equal(found.neighborhood, "SoHo");
    assert.equal(found.mapLink, "https://maps.google.com/?cid=123");
    assert.equal(calls.filter((url) => url.startsWith("https://places.googleapis.com/")).length, 1);
    assert.equal(calls.filter((url) => url.startsWith("https://locations.test/")).length, 0);
  } finally {
    delete process.env.GOOGLE_PLACES_API_KEY;
  }
});

test("a Google result with a different name or an error falls back to Nominatim", async () => {
  process.env.GOOGLE_PLACES_API_KEY = "test-key";
  let googleStatus = 200;
  globalThis.fetch = async (url) => {
    if (String(url).startsWith("https://places.googleapis.com/")) {
      if (googleStatus !== 200) return new Response("quota", { status: googleStatus });
      return new Response(JSON.stringify({
        places: [{ displayName: { text: "Christian Book Store" }, formattedAddress: "1 5th Ave, Brooklyn, NY", location: { latitude: 40.64, longitude: -74.01 } }],
      }));
    }
    return new Response(JSON.stringify(rows));
  };
  try {
    const wrongName = await lookupVenue("Strand Bookstore", "828 Broadway, New York");
    assert.equal(wrongName.latitude, 40.7332796); // Nominatim's Strand, not Google's other store
    googleStatus = 429;
    const failed = await lookupVenue("Strand Bookstore", "Broadway, Manhattan");
    assert.equal(failed.latitude, 40.7332796);
  } finally {
    delete process.env.GOOGLE_PLACES_API_KEY;
  }
});
