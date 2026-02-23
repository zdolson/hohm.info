import { describe, it, expect } from "vitest";
import {
  parseListingsSearchParams,
  buildListingsWhere,
  type ListingsSearchParams,
} from "@/lib/search";

describe("parseListingsSearchParams", () => {
  it("returns defaults for empty or undefined", () => {
    expect(parseListingsSearchParams(undefined).page).toBe(1);
    expect(parseListingsSearchParams({}).tags).toBeUndefined();
    expect(parseListingsSearchParams({}).bedrooms).toBeUndefined();
  });

  it("parses single tag slug", () => {
    expect(parseListingsSearchParams({ tags: "ranch" }).tags).toEqual([
      "ranch",
    ]);
    expect(parseListingsSearchParams({ tags: "  slate-roof  " }).tags).toEqual([
      "slate-roof",
    ]);
  });

  it("parses comma-separated tags", () => {
    expect(
      parseListingsSearchParams({ tags: "ranch,brick-exterior" }).tags
    ).toEqual(["ranch", "brick-exterior"]);
  });

  it("parses array of tags", () => {
    expect(
      parseListingsSearchParams({ tags: ["ranch", "brick-exterior"] }).tags
    ).toEqual(["ranch", "brick-exterior"]);
  });

  it("filters invalid slugs from tags", () => {
    expect(
      parseListingsSearchParams({ tags: "ranch,INVALID,brick-exterior" }).tags
    ).toEqual(["ranch", "brick-exterior"]);
  });

  it("parses numeric params", () => {
    const p = parseListingsSearchParams({
      bedrooms: "3",
      bathroomsFull: "2",
      garageSpaces: "1",
      squareFootageMin: "1000",
      squareFootageMax: "2500",
    });
    expect(p.bedrooms).toBe(3);
    expect(p.bathroomsFull).toBe(2);
    expect(p.garageSpaces).toBe(1);
    expect(p.squareFootageMin).toBe(1000);
    expect(p.squareFootageMax).toBe(2500);
  });

  it("ignores invalid or negative numbers", () => {
    expect(
      parseListingsSearchParams({ bedrooms: "x" }).bedrooms
    ).toBeUndefined();
    expect(
      parseListingsSearchParams({ bedrooms: "-1" }).bedrooms
    ).toBeUndefined();
    expect(
      parseListingsSearchParams({ bedrooms: "" }).bedrooms
    ).toBeUndefined();
  });

  it("parses page and clamps to at least 1", () => {
    expect(parseListingsSearchParams({ page: "2" }).page).toBe(2);
    expect(parseListingsSearchParams({ page: "0" }).page).toBe(1);
  });

  it("parses state, city, address, propertyType, status", () => {
    const p = parseListingsSearchParams({
      state: "MI",
      city: "Grand Rapids",
      address: "Wealthy",
      propertyType: "singleFamily",
      status: "active",
    });
    expect(p.state).toBe("MI");
    expect(p.city).toBe("Grand Rapids");
    expect(p.address).toBe("Wealthy");
    expect(p.propertyType).toBe("singleFamily");
    expect(p.status).toBe("active");
  });

  it("rejects invalid tags (XSS / non-slug)", () => {
    expect(
      parseListingsSearchParams({ tags: "<script>alert(1)</script>" }).tags
    ).toBeUndefined();
    expect(parseListingsSearchParams({ tags: "UPPER" }).tags).toBeUndefined();
    expect(
      parseListingsSearchParams({ tags: "has space" }).tags
    ).toBeUndefined();
  });

  it("accepts valid slug for tags", () => {
    expect(parseListingsSearchParams({ tags: "valid-slug" }).tags).toEqual([
      "valid-slug",
    ]);
  });

  it("rejects propertyType not in allowlist", () => {
    expect(
      parseListingsSearchParams({ propertyType: "invalid" }).propertyType
    ).toBeUndefined();
    expect(
      parseListingsSearchParams({ propertyType: "hacked'; DROP TABLE--" })
        .propertyType
    ).toBeUndefined();
  });

  it("accepts propertyType in allowlist", () => {
    expect(
      parseListingsSearchParams({ propertyType: "condo" }).propertyType
    ).toBe("condo");
  });

  it("rejects status not in allowlist", () => {
    expect(
      parseListingsSearchParams({ status: "hacked" }).status
    ).toBeUndefined();
  });

  it("drops state over max length", () => {
    expect(
      parseListingsSearchParams({ state: "a".repeat(51) }).state
    ).toBeUndefined();
    expect(
      parseListingsSearchParams({ state: "a".repeat(50) }).state
    ).toHaveLength(50);
  });

  it("drops city over max length", () => {
    expect(
      parseListingsSearchParams({ city: "a".repeat(101) }).city
    ).toBeUndefined();
    expect(
      parseListingsSearchParams({ city: "a".repeat(100) }).city
    ).toHaveLength(100);
  });

  it("drops address over max length", () => {
    expect(
      parseListingsSearchParams({ address: "a".repeat(201) }).address
    ).toBeUndefined();
    expect(
      parseListingsSearchParams({ address: "a".repeat(200) }).address
    ).toHaveLength(200);
  });

  it("clamps numerics to max", () => {
    expect(parseListingsSearchParams({ bedrooms: "999" }).bedrooms).toBe(50);
    expect(
      parseListingsSearchParams({ squareFootageMin: "99999999" })
        .squareFootageMin
    ).toBe(10_000_000);
    expect(parseListingsSearchParams({ page: "99999" }).page).toBe(10_000);
  });
});

describe("buildListingsWhere", () => {
  it("returns undefined for empty params", () => {
    expect(buildListingsWhere({})).toBeUndefined();
  });

  it("builds single condition for tagIds", () => {
    const w = buildListingsWhere({ tagIds: [5] });
    expect(w).toEqual({ tags: { contains: 5 } });
  });

  it("builds and clause for multiple tagIds", () => {
    const w = buildListingsWhere({ tagIds: [5, 10] });
    expect(w).toEqual({
      and: [{ tags: { contains: 5 } }, { tags: { contains: 10 } }],
    });
  });

  it("builds bedrooms gte", () => {
    const w = buildListingsWhere({ bedrooms: 3 });
    expect(w).toEqual({
      interior: { bedrooms: { greater_than_equal: 3 } },
    });
  });

  it("builds bathroomsFull gte", () => {
    const w = buildListingsWhere({ bathroomsFull: 2 });
    expect(w).toEqual({
      interior: { bathroomsFull: { greater_than_equal: 2 } },
    });
  });

  it("builds squareFootage range", () => {
    const w = buildListingsWhere({
      squareFootageMin: 1000,
      squareFootageMax: 3000,
    });
    expect(w).toEqual({
      interior: {
        squareFootage: {
          greater_than_equal: 1000,
          less_than_equal: 3000,
        },
      },
    });
  });

  it("builds garageSpaces gte", () => {
    const w = buildListingsWhere({ garageSpaces: 2 });
    expect(w).toEqual({ garageSpaces: { greater_than_equal: 2 } });
  });

  it("builds propertyType and status into one property group", () => {
    const w = buildListingsWhere({
      propertyType: "condo",
      status: "active",
    });
    expect(w).toEqual({
      property: {
        propertyType: { equals: "condo" },
        status: { equals: "active" },
      },
    });
  });

  it("builds state equals, city and address contains", () => {
    const w = buildListingsWhere({
      state: "MI",
      city: "Grand Rapids",
      address: "Wealthy",
    });
    expect(w).toEqual({
      and: [
        { state: { equals: "MI" } },
        { city: { contains: "Grand Rapids" } },
        { address: { contains: "Wealthy" } },
      ],
    });
  });

  it("combines interior fields into one group", () => {
    const w = buildListingsWhere({
      bedrooms: 2,
      bathroomsFull: 1,
      squareFootageMin: 800,
    });
    expect(w).toEqual({
      interior: {
        bedrooms: { greater_than_equal: 2 },
        bathroomsFull: { greater_than_equal: 1 },
        squareFootage: { greater_than_equal: 800 },
      },
    });
  });

  it("combined filters produce and array", () => {
    const params: ListingsSearchParams = {
      tagIds: [1],
      bedrooms: 2,
      state: "MI",
    };
    const w = buildListingsWhere(params);
    expect(w).toHaveProperty("and");
    expect((w as { and: unknown[] }).and).toHaveLength(3);
  });
});
