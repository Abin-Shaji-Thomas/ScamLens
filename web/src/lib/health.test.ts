import { describe, expect, it } from "vitest";
import { getHealth, HealthResponse } from "./health";

describe("health", () => {
  it("returns {ok:true}", () => {
    expect(getHealth()).toEqual({ ok: true });
  });

  it("schema rejects ok:false", () => {
    expect(HealthResponse.safeParse({ ok: false }).success).toBe(false);
  });
});
