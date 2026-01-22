# ServiceStart

ServiceStart is a total rebuild of [Voluntrack](https://github.com/GTBitsOfGood/VolunTrack) - a volunteer and event management platform for nonprofits.

[![Netlify Status](https://api.netlify.com/api/v1/badges/4c02de3a-8a0a-45e0-8282-349cc70f0705/deploy-status)](https://app.netlify.com/projects/servicestart/deploys)

## Stack

- React: Frontend framework
- Next.js: Backend framework and server-side rendering
- Tailwind CSS: Styling
- Netlify: Hosting and deployment
- Vitest: Testing
- PNPM: Package management
- ESLint: Linting
- Prettier: Code formatting

## Getting Started

1. Install PNPM if you haven't already:

   ```bash
   npm install -g pnpm
   ```

1. Clone the repository:

   ```bash
   git clone https://github.com/GTBitsOfGood/servicestart.git
   cd servicestart
   ```

1. Start the server:

   ```bash
   pnpm install
   pnpm dev
   ```

## Other Tools

- Dependabot is enabled and will submit PRs to update dependencies.
- PRs automatically create preview deployments on Netlify for easy UX testing.
