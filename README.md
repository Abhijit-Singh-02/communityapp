# Community App

Full-stack social community platform inspired by LinkedIn/Instagram style interactions:
- user authentication (signup/login)
- profile management
- post creation with media upload to AWS S3
- home feed and posts feed UI

## Tech Stack

- **Frontend:** React 19, React Router, Axios, Vite
- **Backend:** Express, MongoDB + Mongoose, JWT auth, Multer, AWS SDK (S3)

## Monorepo Structure

```text
communityapp/
  frontend/   # React + Vite client
  backend/    # Express API + MongoDB models/controllers
```

## Features

### Authentication & User
- Signup and login
- JWT-based protected routes
- Profile fetch and profile update
- Profile picture upload to AWS S3

### Posts
- Create text or media posts
- Media (image/video) upload to AWS S3
- Feed endpoint with pagination
- Rich post model for social use-cases (visibility, hashtags, mentions, counters)

### Frontend UX
- Modern auth pages and nav
- Posts composer with text formatting shortcuts (`bold`, `italic`, `heading`, `quote`, `list`, `inline code`)
- Home feed cards with author name and follow button UI

## Backend Setup

### 1) Install dependencies

```bash
cd backend
npm install
```

### 2) Create `.env`

Backend reads these keys from `backend/config.mjs`:

```env
PORT=8080
MONGO_URI=<your-mongodb-uri>
JWT_SECRET=<your-jwt-secret>
accessKey=<aws-access-key-id>
secretAccessKey=<aws-secret-access-key>
region=<aws-region>   # e.g. ap-south-1 or us-east-1
```

### 3) Run backend

```bash
npm run test
```

> Current script runs `node index.mjs`. If you use nodemon locally, run it manually or add a `dev` script.

## Frontend Setup

### 1) Install dependencies

```bash
cd frontend
npm install
```

### 2) Create `.env`

```env
VITE_BACKEND_URL=http://localhost:8080
```

### 3) Run frontend

```bash
npm run dev
```

## API Endpoints (Current)

Base URL: `http://localhost:8080`

### Auth & Profile

- `POST /signup`
  - body: `{ username, email, password, phoneNumber }`
- `POST /login`
  - body: `{ email, password }`
  - returns JWT in response header `authorization: Bearer <token>`
- `GET /profile` (protected)
- `PUT /profile` (protected, multipart)
  - file field: `profilePicture`

### Posts

- `POST /posts` (protected, multipart)
  - supports:
    - `content` (text)
    - `mediaType` (`text`, `image`, `video`, `carousel`)
    - file field `mediaFile` (image/video uploaded to S3)
- `GET /posts` (protected)
  - query params: `page`, `limit`

## Data Models

### User (`backend/src/models/userModel.mjs`)

Core fields:
- `username`, `email`, `password`, `phoneNumber`
- `profilePicture`, `bio`
- `address` object (`street`, `city`, `state`, `zip`, `country`)
- `education[]`, `dob`, `gender`, `maritalStatus`, `occupation`
- status flags (`isDeleted`, `isActive`, `isVerified`, etc.)

### Post (`backend/src/models/postModel.mjs`)

Core fields:
- `userId` (ref to `User`)
- `content` (max 3000 chars)
- `media` (URL), `mediaType`
- `visibility`, `location`
- `hashtags[]`, `mentions[]`
- engagement counters: `likes`, `commentsCount`, `sharesCount`
- `isEdited`, `status`
- `createdAt`, `updatedAt`

## Validation Layer

Reusable validators live in:
- `backend/src/utils/validate.mjs`

Current helpers include:
- object id validation
- pagination normalization
- post payload validation/sanitization
- string and required-field helpers

## AWS Upload Notes

- Upload helper: `backend/src/aws/uploadProfile.mjs`
- Uses S3 bucket currently hardcoded in helper
- Requires valid AWS credentials in backend `.env`

## Known Improvements / TODO

- Persist follow/unfollow in backend (currently follow button is UI-only on Home feed)
- Add like/comment/share APIs and persist from frontend
- Add post delete/update endpoints and ownership checks
- Add centralized error middleware
- Add tests and API docs (OpenAPI/Swagger)

## Security Notes

- Never commit `.env` files or secrets
- Rotate any credential if it was ever pushed to git history
- Keep `node_modules` out of git

## License

ISC
