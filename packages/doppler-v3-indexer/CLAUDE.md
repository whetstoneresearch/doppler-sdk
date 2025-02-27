# Doppler V3 Indexer - Development Guidelines

## Commands
- `npm run dev` - Start development server
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript type checking
- `npm run codegen` - Generate Ponder types from schema
- `npm run db` - Access database operations

## Code Style
- **Imports**: Use absolute imports with `@app` alias (e.g., `import { X } from "@app/utils"`)
- **Types**: Use strict typing with TypeScript. Enable `noUncheckedIndexedAccess`
- **Formatting**: Use consistent indentation (2 spaces) and trailing commas
- **Naming**: 
  - camelCase for variables and functions
  - PascalCase for types, interfaces, and components
  - Use descriptive names for database entity relationships
- **Error Handling**: Handle errors with appropriate try/catch blocks
- **Database Operations**: Always check existence before insert operations

## Architecture
- Follow Ponder's conventions for schema definition and event handling
- Maintain separation between indexers (v2, v3, v4) while sharing common utilities
- Use entity management functions from shared entities folder