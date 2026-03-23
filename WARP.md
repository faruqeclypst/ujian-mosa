# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

This is a modern React-based school inventory management dashboard application built with TypeScript, Vite, Tailwind CSS, and shadcn/ui components. The application manages school infrastructure inventory including items, rooms, land assets, and loans with real-time synchronization using Firebase Realtime Database and direct file uploads to Cloudflare R2.

## Development Commands

### Core Development
```powershell
# Install dependencies
npm install

# Start development server (runs on http://localhost:5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Code Quality
```powershell
# Run ESLint
npm run lint

# Format code with Prettier
npm run format
```

### Cloudflare Worker (for R2 file deletion)
```powershell
# Deploy the R2 deletion worker
cd cloudflare-worker
wrangler deploy
```

**✅ DEPLOYED**: Worker is live at `https://r2-delete-worker.faruq-blogger.workers.dev`

## Architecture Overview

### Core Technology Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS with shadcn/ui components
- **Database**: Firebase Realtime Database for real-time data synchronization
- **File Storage**: Cloudflare R2 (S3-compatible) for image uploads
- **Authentication**: Firebase Auth with username/password and Google Sign-in
- **Forms**: react-hook-form with Zod validation
- **Routing**: React Router with protected routes
- **Animation**: Framer Motion

### Data Architecture
The application manages four main entity types:
- **InventoryItem**: School equipment and supplies
- **Room**: Physical spaces with condition tracking
- **Land**: Land assets with certificates and documentation
- **Loan**: Equipment lending system with status tracking

All data is stored in Firebase Realtime Database under the `inventory/` path with real-time subscriptions via `InventoryContext`.

### File Upload Strategy
- Images are uploaded directly to Cloudflare R2 using S3-compatible credentials
- File deletion is handled via a Cloudflare Worker to avoid CORS issues
- URLs can use either R2 public URLs or custom CDN domains
- **Security Note**: R2 credentials are embedded in frontend (suitable for trusted environments only)

### Authentication Flow
- Protected routes redirect unauthenticated users to `/login`
- Username authentication converts usernames to internal email format (`username@inventory.local`)
- Google Sign-in available as alternative authentication method
- All authenticated users have full CRUD access to all data

## Key Components and Contexts

### Context Providers
- **AuthContext**: Manages Firebase authentication state
- **InventoryContext**: Provides real-time data and CRUD operations for all entity types

### Layout System
- **InventoryLayout**: Main application shell with sidebar navigation
- **LoadingScreen**: Consistent loading states across the application

### Form System
All forms use react-hook-form with Zod validation and support direct file uploads to R2 storage.

### Real-time Data Flow
The `InventoryContext` uses Firebase's `onValue` to maintain real-time subscriptions to the entire `inventory/` database node, automatically updating all components when data changes.

## Environment Configuration

Create `.env` file with:
```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_DATABASE_URL=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...

# Authentication
VITE_AUTH_USERNAME_DOMAIN=inventory.local

# Cloudflare R2 Configuration
VITE_R2_BUCKET=<bucket-name>
VITE_R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
VITE_R2_ACCESS_KEY_ID=<access-key-id>
VITE_R2_SECRET_ACCESS_KEY=<secret-access-key>

# Optional: Custom CDN domain
VITE_R2_PUBLIC_BASE_URL=cdn.domain.com/assets

# Cloudflare Worker URL for file deletion
VITE_R2_WORKER_URL=https://worker-name.subdomain.workers.dev
```

## Code Standards

- TypeScript strict mode enabled
- ESLint + Prettier for code formatting
- Components follow shadcn/ui patterns for consistency
- All forms use react-hook-form + Zod validation schema
- Real-time data operations through context providers only
- File uploads handled through dedicated R2 service layer

## Testing Strategy

Currently no test framework is configured. When adding tests, consider:
- Unit tests for utility functions and form validation
- Integration tests for Firebase database operations
- Component testing for form submissions and data display
- E2E tests for complete user workflows

## Deployment Considerations

### Frontend Deployment
- Build output in `dist/` directory
- Configured for Vercel with SPA routing support
- All routes redirect to `index.html` for client-side routing

### Infrastructure Requirements
1. Firebase project with Realtime Database and Authentication enabled
2. Cloudflare R2 bucket with public read access
3. Cloudflare Worker deployed for secure file deletion
4. Environment variables properly configured in deployment platform

## Security Notes

- R2 credentials are exposed in frontend bundle (development/internal use only)
- For production: implement server-side signed URL generation
- Firebase security rules should restrict access appropriately
- Consider implementing role-based access control for different user types