This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## MongoDB (Projects API)

Set your Mongo connection string in the environment:

- **MONGODB_URL** (preferred), or **mongodb_url** (fallback)

This app exposes:

- **GET `/api/projects`**: lists projects (newest first) with ruleset information
- **POST `/api/projects`**: creates a project

Example create:

```bash
curl -X POST http://localhost:3000/api/projects \
  -H 'content-type: application/json' \
  -d '{"name":"My Project","customerId":"uuid"}'
```

## Ruleset Versioning System

This application includes a comprehensive ruleset versioning system that automatically tracks and stores multiple versions of rulesets for each project.

### Key Features

- **Automatic Versioning**: Each time rules are generated for a project, a new version is automatically created
- **Version History**: All previous versions are preserved for audit and comparison
- **Version Metadata**: Each version includes timestamps, version numbers, and custom version names
- **Data Storage**: Both raw rules and mapped rules are stored in each version

### API Endpoints

- **GET `/api/projects/rulesets?customerId={id}`**: Get all ruleset versions for a project
- **POST `/api/projects/rulesets`**: Manually save a new ruleset version
- **GET `/api/projects/rulesets/{version}?customerId={id}`**: Get a specific ruleset version

### Example Usage

```bash
# Get all rulesets for a project
curl http://localhost:3000/api/projects/rulesets?customerId=uuid

# Save a new ruleset
curl -X POST http://localhost:3000/api/projects/rulesets \
  -H 'content-type: application/json' \
  -d '{
    "customerId": "uuid",
    "versionName": "v1.0.0",
    "data": {
      "mapped_rules": [...],
      "raw_rules": [...]
    }
  }'

# Get specific version
curl http://localhost:3000/api/projects/rulesets/1?customerId=uuid
```

### React Component

Use the `RulesetVersionList` component to display and manage versions in your UI:

```tsx
import { RulesetVersionList } from "@/components/rulesets/RulesetVersionList";

<RulesetVersionList 
  customerId="project-customer-id" 
  onSelectVersion={(version) => console.log(version)}
/>
```

### Demo Page

Visit `/rulesets-demo` to see a live demonstration of the versioning system.

For detailed documentation, see [RULESETS_VERSIONING.md](./RULESETS_VERSIONING.md)
