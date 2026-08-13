# Graph Report - Study-OS  (2026-08-06)

## Corpus Check
- 151 files · ~192,734 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1221 nodes · 2290 edges · 131 communities (54 shown, 77 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 12 edges (avg confidence: 0.67)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- DashboardLayout.tsx
- routers.ts
- cn
- llm.ts
- sidebar.tsx
- schema.ts
- db.ts
- compilerOptions
- dialog.tsx
- alert-dialog.tsx
- utils.ts
- env.ts
- item.tsx
- menubar.tsx
- components.json
- map.ts
- debug-collector.js
- context-menu.tsx
- dropdown-menu.tsx
- manusTypes.ts
- devDependencies
- dependencies
- index.ts
- SDKServer
- carousel.tsx
- react
- field.tsx
- heartbeat.ts
- sdk.ts
- textarea.tsx
- drawer.tsx
- form.tsx
- oauth.ts
- input-group.tsx
- package.json
- voiceTranscription.ts
- empty.tsx
- scripts
- sm2.ts
- ErrorBoundary.tsx
- cn
- imageGeneration.ts
- extractInsertId
- storage.ts
- ComponentShowcase.tsx
- alert.tsx
- schema.ts
- compilerOptions
- utils.ts
- dialog.tsx
- alert-dialog.tsx
- Remaining Tasks (26 items in todo.md)
- @aws-sdk/client-s3
- cmdk
- cross-env
- date-fns
- drizzle-orm
- embla-carousel-react
- framer-motion
- @hookform/resolvers
- input-otp
- lucide-react
- mammoth
- mysql2
- nanoid
- next-themes
- @radix-ui/react-alert-dialog
- @radix-ui/react-aspect-ratio
- @radix-ui/react-avatar
- @radix-ui/react-checkbox
- @radix-ui/react-collapsible
- @radix-ui/react-context-menu
- @radix-ui/react-hover-card
- @radix-ui/react-label
- @radix-ui/react-menubar
- @radix-ui/react-navigation-menu
- @radix-ui/react-popover
- @radix-ui/react-progress
- @radix-ui/react-radio-group
- @radix-ui/react-select
- @radix-ui/react-separator
- @radix-ui/react-slider
- @radix-ui/react-slot
- @radix-ui/react-tabs
- @radix-ui/react-toggle-group
- @radix-ui/react-tooltip
- react-dom
- react-hook-form
- react-resizable-panels
- recharts
- sonner
- streamdown
- tailwind-merge
- tailwindcss-animate
- @trpc/react-query
- @trpc/client
- wouter
- postcss
- tailwindcss
- @tailwindcss/vite
- tsx
- tw-animate-css
- @types/express
- @types/google.maps
- @types/react-dom
- vite
- vite-plugin-manus-runtime
- vitest
- cookie.d.ts
- field.tsx
- form.tsx
- input.tsx
- SubjectDetailPage.tsx
- oauth.ts
- input-group.tsx
- PageTransitions.tsx
- notification.ts
- class-variance-authority
- cookie
- dotenv
- @radix-ui/react-dropdown-menu
- react-day-picker
- vaul
- @radix-ui/react-switch
- superjson
- @trpc/server

## God Nodes (most connected - your core abstractions)
1. `cn()` - 274 edges
2. `getDb()` - 48 edges
3. `useAuth()` - 29 edges
4. `Button()` - 24 edges
5. `react` - 20 edges
6. `ENV` - 17 edges
7. `Card()` - 15 edges
8. `CardContent()` - 15 edges
9. `Input()` - 15 edges
10. `compilerOptions` - 15 edges

## Surprising Connections (you probably didn't know these)
- `CalendarDayButton()` --references--> `react`  [EXTRACTED]
  client/src/components/ui/calendar.tsx → package.json
- `Dialog()` --references--> `react`  [EXTRACTED]
  client/src/components/ui/dialog.tsx → package.json
- `InputOTPSlot()` --references--> `react`  [EXTRACTED]
  client/src/components/ui/input-otp.tsx → package.json
- `useSidebar()` --references--> `react`  [EXTRACTED]
  client/src/components/ui/sidebar.tsx → package.json
- `SidebarProvider()` --references--> `react`  [EXTRACTED]
  client/src/components/ui/sidebar.tsx → package.json

## Import Cycles
- None detected.

## Communities (131 total, 77 thin omitted)

### Community 0 - "DashboardLayout.tsx"
Cohesion: 0.06
Nodes (68): DashboardLayout(), DashboardLayoutContentProps, menuItems, ManusDialogProps, Button(), Card(), CardContent(), CardDescription() (+60 more)

### Community 1 - "routers.ts"
Cohesion: 0.17
Nodes (18): invokeLLM(), systemRouter, adminProcedure, protectedProcedure, requireUser, t, SUPPORTED_FILE_TYPES, flashcardsRouter (+10 more)

### Community 2 - "cn"
Cohesion: 0.06
Nodes (43): Avatar(), AvatarFallback(), AvatarImage(), BreadcrumbEllipsis(), BreadcrumbItem(), BreadcrumbLink(), BreadcrumbList(), BreadcrumbPage() (+35 more)

### Community 3 - "llm.ts"
Cohesion: 0.09
Nodes (36): computeBackoffDelay(), FetchInit, fetchWithBackoff(), parseRetryAfter(), sleep(), __testing, buildChatCompletionsPayload(), ensureArray() (+28 more)

### Community 4 - "sidebar.tsx"
Cohesion: 0.05
Nodes (42): DashboardLayoutContent(), DashboardLayoutSkeleton(), Sheet(), SheetContent(), SheetDescription(), SheetFooter(), SheetHeader(), SheetOverlay() (+34 more)

### Community 5 - "schema.ts"
Cohesion: 0.05
Nodes (35): ChatMessage, chatMessages, ChatSession, chatSessions, Document, documents, Flashcard, FlashcardReview (+27 more)

### Community 6 - "db.ts"
Cohesion: 0.11
Nodes (36): createNote(), createStudySession(), createSubject(), deleteChatSession(), deleteSubject(), getChatMessages(), getChatSession(), getDb() (+28 more)

### Community 7 - "compilerOptions"
Cohesion: 0.07
Nodes (30): build, client/src/**/*, dist, dom, dom.iterable, esnext, node, node_modules (+22 more)

### Community 8 - "dialog.tsx"
Cohesion: 0.22
Nodes (9): NavigationMenu(), NavigationMenuContent(), NavigationMenuIndicator(), NavigationMenuItem(), NavigationMenuLink(), NavigationMenuList(), NavigationMenuTrigger(), navigationMenuTriggerStyle (+1 more)

### Community 9 - "alert-dialog.tsx"
Cohesion: 0.10
Nodes (18): AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay(), AlertDialogTitle() (+10 more)

### Community 10 - "utils.ts"
Cohesion: 0.06
Nodes (17): AccordionContent(), AccordionItem(), AccordionTrigger(), Badge(), badgeVariants, Checkbox(), HoverCardContent(), InputOTP() (+9 more)

### Community 11 - "env.ts"
Cohesion: 0.18
Nodes (12): DataApiCallOptions, ENV, listLLMModels(), createForgeProvider(), createNvidiaNimProvider(), originalEnv, FACTORIES, getLLMProvider() (+4 more)

### Community 12 - "item.tsx"
Cohesion: 0.13
Nodes (17): ButtonGroup(), ButtonGroupSeparator(), ButtonGroupText(), buttonGroupVariants, Item(), ItemActions(), ItemContent(), ItemDescription() (+9 more)

### Community 13 - "menubar.tsx"
Cohesion: 0.67
Nodes (3): ProgressStats, getOrCreateProgressStats(), updateProgressStats()

### Community 14 - "components.json"
Cohesion: 0.12
Nodes (16): aliases, components, hooks, lib, ui, utils, rsc, $schema (+8 more)

### Community 15 - "map.ts"
Cohesion: 0.12
Nodes (16): DirectionsResult, DistanceMatrixResult, ElevationResult, GeocodingResult, getMapsConfig(), LatLng, makeRequest(), MapsConfig (+8 more)

### Community 16 - "debug-collector.js"
Cohesion: 0.25
Nodes (14): compactText(), describeElement(), elText(), formatArg(), formatArgs(), getInputValueSafe(), installUiEventListeners(), isSensitiveField() (+6 more)

### Community 17 - "context-menu.tsx"
Cohesion: 0.12
Nodes (9): ContextMenuCheckboxItem(), ContextMenuContent(), ContextMenuItem(), ContextMenuLabel(), ContextMenuRadioItem(), ContextMenuSeparator(), ContextMenuShortcut(), ContextMenuSubContent() (+1 more)

### Community 18 - "dropdown-menu.tsx"
Cohesion: 0.12
Nodes (11): DropdownMenu(), DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuRadioItem(), DropdownMenuSeparator(), DropdownMenuShortcut() (+3 more)

### Community 19 - "manusTypes.ts"
Cohesion: 0.08
Nodes (18): AuthenticatedUser, buildCronUser(), isNonEmptyString(), OAuthService, SDKServer, SessionPayload, AuthorizeRequest, AuthorizeResponse (+10 more)

### Community 20 - "devDependencies"
Cohesion: 0.13
Nodes (15): add, autoprefixer, @builder.io/vite-plugin-jsx-loc, devDependencies, add, autoprefixer, @builder.io/vite-plugin-jsx-loc, @tailwindcss/typography (+7 more)

### Community 22 - "index.ts"
Cohesion: 0.05
Nodes (40): AI Chatbot, AI Learning System, AI Lessons, AI Memory, AI Personality, AI Recommendations, Animations, Dashboard (+32 more)

### Community 23 - "SDKServer"
Cohesion: 0.06
Nodes (31): 1. Understanding beats memorization., 2. One upload creates everything., 3. AI adapts to the student., 4. Minimal interface., 5. Human-first communication., AI Communication Style, AI Memory, AI Personality (+23 more)

### Community 24 - "carousel.tsx"
Cohesion: 0.06
Nodes (41): Carousel(), CarouselApi, CarouselContent(), CarouselContext, CarouselContextProps, CarouselItem(), CarouselNext(), CarouselOptions (+33 more)

### Community 25 - "react"
Cohesion: 0.17
Nodes (19): jszip, jszip, pdf-parse, youtube-transcript, pdf-parse, cleanExtractedText(), decodeXmlEntities(), DocumentParseError (+11 more)

### Community 26 - "field.tsx"
Cohesion: 0.08
Nodes (25): 1. Notes Auto-save (Phase 1 Critical) — ✅ ALREADY DONE, 2. AI Streaming Responses (Phase 2 Critical) — ✅ DONE, 3. YouTube "What do you want?" Flow (Phase 3 Critical) — ✅ DONE, 4. Dashboard Redesign (Phase 4 Critical) — ✅ DONE, 5. Animations & Transitions (Phase 4) — ✅ DONE, 6. Manus Cleanup — ✅ DONE, 7. Home/Landing Page — ✅ ALREADY PROPER, 8. Brain Visualization Page — ✅ DONE (+17 more)

### Community 27 - "heartbeat.ts"
Cohesion: 0.28
Nodes (12): buildEndpoint(), callForge(), createHeartbeatJob(), deleteHeartbeatJob(), HeartbeatJob, HeartbeatJobInfo, HeartbeatJobUpdate, listHeartbeatJobs() (+4 more)

### Community 29 - "textarea.tsx"
Cohesion: 0.22
Nodes (6): quizAttempts, quizQuestions, getWeakTopics(), aiRouter, LOADING_MESSAGES, TEACHING_MODE_PROMPTS

### Community 30 - "drawer.tsx"
Cohesion: 0.18
Nodes (6): DrawerContent(), DrawerDescription(), DrawerFooter(), DrawerHeader(), DrawerOverlay(), DrawerTitle()

### Community 34 - "package.json"
Cohesion: 0.22
Nodes (8): license, name, tailwindcss>nanoid, packageManager, pnpm, overrides, type, version

### Community 35 - "voiceTranscription.ts"
Cohesion: 0.28
Nodes (8): getFileExtension(), getLanguageName(), transcribeAudio(), TranscribeOptions, TranscriptionError, TranscriptionResponse, WhisperResponse, WhisperSegment

### Community 36 - "empty.tsx"
Cohesion: 0.29
Nodes (7): Empty(), EmptyContent(), EmptyDescription(), EmptyHeader(), EmptyMedia(), emptyMediaVariants, EmptyTitle()

### Community 37 - "scripts"
Cohesion: 0.25
Nodes (8): scripts, build, check, db:push, dev, format, start, test

### Community 38 - "sm2.ts"
Cohesion: 0.29
Nodes (6): updateFlashcardAfterReview(), computeSM2(), SM2Input, SM2Result, FRESH_CARD, NOW

### Community 39 - "ErrorBoundary.tsx"
Cohesion: 0.29
Nodes (5): Theme, ThemeContext, ThemeContextType, ThemeProvider(), ThemeProviderProps

### Community 41 - "imageGeneration.ts"
Cohesion: 0.29
Nodes (4): GenerateImageOptions, GenerateImageResponse, ImageModelInfo, ListImageModelsResponse

### Community 42 - "extractInsertId"
Cohesion: 0.20
Nodes (10): createChatMessage(), createChatSession(), createDocument(), createFlashcard(), createLesson(), createQuizQuestion(), createUser(), extractInsertId() (+2 more)

### Community 43 - "storage.ts"
Cohesion: 0.57
Nodes (6): appendHashSuffix(), getForgeConfig(), normalizeKey(), storageGet(), storageGetSignedUrl(), storagePut()

### Community 45 - "alert.tsx"
Cohesion: 0.50
Nodes (4): Alert(), AlertDescription(), AlertTitle(), alertVariants

### Community 53 - "@aws-sdk/client-s3"
Cohesion: 0.12
Nodes (17): @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, clsx, jose, dependencies, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, clsx (+9 more)

### Community 61 - "drizzle-orm"
Cohesion: 0.27
Nodes (10): express, express, findAvailablePort(), isPortAvailable(), startServer(), invokeLLMStream(), registerStorageProxy(), serveStatic() (+2 more)

### Community 76 - "@radix-ui/react-avatar"
Cohesion: 0.29
Nodes (3): ErrorBoundary, Props, State

### Community 83 - "@radix-ui/react-menubar"
Cohesion: 0.28
Nodes (6): User, AuthenticatedUser, CookieCall, getSessionUser(), createContext(), TrpcContext

### Community 133 - "form.tsx"
Cohesion: 0.16
Nodes (12): Field(), FieldContent(), FieldDescription(), FieldError(), FieldGroup(), FieldLabel(), FieldLegend(), FieldSeparator() (+4 more)

### Community 136 - "input.tsx"
Cohesion: 0.16
Nodes (12): AIChatBox(), AIChatBoxProps, Message, ScrollArea(), ScrollBar(), Textarea(), TimerResponse, useComposition() (+4 more)

### Community 143 - "SubjectDetailPage.tsx"
Cohesion: 0.50
Nodes (4): DailyProgressLog, getOrCreateDailyLog(), getUserProgressHistory(), updateDailyLog()

### Community 144 - "oauth.ts"
Cohesion: 0.16
Nodes (12): hashApiKey(), isValidNimApiKey(), registerAuthRoutes(), sessions, getSessionCookieOptions(), isSecureRequest(), LOCAL_HOSTS, getQueryParam() (+4 more)

### Community 147 - "input-group.tsx"
Cohesion: 0.28
Nodes (8): InputGroup(), InputGroupAddon(), inputGroupAddonVariants, InputGroupButton(), inputGroupButtonVariants, InputGroupInput(), InputGroupText(), InputGroupTextarea()

### Community 152 - "notification.ts"
Cohesion: 0.48
Nodes (6): buildEndpointUrl(), isNonEmptyString(), NotificationPayload, notifyOwner(), trimValue(), validatePayload()

## Knowledge Gaps
- **358 isolated node(s):** `UseAuthOptions`, `AIChatBoxProps`, `menuItems`, `DashboardLayoutContentProps`, `Props` (+353 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **77 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `DashboardLayout.tsx`, `empty.tsx`, `form.tsx`, `sidebar.tsx`, `input.tsx`, `alert-dialog.tsx`, `utils.ts`, `dialog.tsx`, `@radix-ui/react-avatar`, `alert.tsx`, `item.tsx`, `context-menu.tsx`, `dropdown-menu.tsx`, `input-group.tsx`, `carousel.tsx`, `drawer.tsx`?**
  _High betweenness centrality (0.303) - this node is a cross-community bridge._
- **Why does `dependencies` connect `@aws-sdk/client-s3` to `field.tsx`, `dependencies`, `carousel.tsx`, `react`, `form.tsx`, `oauth.ts`, `package.json`, `cn`, `ComponentShowcase.tsx`, `schema.ts`, `compilerOptions`, `utils.ts`, `cmdk`, `date-fns`, `drizzle-orm`, `embla-carousel-react`, `framer-motion`, `@hookform/resolvers`, `input-otp`, `lucide-react`, `mammoth`, `mysql2`, `nanoid`, `next-themes`, `@radix-ui/react-alert-dialog`, `@radix-ui/react-aspect-ratio`, `@radix-ui/react-checkbox`, `@radix-ui/react-collapsible`, `@radix-ui/react-context-menu`, `@radix-ui/react-hover-card`, `@radix-ui/react-label`, `@radix-ui/react-navigation-menu`, `@radix-ui/react-popover`, `@radix-ui/react-progress`, `@radix-ui/react-radio-group`, `@radix-ui/react-select`, `@radix-ui/react-separator`, `@radix-ui/react-slider`, `@radix-ui/react-slot`, `@radix-ui/react-tabs`, `@radix-ui/react-tooltip`, `react-dom`, `react-hook-form`, `react-resizable-panels`, `recharts`, `sonner`, `streamdown`, `class-variance-authority`, `cookie`, `tailwindcss-animate`, `dotenv`, `tailwind-merge`, `@trpc/client`, `@radix-ui/react-dropdown-menu`, `react-day-picker`, `@trpc/react-query`, `vaul`, `wouter`, `@radix-ui/react-switch`, `superjson`, `@trpc/server`?**
  _High betweenness centrality (0.245) - this node is a cross-community bridge._
- **Why does `react` connect `carousel.tsx` to `DashboardLayout.tsx`, `sidebar.tsx`, `alert-dialog.tsx`, `utils.ts`, `@aws-sdk/client-s3`?**
  _High betweenness centrality (0.135) - this node is a cross-community bridge._
- **What connects `UseAuthOptions`, `AIChatBoxProps`, `menuItems` to the rest of the system?**
  _358 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `DashboardLayout.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.059049207673060884 - nodes in this community are weakly interconnected._
- **Should `cn` be split into smaller, more focused modules?**
  _Cohesion score 0.06015037593984962 - nodes in this community are weakly interconnected._
- **Should `llm.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09200603318250378 - nodes in this community are weakly interconnected._