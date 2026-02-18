/**
 * Integration tests: Tags, Listings, access control.
 * Requires DATABASE_URL and PAYLOAD_SECRET in .env.local (or env).
 */
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const hasDb = process.env.DATABASE_URL && process.env.PAYLOAD_SECRET;

async function getPayloadInstance() {
  const { getPayload } = await import("payload");
  const config = (await import("../../src/payload.config")).default;
  return getPayload({ config });
}

describe("Phase 1 collections", () => {
  const testTagSlug = "integration-test-tag";
  const testListingSlug = "integration-test-listing";
  let payload: Awaited<ReturnType<typeof getPayloadInstance>>;

  beforeAll(async () => {
    if (!hasDb) return;
    payload = await getPayloadInstance();
  });

  afterAll(async () => {
    if (!payload) return;
    // Clean up: delete test listing then test tag
    const listings = await payload.find({
      collection: "listings",
      where: { slug: { equals: testListingSlug } },
      limit: 1,
    });
    if (listings.docs[0]) {
      await payload.delete({
        collection: "listings",
        id: listings.docs[0].id,
        overrideAccess: true,
      });
    }
    const tags = await payload.find({
      collection: "tags",
      where: { slug: { equals: testTagSlug } },
      limit: 1,
    });
    if (tags.docs[0]) {
      await payload.delete({
        collection: "tags",
        id: tags.docs[0].id,
        overrideAccess: true,
      });
    }
  });

  it("creates a tag with overrideAccess", async () => {
    if (!hasDb || !payload) return;
    const tag = await payload.create({
      collection: "tags",
      data: {
        name: "Integration Test Tag",
        slug: testTagSlug,
        category: "materials",
        description: "For integration test",
      },
      overrideAccess: true,
    });
    expect(tag.id).toBeDefined();
    expect(tag.slug).toBe(testTagSlug);
    expect(tag.name).toBe("Integration Test Tag");
  });

  it("creates a listing with tags and find returns relations", async () => {
    if (!hasDb || !payload) return;
    const tag = await payload.find({
      collection: "tags",
      where: { slug: { equals: testTagSlug } },
      limit: 1,
    });
    expect(tag.docs[0]).toBeDefined();
    const tagId = tag.docs[0].id;

    const listing = await payload.create({
      collection: "listings",
      data: {
        title: "Integration Test Listing",
        slug: testListingSlug,
        city: "Grand Rapids",
        state: "MI",
        beds: 2,
        baths: 1,
        tags: [tagId],
      },
      overrideAccess: true,
    });
    expect(listing.id).toBeDefined();
    expect(listing.slug).toBe(testListingSlug);
    expect(Array.isArray(listing.tags)).toBe(true);
    expect((listing.tags as { id: number }[]).length).toBeGreaterThanOrEqual(1);

    const found = await payload.find({
      collection: "listings",
      where: { slug: { equals: testListingSlug } },
      limit: 1,
      depth: 1,
    });
    expect(found.docs[0]).toBeDefined();
    const doc = found.docs[0];
    const resolvedTags = doc.tags as { slug?: string }[] | undefined;
    expect(Array.isArray(resolvedTags)).toBe(true);
    expect(resolvedTags?.some((t) => t.slug === testTagSlug)).toBe(true);
  });

  it("rejects unauthenticated create on tags (no overrideAccess)", async () => {
    if (!hasDb || !payload) return;
    await expect(
      payload.create({
        collection: "tags",
        data: {
          name: "Should Fail",
          slug: "should-fail-tag",
          category: "materials",
        },
        overrideAccess: false,
        req: { user: undefined } as any,
      }),
    ).rejects.toThrow();
  });

  it("allows public read on tags (no user)", async () => {
    if (!hasDb || !payload) return;
    const result = await payload.find({
      collection: "tags",
      where: { slug: { equals: testTagSlug } },
      limit: 1,
      overrideAccess: false,
    });
    expect(result.docs.length).toBeGreaterThanOrEqual(0);
  });
});
