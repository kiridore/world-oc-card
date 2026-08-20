import { z } from 'zod'

const uuid = z.string().min(1)
const iso = z.string().min(1)

// ---- FieldBlock（骨架校验：块类型/嵌套/引用格式合法，块内容不校验，DESIGN.md §2.1）----
export const fieldBlockSchema: z.ZodType<import('../types').FieldBlock> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({ type: z.literal('group'), title: z.string(), children: z.array(fieldBlockSchema) }),
    z.object({
      type: z.literal('kv'),
      title: z.string(),
      items: z.array(z.object({ key: z.string(), value: z.string() })),
    }),
    z.object({ type: z.literal('text'), title: z.string(), content: z.string() }),
    z.object({
      type: z.literal('list'),
      title: z.string(),
      items: z.array(z.string()),
      flag: z.literal('tags').optional(),
    }),
    z.object({ type: z.literal('image'), title: z.string(), assetId: uuid }),
    z.object({
      type: z.literal('table'),
      title: z.string(),
      header: z.array(z.string()),
      rows: z.array(z.array(z.string())),
    }),
    z.object({
      type: z.literal('link'),
      title: z.string(),
      targetType: z.enum(['character', 'codexEntry', 'event']),
      targetId: uuid,
    }),
  ]),
)

export const characterSchema = z.strictObject({
  id: uuid,
  name: z.string().min(1),
  fieldBlocks: z.array(fieldBlockSchema),
  createdAt: iso,
  updatedAt: iso,
})

export const codexTypeSchema = z.object({ id: uuid, key: z.string().min(1), name: z.string().min(1) })
export const codexEntrySchema = z.strictObject({
  id: uuid,
  typeId: uuid,
  name: z.string().min(1),
  content: z.string(),
  attributes: z.array(z.object({ key: z.string(), value: z.string() })),
  color: z.string(),
})

export const relationArrowSchema = z.enum(['none', 'single', 'double'])
export const relationTypeSchema = z.strictObject({
  id: uuid,
  name: z.string().min(1),
  color: z.string(),
  arrow: relationArrowSchema,
})

/** v1 旧格式 relationTypes（directed 布尔）——迁移管道 v1→v2 的输入 */
export const legacyRelationTypeV1Schema = z.object({
  id: uuid,
  name: z.string().min(1),
  color: z.string(),
  directed: z.boolean(),
})

export const relationSchema = z.strictObject({
  id: uuid,
  from: uuid,
  to: uuid,
  typeId: uuid,
  description: z.string(),
})

export const calendarSchema = z.strictObject({
  id: uuid,
  name: z.string().min(1),
  offset: z.number(),
  unitYears: z.number().positive(),
})

export const worldlineSchema = z.strictObject({
  id: uuid,
  name: z.string().min(1),
  parentWorldlineId: uuid.nullable(),
  forkPointEventId: uuid.nullable(),
  color: z.string(),
  status: z.enum(['active', 'abandoned']),
  order: z.number(),
})

export const eventTimeSchema = z.object({
  calendarId: uuid,
  value: z.number(),
  display: z.string(),
})

export const eventSchema = z.strictObject({
  id: uuid,
  worldlineId: uuid,
  time: eventTimeSchema.nullable(),
  title: z.string().min(1),
  description: z.string(),
  participantIds: z.array(uuid),
  locationId: uuid.nullable(),
  causalLinks: z.array(uuid),
  canvasPos: z.object({ x: z.number(), y: z.number() }).optional(),
  collapsed: z.boolean(),
  locked: z.boolean(),
})

export const templateSchema = z.strictObject({
  id: uuid,
  name: z.string().min(1),
  scope: z.enum(['character', 'codex']),
  codexTypeId: uuid.optional(),
  payload: z.union([
    z.object({ fieldBlocks: z.array(fieldBlockSchema) }),
    z.object({ attributeKeys: z.array(z.string()), contentSkeleton: z.string().optional() }),
  ]),
  builtin: z.boolean().optional(),
  createdAt: iso,
})

export const projectStatsSchema = z.strictObject({
  characters: z.number(),
  codex: z.number(),
  events: z.number(),
  worldlines: z.number(),
  relations: z.number(),
})

export const projectMetaSchema = z.strictObject({
  id: uuid,
  name: z.string().min(1),
  schemaVersion: z.number().int().nonnegative(),
  createdAt: iso,
  updatedAt: iso,
  stats: projectStatsSchema.optional(),
})

export const settingsSchema = z.strictObject({
  calendars: z.array(calendarSchema),
  relationTypes: z.array(relationTypeSchema),
  codexTypes: z.array(codexTypeSchema),
  worldlines: z.array(worldlineSchema),
})

/** v1 旧格式 settings.json（relationTypes 为 directed 布尔形态），迁移管道 v1→v2 的输入 */
export const legacySettingsV1Schema = z.object({
  calendars: z.array(calendarSchema),
  relationTypes: z.array(legacyRelationTypeV1Schema),
  codexTypes: z.array(codexTypeSchema),
  worldlines: z.array(worldlineSchema),
})

// ---- zip 内各文件的形状（§3.1）----
export const relationsFileSchema = z.object({ relations: z.array(relationSchema) })

// v0 旧格式：关系边内联 type/directed（迁移管道 v0→v1 的输入，见 storage/migration.ts）
export const legacyRelationsFileSchema = z.object({
  relations: z.array(z.object({
    id: uuid, from: uuid, to: uuid, type: z.string(), directed: z.boolean(), description: z.string().optional(),
  })),
})
export const templatesFileSchema = z.object({ templates: z.array(templateSchema) })
export const charactersFileSchema = z.object({ character: characterSchema })
export const codexFileSchema = z.object({ entry: codexEntrySchema })
export const eventsFileSchema = z.object({ event: eventSchema })
export const assetsIndexFileSchema = z.object({
  assets: z.array(z.object({ id: uuid, ext: z.string(), name: z.string(), mime: z.string(), size: z.number() })),
})

export const templateFileSchema = z.object({ template: templateSchema })

export type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string }
export function parseWith<T>(schema: z.ZodType<T>, input: unknown): ParseResult<T> {
  const r = schema.safeParse(input)
  if (r.success) return { ok: true, data: r.data }
  const first = r.error.issues[0]
  const path = first ? first.path.join('.') : ''
  return { ok: false, error: `${path ? path + ': ' : ''}${first?.message ?? '校验失败'}` }
}
