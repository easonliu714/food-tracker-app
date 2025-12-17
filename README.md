# Backend Development Guide

This guide covers server-side features including authentication, database, tRPC API, and integrations. **Only read this if your app needs these capabilities.**

---

## When Do You Need Backend?

| Scenario | Backend Needed? | Solution |
|----------|-----------------|----------|
| Data stays on device only | No | Use `AsyncStorage` |
| Data syncs across devices | Yes | Database + tRPC |
| User accounts / login | Yes | Manus OAuth |
| AI-powered features | Yes | LLM Integration |
| User uploads files | Yes | S3 Storage |
| Server-side validation | Yes | tRPC procedures |

---

## Authentication

### Overview

The template uses **Manus OAuth** for user authentication. It works differently on native and web:

| Platform | Auth Method | Token Storage |
|----------|-------------|---------------|
| iOS/Android | Bearer token | expo-secure-store |
| Web | HTTP-only cookie | Browser cookie |

### Using the Auth Hook

```tsx
import { useAuth } from "@/hooks/use-auth";

function MyScreen() {
  const { user, isAuthenticated, loading, logout } = useAuth();

  if (loading) return <ActivityIndicator />;
  
  if (!isAuthenticated) {
    return <LoginButton />;
  }

  return (
    <View>
      <ThemedText>Welcome, {user.name}</ThemedText>
      <Button title="Logout" onPress={logout} />
    </View>
  );
}
```

### User Object

The `user` object contains:

```tsx
interface User {
  id: number;
  openId: string;        // Manus OAuth ID
  name: string | null;
  email: string | null;
  loginMethod: string;
  role: "user" | "admin";
  lastSignedIn: Date;
}
```

### Login Flow (Native)

1. User taps Login button
2. `WebBrowser.openAuthSessionAsync()` opens Manus OAuth
3. User authenticates
4. Deep link redirects to `app/oauth/callback.tsx`
5. Callback exchanges code for session token
6. Token stored in SecureStore
7. User redirected to home

### Login Flow (Web)

1. User clicks Login button
2. Browser redirects to Manus OAuth
3. User authenticates
4. Redirect back with session cookie
5. Cookie automatically sent with requests

### Protected Routes

Use `protectedProcedure` in tRPC to require authentication:

```tsx
// server/routers.ts
import { protectedProcedure } from "./_core/trpc";

export const appRouter = router({
  myFeature: router({
    getData: protectedProcedure.query(({ ctx }) => {
      // ctx.user is guaranteed to exist
      return db.getUserData(ctx.user.id);
    }),
  }),
});

```
### Frontend: Handling Auth Errors
protectedProcedure MUST HANDLE UNAUTHORIZED when user is not logged in. Always handle this in the frontend:
```tsx
try {
  await trpc.someProtectedEndpoint.mutate(data);
} catch (error) {
  if (error.data?.code === 'UNAUTHORIZED') {
    router.push('/login');
    return;
  }
  throw error;
}
```

---

## Database

### Schema Definition

Define your tables in `drizzle/schema.ts`:

```tsx
import { int, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

// Users table (already exists)
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// Add your tables
export const items = mysqlTable("items", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  completed: boolean("completed").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// Export types
export type User = typeof users.$inferSelect;
export type Item = typeof items.$inferSelect;
export type InsertItem = typeof items.$inferInsert;
```

### Running Migrations

After editing the schema, push changes to the database:

```bash
pnpm db:push
```

This runs `drizzle-kit generate` and `drizzle-kit migrate`.

### Query Helpers

Add database queries in `server/db.ts`:

```tsx
import { eq } from "drizzle-orm";
import { getDb } from "./_core/db";
import { items, InsertItem } from "../drizzle/schema";

export async function getUserItems(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(items).where(eq(items.userId, userId));
}

export async function createItem(data: InsertItem) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(items).values(data);
  return result.insertId;
}

export async function updateItem(id: number, data: Partial<InsertItem>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(items).set(data).where(eq(items.id, id));
}

export async function deleteItem(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(items).where(eq(items.id, id));
}
```

---

## tRPC API

### Adding Routes

Define API routes in `server/routers.ts`:

```tsx
import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "./_core/trpc";
import * as db from "./db";

export const appRouter = router({
  // Public route (no auth required)
  health: publicProcedure.query(() => ({ status: "ok" })),

  // Protected routes (auth required)
  items: router({
    list: protectedProcedure.query(({ ctx }) => {
      return db.getUserItems(ctx.user.id);
    }),

    create: protectedProcedure
      .input(z.object({
        title: z.string().min(1).max(255),
        description: z.string().optional(),
      }))
      .mutation(({ ctx, input }) => {
        return db.createItem({
          userId: ctx.user.id,
          title: input.title,
          description: input.description,
        });
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().min(1).max(255).optional(),
        completed: z.boolean().optional(),
      }))
      .mutation(({ input }) => {
        return db.updateItem(input.id, input);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => {
        return db.deleteItem(input.id);
      }),
  }),
});

export type AppRouter = typeof appRouter;
```

### Calling from Frontend

Use tRPC hooks in your components:

```tsx
import { trpc } from "@/lib/trpc";

function ItemList() {
  // Query
  const { data: items, isLoading, refetch } = trpc.items.list.useQuery();

  // Mutation
  const createMutation = trpc.items.create.useMutation({
    onSuccess: () => refetch(),
  });

  const handleCreate = async () => {
    await createMutation.mutateAsync({
      title: "New Item",
      description: "Description here",
    });
  };

  if (isLoading) return <ActivityIndicator />;

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id.toString()}
      renderItem={({ item }) => <ItemCard item={item} />}
    />
  );
}
```

### Input Validation

Use Zod schemas for type-safe validation:

```tsx
import { z } from "zod";

const createItemSchema = z.object({
  title: z.string().min(1, "Title required").max(255),
  description: z.string().max(1000).optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  dueDate: z.date().optional(),
});

// In router
create: protectedProcedure
  .input(createItemSchema)
  .mutation(({ ctx, input }) => {
    // input is fully typed
  }),
```

---

## LLM Integration

Use the preconfigured LLM helpers. Credentials are injected from the platform (no manual setup required).

```ts
import { invokeLLM } from "./server/_core/llm";

/**
 * Simple chat completion
 * type Role = "system" | "user" | "assistant" | "tool" | "function";
 * type TextContent = {
 *   type: "text";
 *   text: string;
 * };
 *
 * type ImageContent = {
 *   type: "image_url";
 *   image_url: {
 *     url: string;
 *     detail?: "auto" | "low" | "high";
 *   };
 * };
 *
 * type FileContent = {
 *   type: "file_url";
 *   file_url: {
 *     url: string;
 *     mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4" ;
 *   };
 * };
 *
 * export type Message = {
 *   role: Role;
 *   content: string | Array<ImageContent | TextContent | FileContent>
 * };
 *
 * Supported parameters:
 * messages: Array<{
 *   role: 'system' | 'user' | 'assistant' | 'tool',
 *   content: string | { tool_call: { name: string, arguments: string } }
 * }>
 * tool_choice?: 'none' | 'auto' | 'required' | { type: 'function', function: { name: string } }
 * tools?: Tool[]
 */
const response = await invokeLLM({
  messages: [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "Hello, world!" },
  ],
});
```

Tips
- Always call llm functions from server-side code (e.g., inside tRPC procedures), to avoid exposing your API key.
- You don't need to manually set the model; the helper uses a sensible default.
- LLM responses often contain markdown. Use `<Streamdown>{content}</Streamdown>` (imported from `streamdown`) to render markdown content with proper formatting and streaming support.

### Structured Responses (JSON Schema)

Ask the model to return structured JSON via `response_format`:

```ts
import { invokeLLM } from "./server/_core/llm";

const structured = await invokeLLM({
  messages: [
    { role: "system", content: "You are a helpful assistant designed to output JSON." },
    { role: "user", content: "Extract the name and age from the following text: \"My name is Alice and I am 30 years old.\"" },
  ],
  response_format: {
    type: "json_schema",
    json_schema: {
      name: "person_info",
      strict: true,
      schema: {
        type: "object",
        properties: {
          name: { type: "string", description: "The name of the person" },
          age: { type: "integer", description: "The age of the person" },
        },
        required: ["name", "age"],
        additionalProperties: false,
      },
    },
  },
});

// The model responds with JSON content matching the schema.
// Access via `structured.choices[0].message.content` and JSON.parse if needed.
```
The helpers mirror the Python SDK semantics but produce JavaScript-first code, keeping credentials inside the server and ensuring every environment has access to the same token.

**CRITICAL Note:** `json_schema` works for flat structures. For nested arrays/objects, use `json_object` instead.
```ts
const response = await invokeLLM({
  messages: [
    {
      role: "system",
      content: `Analyze the food image. Return JSON:
{
  "foods": [{ "name": "string", "calories": number }],
  "totalCalories": number
}`
    },
    {
      role: "user",
      content: [
        { type: "text", text: "What food is this?" },
        { type: "image_url", image_url: { url: imageUrl } }
      ]
    }
  ],
  response_format: { type: "json_object" }
});
const data = JSON.parse(response.choices[0].message.content);
```

---

## Voice Transcription Integration

Use the preconfigured voice transcription helper that converts speech to text using Whisper API, no manual setup required.

Example usage:
```ts
import { transcribeAudio } from "./server/_core/voiceTranscription";

const result = await transcribeAudio({
  audioUrl: "https://storage.example.com/audio/recording.mp3",
  language: "en", // Optional: helps improve accuracy
  prompt: "Transcribe meeting notes" // Optional: context hint
});

// Returns native Whisper API response
// result.text - Full transcription
// result.language - Detected language (ISO-639-1)
// result.segments - Timestamped segments with metadata
```

Tips
- Accepts URL to pre-uploaded audio file
- 16MB file size limit enforced during transcription, size flag to be set by frontend
- Supported formats: webm, mp3, wav, ogg, m4a
- Returns native Whisper API response with rich metadata
- Frontend should handle audio capture, storage upload, and size validation

---

## Image Generation Integration

Use the preconfigured image generation helper that connects to the internal ImageService, no manual setup required.

Example usage:
```ts
import { generateImage } from "./server/_core/imageGeneration.ts";

const { url: imageUrl } = await generateImage({
  prompt: "A serene landscape with mountains"
});
// For editing:
const { url: imageUrl } = await generateImage({
  prompt: "Add a rainbow to this landscape",
  originalImages: [{
    url: "https://example.com/original.jpg",
    mimeType: "image/jpeg"
  }]
});
```

Tips
- Always call from server-side code (e.g., inside tRPC procedures) to avoid exposing API keys
- Image generation can take 5-20 seconds, implement proper loading states
- Implement proper error handling as image generation can fail

---

## ☁️ File Storage
