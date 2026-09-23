// schemas/imageIdentifySchema.zod.ts
import { z } from "zod";

export const ImageIdentifySchema = z.object({
  esLugarPuntual: z.boolean(),
  lugar: z.string().default(""),
  pais: z.string().default(""),
  sugerencias: z.array(z.string()).default([]),
});

export type ImageIdentifyResult = z.infer<typeof ImageIdentifySchema>;
