// config.ts
import { z } from "zod";
import dotenv from "dotenv";

dotenv.config(); // Load .env file into process.env

const envSchema = z.object({
    PORT: z.coerce.number().default(3000),
    MOVEMENT_INTERVAL: z.coerce.number().default(200),
    INPUT_RATE_LIMIT: z.coerce.number().default(50),
    TICK_RATE_FPS: z.coerce.number().default(30),
})

const parsedEnv = envSchema.safeParse(process.env)

if (!parsedEnv.success) {
    console.error("Invalid Environment variables", parsedEnv.error.flatten().fieldErrors)
    process.exit(1);
}

export const config = parsedEnv.data;