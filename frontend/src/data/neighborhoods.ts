// Rough neighborhood centers, used to place newly added spots on the map
// until the backend geocodes real addresses.
export const neighborhoods: { name: string; lat: number; lng: number }[] = [
  { name: "SoHo", lat: 40.7233, lng: -74.003 },
  { name: "West Village", lat: 40.7358, lng: -74.0036 },
  { name: "Greenwich Village", lat: 40.7336, lng: -73.999 },
  { name: "East Village", lat: 40.7265, lng: -73.9815 },
  { name: "Lower East Side", lat: 40.715, lng: -73.9843 },
  { name: "Williamsburg", lat: 40.7081, lng: -73.9571 },
];
