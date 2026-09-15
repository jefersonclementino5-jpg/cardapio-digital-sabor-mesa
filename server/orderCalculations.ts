export type PricedLine = {
  unitPriceCents: number;
  quantity: number;
};

export function calculateOrderTotals(lines: PricedLine[], serviceChargeEnabled: boolean) {
  const subtotalCents = lines.reduce(
    (sum, line) => sum + line.unitPriceCents * line.quantity,
    0,
  );
  const serviceChargeCents = serviceChargeEnabled ? Math.round(subtotalCents * 0.1) : 0;

  return {
    subtotalCents,
    serviceChargeCents,
    totalCents: subtotalCents + serviceChargeCents,
  };
}

export function calculateChangeCents(
  totalCents: number,
  cashReceivedCents: number | null,
  needsChange: boolean,
) {
  if (!needsChange) return 0;
  if (cashReceivedCents == null || cashReceivedCents < totalCents) return null;
  return cashReceivedCents - totalCents;
}
