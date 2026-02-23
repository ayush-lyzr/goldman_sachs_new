/**
 * Customer configuration data
 * Each customer has a unique ID, name, and versioned fidessa_catalog (v1 and v2).
 * - Both versions: Issuer_Country without XX, Composite_Rating without NR.
 * - v1: IG_Flag and Shariah_Compliant = "Yes" only.
 * - v2: IG_Flag and Shariah_Compliant = "No" only.
 * - v2: Fewer countries in Issuer_Country and fewer sectors in Sector.
 */

export interface CustomerCatalog {
  Issuer_Country: string;
  Coupon_Rate: string;
  Sector: string;
  Instrument_Type: string;
  Composite_Rating: string;
  IG_Flag: string;
  Days_to_Maturity: string;
  Shariah_Compliant: string;
}

export type RulesVersion = "v1" | "v2";

export interface Customer {
  id: string;
  name: string;
  /** Default catalog (v1) for backward compatibility */
  fidessa_catalog: CustomerCatalog;
  /** Version 1: IG_Flag and Shariah_Compliant = Yes */
  fidessa_catalog_v1: CustomerCatalog;
  /** Version 2: fewer countries/sectors, IG_Flag and Shariah_Compliant = No */
  fidessa_catalog_v2: CustomerCatalog;
}

// Issuer_Country without XX (both versions)
const ISSUER_COUNTRY_BASE = "US,GB,DE,FR,JP,IN,CN,CA,AU,CH,SE,NO,BR,MX,SG";
// v2: fewer countries (remove BR,MX,IN,CN,NO)
const ISSUER_COUNTRY_V2 = "US,GB,DE,FR,JP,CA,AU,CH,SE,SG";

// Composite_Rating without NR (both versions)
const COMPOSITE_RATING_BASE = "AAA,AA+,AA,AA-,A+,A,A-,BBB+,BBB,BBB-,BB+,BB,BB-,B+,B,B-,CCC+,CCC,CCC-,CC,C,D";

// Sector v2: fewer (remove Supranational, Transport, Real Estate)
const SECTOR_V1_CLIENT1 = "Financials,Government,Industrial,Utilities,Energy,Real Estate,Communications,Consumer,Healthcare,Technology,Transport,Supranational";
const SECTOR_V2_CLIENT1 = "Financials,Government,Industrial,Utilities,Energy,Communications,Consumer,Healthcare,Technology";

const SECTOR_V1_CLIENT2 = "Government,Financials,Industrial,Utilities,Energy,Real Estate,Communications,Consumer,Healthcare,Technology,Transport,Supranational";
const SECTOR_V2_CLIENT2 = "Government,Financials,Industrial,Utilities,Energy,Communications,Consumer,Healthcare,Technology";

const SECTOR_V1_CLIENT3 = "Government,Supranational,Financials,Industrial,Utilities,Energy,Real Estate,Communications,Consumer,Healthcare,Technology,Transport";
const SECTOR_V2_CLIENT3 = "Government,Financials,Industrial,Utilities,Energy,Communications,Consumer,Healthcare,Technology";

/** Available customers with versioned catalogs */
export const CUSTOMERS: Customer[] = [
  {
    id: "client-1",
    name: "Client 1",
    fidessa_catalog: {
      Issuer_Country: ISSUER_COUNTRY_BASE,
      Coupon_Rate: "0.0-12.0%",
      Sector: SECTOR_V1_CLIENT1,
      Instrument_Type: "Sovereign,Supranational,Corporate,Agency,Municipal,Sukuk",
      Composite_Rating: COMPOSITE_RATING_BASE,
      IG_Flag: "Yes",
      Days_to_Maturity: "1-10957",
      Shariah_Compliant: "Yes",
    },
    fidessa_catalog_v1: {
      Issuer_Country: ISSUER_COUNTRY_BASE,
      Coupon_Rate: "0.0-12.0%",
      Sector: SECTOR_V1_CLIENT1,
      Instrument_Type: "Sovereign,Supranational,Corporate,Agency,Municipal,Sukuk",
      Composite_Rating: COMPOSITE_RATING_BASE,
      IG_Flag: "Yes",
      Days_to_Maturity: "1-10957",
      Shariah_Compliant: "Yes",
    },
    fidessa_catalog_v2: {
      Issuer_Country: ISSUER_COUNTRY_V2,
      Coupon_Rate: "0.0-12.0%",
      Sector: SECTOR_V2_CLIENT1,
      Instrument_Type: "Sovereign,Supranational,Corporate,Agency,Municipal,Sukuk",
      Composite_Rating: COMPOSITE_RATING_BASE,
      IG_Flag: "No",
      Days_to_Maturity: "1-10957",
      Shariah_Compliant: "No",
    },
  },
  {
    id: "client-2",
    name: "Client 2",
    fidessa_catalog: {
      Issuer_Country: ISSUER_COUNTRY_BASE,
      Instrument_Type: "Sovereign,Corporate,Sukuk",
      Composite_Rating: COMPOSITE_RATING_BASE,
      IG_Flag: "Yes",
      Sector: SECTOR_V1_CLIENT2,
      Coupon_Rate: "0.0-12.0%",
      Days_to_Maturity: "1-10957",
      Shariah_Compliant: "Yes",
    },
    fidessa_catalog_v1: {
      Issuer_Country: ISSUER_COUNTRY_BASE,
      Instrument_Type: "Sovereign,Corporate,Sukuk",
      Composite_Rating: COMPOSITE_RATING_BASE,
      IG_Flag: "Yes",
      Sector: SECTOR_V1_CLIENT2,
      Coupon_Rate: "0.0-12.0%",
      Days_to_Maturity: "1-10957",
      Shariah_Compliant: "Yes",
    },
    fidessa_catalog_v2: {
      Issuer_Country: ISSUER_COUNTRY_V2,
      Instrument_Type: "Sovereign,Corporate,Sukuk",
      Composite_Rating: COMPOSITE_RATING_BASE,
      IG_Flag: "No",
      Sector: SECTOR_V2_CLIENT2,
      Coupon_Rate: "0.0-12.0%",
      Days_to_Maturity: "1-10957",
      Shariah_Compliant: "No",
    },
  },
  {
    id: "client-3",
    name: "Client 3",
    fidessa_catalog: {
      Issuer_Country: ISSUER_COUNTRY_BASE,
      Instrument_Type: "Sovereign,Supranational,Agency,Corporate",
      Composite_Rating: COMPOSITE_RATING_BASE,
      IG_Flag: "Yes",
      Sector: SECTOR_V1_CLIENT3,
      Coupon_Rate: "0.0-12.0%",
      Days_to_Maturity: "1-10957",
      Shariah_Compliant: "Yes",
    },
    fidessa_catalog_v1: {
      Issuer_Country: ISSUER_COUNTRY_BASE,
      Instrument_Type: "Sovereign,Supranational,Agency,Corporate",
      Composite_Rating: COMPOSITE_RATING_BASE,
      IG_Flag: "Yes",
      Sector: SECTOR_V1_CLIENT3,
      Coupon_Rate: "0.0-12.0%",
      Days_to_Maturity: "1-10957",
      Shariah_Compliant: "Yes",
    },
    fidessa_catalog_v2: {
      Issuer_Country: ISSUER_COUNTRY_V2,
      Instrument_Type: "Sovereign,Supranational,Agency,Corporate",
      Composite_Rating: COMPOSITE_RATING_BASE,
      IG_Flag: "No",
      Sector: SECTOR_V2_CLIENT3,
      Coupon_Rate: "0.0-12.0%",
      Days_to_Maturity: "1-10957",
      Shariah_Compliant: "No",
    },
  },
];

/**
 * Get a customer by ID
 */
export function getCustomerById(id: string): Customer | undefined {
  return CUSTOMERS.find((c) => c.id === id);
}

/**
 * Get the default customer (first in the list)
 */
export function getDefaultCustomer(): Customer {
  return CUSTOMERS[0];
}

/**
 * Get catalog for a customer and version
 */
export function getCatalogForVersion(
  customer: Customer,
  version: RulesVersion
): CustomerCatalog {
  return version === "v2" ? customer.fidessa_catalog_v2 : customer.fidessa_catalog_v1;
}
