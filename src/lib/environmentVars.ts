import { config } from "dotenv";
import { z } from "zod";
config({ override: true });

const AppEnvironmentEnum = z.enum([
  "development",
  "staging",
  "production",
  "test", // jest sets the environment as test so this is added
]);

export type AppEnvironment = z.infer<typeof AppEnvironmentEnum>;

const environmentVarsSchema = z.object({
  NODE_ENV: AppEnvironmentEnum,
  PORT: z.string(),
  NODE_AI_EXPERIMENTS_SERVER_URL: z.string(),
  MCP_SECRET: z.string(),
});

const fields: z.infer<typeof environmentVarsSchema> = {
  NODE_ENV: process.env.NODE_ENV! as AppEnvironment,
  PORT: process.env.PORT!,
  NODE_AI_EXPERIMENTS_SERVER_URL: process.env.NODE_AI_EXPERIMENTS_SERVER_URL!,
  MCP_SECRET: process.env.MCP_SECRET!,
};

const environmentVars = environmentVarsSchema.parse(fields);
export default environmentVars;
