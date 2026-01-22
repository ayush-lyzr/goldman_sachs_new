/**
 * Customer configuration data
 * Each customer has a unique ID, name, and fidessa_catalog (their allowed values)
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

export interface Customer {
  id: string;
  name: string;
  fidessa_catalog: CustomerCatalog;
}

/**
 * Available customers in the system
 * Add more customers here as needed
 */
export const CUSTOMERS: Customer[] = [
  {
    id: "client-1",
    name: "Client 1",
    fidessa_catalog: {
      Issuer_Country: "US,GB,DE,FR,JP,IN,CN,CA,AU,CH,SE,NO,BR,MX,SG,XX",
      Coupon_Rate: "0.0-12.0%",
      Sector: "Financials,Government,Industrial,Utilities,Energy,Real Estate,Communications,Consumer,Healthcare,Technology,Transport,Supranational",
      Instrument_Type: "Sovereign,Supranational,Corporate,Agency,Municipal,Sukuk",
      Composite_Rating: "AAA,AA+,AA,AA-,A+,A,A-,BBB+,BBB,BBB-,BB+,BB,BB-,B+,B,B-,CCC+,CCC,CCC-,CC,C,D,NR",
      IG_Flag: "Yes,No",
      Days_to_Maturity: "1-10957",
      Shariah_Compliant: "Yes,No",
    },
  },
  {
    id: "client-2",
    name: "Client 2",
    fidessa_catalog: {
      Issuer_Country: "US,GB,DE,FR,JP,IN,CN,CA,AU,CH,SE,NO,BR,MX,SG,XX",
      Instrument_Type: "Sovereign,Corporate,Sukuk",
      Composite_Rating: "AAA,AA+,AA,AA-,A+,A,A-,BBB+,BBB,BBB-,BB+,BB,BB-,B+,B,B-,CCC+,CCC,CCC-,CC,C,D,NR",
      IG_Flag: "Yes,No",
      Sector: "Government,Financials,Industrial,Utilities,Energy,Real Estate,Communications,Consumer,Healthcare,Technology,Transport,Supranational",
      Coupon_Rate: "0.0-12.0%",
      Days_to_Maturity: "1-10957",
      Shariah_Compliant: "Yes",
    },
  },
  {
    id: "client-3",
    name: "Client 3",
    fidessa_catalog: {
      Issuer_Country: "US,GB,DE,FR,JP,IN,CN,CA,AU,CH,SE,NO,BR,MX,SG,XX",
      Instrument_Type: "Sovereign,Supranational,Agency,Corporate",
      Composite_Rating: "AAA,AA+,AA,AA-,A+,A,A-,BBB+,BBB,BBB-,BB+,BB,BB-,B+,B,B-,CCC+,CCC,CCC-,CC,C,D,NR",
      IG_Flag: "Conditional: Yes if Issuer_Country is Developing; No if Issuer_Country is Developed",
      Sector: "Government,Supranational,Financials,Industrial,Utilities,Energy,Real Estate,Communications,Consumer,Healthcare,Technology,Transport",
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
