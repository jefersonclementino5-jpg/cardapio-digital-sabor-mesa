import { describe, expect, it } from "vitest";
import { calculateChangeCents, calculateOrderTotals } from "./orderCalculations";

describe("calculateOrderTotals", () => {
  it("calcula subtotal, serviço opcional e total com precisão em centavos", () => {
    expect(
      calculateOrderTotals(
        [
          { unitPriceCents: 2490, quantity: 2 },
          { unitPriceCents: 3690, quantity: 1 },
        ],
        true,
      ),
    ).toEqual({ subtotalCents: 8670, serviceChargeCents: 867, totalCents: 9537 });
  });

  it("remove integralmente os 10% quando a taxa está desmarcada", () => {
    expect(calculateOrderTotals([{ unitPriceCents: 20000, quantity: 1 }], false)).toEqual({
      subtotalCents: 20000,
      serviceChargeCents: 0,
      totalCents: 20000,
    });
  });

  it("calcula o troco quando o cliente entrega dinheiro suficiente", () => {
    expect(calculateChangeCents(1969, 5000, true)).toBe(3031);
    expect(calculateChangeCents(1969, 1800, true)).toBeNull();
    expect(calculateChangeCents(1969, null, false)).toBe(0);
  });
});
