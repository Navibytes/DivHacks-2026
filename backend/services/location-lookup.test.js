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
