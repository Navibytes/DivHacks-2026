import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import { lookupVenue } from "./location-lookup.js";

const originalFetch = globalThis.fetch;
const originalKey = process.env.GOOGLE_MAPS_API_KEY;
let results;
let queries;
const candidate = (name, number, route, city, latitude, longitude) => ({
  id: `${number}-${route}`,
  displayName: { text: name },
  formattedAddress: `${number} ${route}, ${city}, NY 10003, USA`,
  location: { latitude, longitude },
  addressComponents: [
    { longText: String(number), types: ["street_number"] },
    { longText: route, types: ["route"] },
    { longText: city, types: ["locality"] },
  ],
});

beforeEach(() => {
  process.env.GOOGLE_MAPS_API_KEY = "test-key";
  results = [candidate("Strand Bookstore", "828", "Broadway", "New York", 40.7332796, -73.9909401)];
  queries = [];
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://places.googleapis.com/v1/places:searchText");
    assert.equal(options.headers["X-Goog-Api-Key"], "test-key");
    assert.ok(options.headers["X-Goog-FieldMask"].includes("places.location"));
    queries.push(JSON.parse(options.body).textQuery);
    return new Response(JSON.stringify({ places: results }));
  };
});
after(() => {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.GOOGLE_MAPS_API_KEY;
  else process.env.GOOGLE_MAPS_API_KEY = originalKey;
});

test("venue search returns the matching address and coordinates", async () => {
  const place = await lookupVenue("Strand Book Store", "New York City");
  assert.equal(place.name, "Strand Bookstore");
  assert.equal(place.location, "828 Broadway, New York, NY 10003, USA");
  assert.equal(place.latitude, 40.7332796);
});

test("multiple city branches are rejected; a street-number clue disambiguates", async () => {
  results.push(candidate("Strand Bookstore", "2020", "Broadway", "New York", 40.7764195, -73.9818364));
  assert.equal(await lookupVenue("Strand Bookstore", "New York City"), null);
  const place = await lookupVenue("Strand Bookstore", "828 Broadway, New York");
  assert.equal(place.latitude, 40.7332796);
});

test("address-only fallback preserves the extracted name and checks number, street, and city", async () => {
  results = [candidate("Office Building", "828", "Broadway", "New York", 40.7332796, -73.9909401)];
  const place = await lookupVenue("Strand Bookstore", "828 Broadway, New York");
  assert.equal(place.name, "Strand Bookstore");
  assert.equal(place.latitude, 40.7332796);
  results = [candidate("Other Building", "123", "Broadway", "Boston", 42.36, -71.06)];
  assert.equal(await lookupVenue("Strand Bookstore", "828 Broadway, New York"), null);
});

test("lookup requires a Google Maps Platform key", async () => {
  delete process.env.GOOGLE_MAPS_API_KEY;
  await assert.rejects(lookupVenue("Strand Bookstore", "New York"), { statusCode: 503, message: /GOOGLE_MAPS_API_KEY/ });
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
