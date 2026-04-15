# .harness/patterns.md — Next.js 패턴 가이드

---

## Server Component에서 데이터 패칭

```typescript
// app/dashboard/page.tsx
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { redirect } from "next/navigation"

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const data = await db.post.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  })

  return <PostList posts={data} />
}
```

---

## Server Action 패턴

```typescript
// app/dashboard/actions.ts
"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"

export async function createPost(formData: FormData) {
  const session = await auth()
  if (!session?.user) throw new Error("Unauthorized")

  const title = formData.get("title") as string
  if (!title) throw new Error("Title is required")

  await db.post.create({
    data: { title, userId: session.user.id },
  })

  revalidatePath("/dashboard")
}
```

---

## API Route 패턴

```typescript
// app/api/posts/route.ts
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const posts = await db.post.findMany({
    where: { userId: session.user.id },
  })

  return NextResponse.json(posts)
}
```

---

## Prisma 에러 처리

```typescript
import { Prisma } from "@prisma/client"

try {
  await db.user.create({ data: { email } })
} catch (e) {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2002") {
      return { error: "이미 사용 중인 이메일입니다" }
    }
  }
  throw e
}
```

---

## shadcn/ui 래핑 패턴

```typescript
// ✅ components/ui/ 직접 수정 대신 래핑
// components/feature/submit-button.tsx
"use client"

import { Button } from "@/components/ui/button"
import { useFormStatus } from "react-dom"

export function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "처리 중..." : label}
    </Button>
  )
}
```

---

## Tailwind + cn 유틸 패턴

```typescript
// ✅ 조건부 클래스
import { cn } from "@/lib/utils"

<div className={cn(
  "rounded-lg border p-4",
  isActive && "border-blue-500 bg-blue-50",
  isDisabled && "opacity-50 cursor-not-allowed"
)} />
```

---

## 환경변수 타입 안전하게 쓰기

```typescript
// lib/env.ts — 앱 시작 시 환경변수 검증
const requiredEnvVars = [
  "DATABASE_URL",
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
] as const

for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`)
  }
}

export const env = {
  databaseUrl: process.env.DATABASE_URL!,
  nextauthSecret: process.env.NEXTAUTH_SECRET!,
  nextauthUrl: process.env.NEXTAUTH_URL!,
}
```

---

## dealer-admin Specific Patterns

### CRUD Factory Pattern
```typescript
// app/api/[domain]/route.ts
import { createCrudHandler } from "@/lib/api/create-crud-handler"
import { createSchema, updateSchema } from "@/lib/validations"

export const { GET, POST, PUT, DELETE } = createCrudHandler({
  modelName: "company",
  tenantScoped: true,
  writeRoles: ["ADMIN"],
  createSchema,
  updateSchema,
})
```

### Multi-Tenant Query Pattern
```typescript
// Non-ADMIN users: automatic companyId filtering
// Distributors: getAllDescendants() for hierarchy
```

### Enum Validation Pattern
```typescript
import { createEnumFilter, validateUserRole } from "@/lib/api/validators"

filterMap: {
  role: createEnumFilter("role", validateUserRole, "유효하지 않은 권한입니다")
}
```

---

## live-commerce Specific Patterns

### CRUD Factory Pattern (Prisma Variant)
```typescript
// app/api/[domain]/route.ts
import { createCrudHandlerPrisma } from "@/lib/api/create-crud-handler-prisma"
import { createSchema, updateSchema } from "@/lib/validations"

export const { list: GET, create: POST, update: PUT, delete: DELETE } = createCrudHandlerPrisma({
  model: "product",
  createSchema,
  updateSchema,
  roles: {
    read: ["MASTER", "SUB_MASTER", "ADMIN", "SELLER"],
    write: ["MASTER", "ADMIN"]
  }
})
```

### Center-Based Multi-Tenancy Pattern
```typescript
// Non-MASTER users: automatic centerId filtering
// Masters: see all centers
// Others: see only assigned center (User.centerId)
```

### ONEWMS Integration Pattern
```typescript
import { onewmsClient } from "@/lib/services/onewms"

const result = await onewmsClient.orders.create({ ... })
```

### Marketplace Integration Pattern
```typescript
import { coupangApi } from "@/lib/marketplaces/coupang"
import { naverApi } from "@/lib/marketplaces/naver"

const orders = await coupangApi.getOrders({ ... })
```
