# Restaurants Review (Toptal Takehome Project)

### What the app should be able to do:

- Allow users to register with email/password as either a reviewer or owner
  - Roles are immutable
- Reviewers can:
  - Leave one review on each restaurant
  - Update/delete their review
- Owners can:
  - Own multiple restaurants
  - CRUD only their own restaurants
- Everyone, including unauthenticated visitors, can:
  - List, filter, & sort restaurants
  - Return to their persisted filtering/sorting preferences
  - View restaurant details & reviews

All mutations require authentication & the appropriate role.

### Future Evolution (Not in Scope)

- Recommendations based on past reviews/preferences
- Location-aware discovery
- Review threads allowing owners to respond to reviews
- Additional clients or extracted services as scale requires

---

### My Design Philosophy

My Design Choices influence how I build software. Having this context in mind, I hope, will explain WHY I've made the decisions I did.

**What matters to me:**

- Conventions MATTER: It's not that everyone agrees on how the app should be structured, but having one standard eases onboarding, reinforces patterns for AI, & reduces cognitive load
- Strict Typesafety & Linting: strong typesafety & linting _move_ errors from runtime → compile time
- Deep Modules & Domain Boundaries: small, well-tested interfaces should hide meaningful complexity within business domains
- Scalable Simplicity: deploy a modular monolith now, while keeping domain logic & infrastructure replaceable when scale requires it
- Server Driven Applications: UI state should be driven by the server where practical

Transport handlers stay shallow. Deep application operations own authorization, business rules, & transactional workflows without requiring layers of speculative abstractions.

### Infrastructure

| Infrastructure | Choice for Demo            | Choice for Production/Scale                  |
| -------------- | -------------------------- | -------------------------------------------- |
| Interface      | Browser                    | Browser + (Maybe) Mobile App                 |
| Server         | Easy Deployment w/ Vercel  | AWS (Lambda/ECS/EC2)                         |
| Database       | Easy Deployment w/ Neon    | AWS RDS                                      |
| File Storage   | Easy Config w/ UploadThing | AWS S3 + Cloudfront (faster image retrieval) |

The production column provides future context; only the demo stack is in scope.

### Techstack

| Technology        | Choice                    | Reason                                                               |
| ----------------- | ------------------------- | -------------------------------------------------------------------- |
| Language          | Typescript                | A typesafe, reliable language on both server & client                |
| Framework         | Next.js                   | A proven framework for fullstack JS/TS applications                  |
| Styling/UI        | ShadCN UI                 | Full control while still offering beautiful defaults                 |
| ORM & Data hookup | Drizzle                   | Fast, typesafe, & easy to scale                                      |
| Auth              | Auth.js Credentials + JWT | Secure email/password sessions with role-aware identities            |
| File Storage      | UploadThing               | Direct uploads behind a small, replaceable storage interface         |
| Testing           | Jest + RTL, Drizzle Seed  | Test deep-module contracts, integration boundaries, & key user flows |

NOTE: I would choose [Effect.js](https://www.effect.website/) in production because it strengthens native TS by encoding errors & asynchronous tasks directly into the type system. I'm not using it here because it is TOO complex for a simplified restaurant review platform.

### Data-Model

This contains only the basic, high-level data-shape, NOT the full model.

```ts
type User = {
  id: number;
  email: string; // unique
  name: string;
  role: "reviewer" | "owner"; // immutable
};

type Address = {/* not necessary for design overview  */};

type Restaurant = {
  id: number;
  title: string;
  description: string;
  cuisine: string;
  preview_image_url: string;
  owner_id: User["id"];
  address_id: Address["id"]; // unique 1-1 relation
};

type Review = {
  id: number;
  restaurant_id: Restaurant["id"];
  reviewer_id: User["id"];
  rating: 1 | 2 | 3 | 4 | 5;
  content: string;
};
```

Restaurant & Address writes are atomic. Average rating is calculated from reviews initially; it can be cached behind the `Restaurants` module later without changing callers.

### Domain Boundaries

- `Users`: registration, authentication, & immutable role policy
- `Restaurants`: discovery, owner authorization, restaurant/address transactions, & image references
- `Reviews`: reviewer authorization, one-review-per-restaurant, & rating/content rules

### App Structure:

This contains only the basic, high-level product routes, NOT every endpoint.

1. The "main" page:
   - Route: `/restaurants`
   - Everyone can list, filter, & sort restaurants

2. The "Restaurant" page:
   - Route: `/restaurants/[restaurantId]`
   - Everyone can view restaurant details & reviews
   - Reviewers can leave/update/delete their review

3. The "Owner" page:
   - Route: `/owner/restaurants`
   - Owners can list & manage their restaurants
   - Owner scope always comes from the authenticated user, never a route parameter

4. The "Review" workflow:
   - Opens a modal to leave/update a review
   - Unauthenticated visitors must sign in
   - Only reviewers can mutate reviews

5. The "Create/Update Restaurant" workflow:
   - Opens a modal containing the restaurant, address, & preview-image form
   - The application operation owns authorization & the atomic Restaurant/Address transaction

6. The "Delete Restaurant" workflow:
   - Opens a confirmation modal
   - Only the restaurant's owner can delete it
