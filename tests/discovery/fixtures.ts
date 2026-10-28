// Synthetic fixtures shaped like real provider responses. The businesses are
// fictional ("Ejemplo") and exist only to exercise the parsers.
import type { SearchArea } from "@/lib/domain/types";
import type { OverpassElement } from "@/lib/discovery/providers/osm-parse";

export const area: SearchArea = {
  displayName: "Madrid, Comunidad de Madrid, España",
  latitude: 40.4167,
  longitude: -3.7036,
  boundingBox: [40.31, 40.64, -3.89, -3.51],
  osmType: "relation",
  osmId: 5326784,
  countryCode: "ES",
};

export const overpassElements: OverpassElement[] = [
  {
    type: "node",
    id: 1,
    lat: 40.42,
    lon: -3.7,
    tags: {
      amenity: "dentist",
      name: "Clínica Dental Ejemplo",
      website: "www.dental-ejemplo.test",
      phone: "+34 910 000 001",
      "addr:street": "Calle Falsa",
      "addr:housenumber": "1",
      "addr:postcode": "28001",
      opening_hours: "Mo-Fr 09:00-20:00",
      "contact:instagram": "dentalejemplo",
    },
  },
  {
    type: "way",
    id: 2,
    center: { lat: 40.43, lon: -3.69 },
    tags: { healthcare: "dentist", name: "Dentista Sin Datos Ejemplo" },
  },
  {
    type: "node",
    id: 3,
    lat: 40.44,
    lon: -3.68,
    tags: { amenity: "dentist", name: "Ortodoncia Ejemplo", website: "https://www.facebook.com/ortoejemplo" },
  },
  { type: "node" as const, id: 4, lat: 40.45, lon: -3.67, tags: { amenity: "dentist" } },
  { type: "node" as const, id: 5, lat: 40.46, lon: -3.66, tags: { "disused:amenity": "dentist", name: "Cerrada Ejemplo" } },
];

export const googlePlace = {
  id: "ChIJ-ejemplo-1",
  displayName: { text: "Clínica Dental Ejemplo" },
  primaryType: "dentist",
  primaryTypeDisplayName: { text: "Dentista" },
  formattedAddress: "Calle Falsa, 1, 28001 Madrid, España",
  addressComponents: [
    { longText: "1", shortText: "1", types: ["street_number"] },
    { longText: "Calle Falsa", shortText: "C. Falsa", types: ["route"] },
    { longText: "28001", shortText: "28001", types: ["postal_code"] },
    { longText: "Madrid", shortText: "Madrid", types: ["locality", "political"] },
    { longText: "España", shortText: "ES", types: ["country", "political"] },
  ],
  location: { latitude: 40.42005, longitude: -3.70003 },
  websiteUri: "https://dental-ejemplo.test/",
  internationalPhoneNumber: "+34 910 00 00 01",
  regularOpeningHours: { weekdayDescriptions: ["lunes: 9:00–20:00"] },
  rating: 4.6,
  userRatingCount: 213,
  googleMapsUri: "https://maps.google.com/?cid=1",
  businessStatus: "OPERATIONAL",
};
