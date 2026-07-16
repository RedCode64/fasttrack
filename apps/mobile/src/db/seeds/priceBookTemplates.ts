import type { PriceBookKind, Trade } from "@fasttrack/schema";

/**
 * Ported verbatim from the live `price_book_templates` table (Plan 2 doc,
 * migration 6). Duplicated here because the mobile app seeds offline; Plan 5
 * sync reconciles the two sources — keep row-for-row identical until then.
 */
export interface PriceBookTemplate {
  readonly trade: Trade;
  readonly kind: PriceBookKind;
  readonly name: string;
  readonly unit: string;
  readonly unitCostCents: number;
  readonly defaultMarkupPct: number;
}

const row = (
  trade: Trade,
  kind: PriceBookKind,
  name: string,
  unit: string,
  unitCostCents: number,
  defaultMarkupPct: number,
): PriceBookTemplate => ({ trade, kind, name, unit, unitCostCents, defaultMarkupPct });

export const PRICE_BOOK_TEMPLATES: readonly PriceBookTemplate[] = [
  row("electrical", "material", "200A panel — Square D QO", "ea", 42000, 3500),
  row("electrical", "material", "SER 4/0 aluminum cable", "ft", 1200, 4000),
  row("electrical", "material", "AFCI breaker 20A", "ea", 4900, 4500),
  row("electrical", "material", "12/2 Romex NM-B", "ft", 95, 5000),
  row("electrical", "material", "Duplex receptacle, TR", "ea", 380, 6000),
  row("electrical", "material", "LED recessed light 6in", "ea", 2400, 4500),
  row("electrical", "labor", "Service change labor", "hr", 6500, 5500),
  row("electrical", "labor", "Rough-in labor", "hr", 6000, 5500),
  row("electrical", "labor", "Troubleshooting", "hr", 7500, 5000),
  row("plumbing", "material", "40gal gas water heater", "ea", 68000, 3500),
  row("plumbing", "material", "3/4in copper pipe type L", "ft", 890, 4500),
  row("plumbing", "material", "PEX-A 1/2in", "ft", 110, 5000),
  row("plumbing", "material", "Kitchen faucet, mid-grade", "ea", 18500, 4000),
  row("plumbing", "material", "Wax ring + bolts", "ea", 650, 6000),
  row("plumbing", "labor", "Water heater swap labor", "hr", 7000, 5500),
  row("plumbing", "labor", "Drain clearing", "hr", 6500, 5000),
  row("plumbing", "labor", "Fixture install labor", "hr", 6000, 5500),
  row("hvac", "material", "3-ton 16 SEER condenser", "ea", 210000, 3000),
  row("hvac", "material", "Evaporator coil", "ea", 85000, 3500),
  row("hvac", "material", "R-410A refrigerant", "lb", 1800, 5000),
  row("hvac", "material", "Programmable thermostat", "ea", 9500, 4500),
  row("hvac", "labor", "Changeout labor", "hr", 8500, 5000),
  row("hvac", "labor", "Maintenance visit", "hr", 7000, 5500),
  row("general_contracting", "material", "2x4x8 stud", "ea", 450, 4000),
  row("general_contracting", "material", "1/2in drywall 4x8", "sheet", 1400, 4000),
  row("general_contracting", "material", "Interior paint, gallon", "gal", 3800, 4500),
  row("general_contracting", "labor", "Carpentry labor", "hr", 5500, 5500),
  row("general_contracting", "labor", "Demo labor", "hr", 4500, 5000),
  row("handyman", "material", "Misc fasteners/consumables", "job", 1500, 6000),
  row("handyman", "labor", "Handyman labor", "hr", 5500, 5500),
  row("other", "labor", "Labor", "hr", 6000, 5500),
];
