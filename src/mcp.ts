/**
 * Open, read-only MCP server over the Maneki jobs dataset.
 *
 * Free surface: capped, compact results meant for discovery inside AI
 * assistants. Full result sets and salary data live behind the
 * AgentKit-gated REST endpoint (see agent.ts).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getJob,
  listHiringCompanies,
  searchJobs,
  toJobWithSalary,
  toPublicJob,
} from "./jobs.js";

const MCP_RESULT_CAP = 10;

function jsonContent(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

export function createMcpServer(): McpServer {
  const server = new McpServer({ name: "maneki-jobs", version: "0.1.0" });

  server.registerTool(
    "search_jobs",
    {
      title: "Search Web3 jobs",
      description:
        "Search active Web3 jobs on maneki.work by keyword, seniority, work mode or company. " +
        "Returns up to 10 compact results. Apply links are Maneki job pages.",
      inputSchema: {
        q: z.string().optional().describe("Keyword: role, skill, company or location"),
        seniority: z
          .string()
          .optional()
          .describe("Seniority bucket, e.g. junior, mid, senior, lead, head, executive"),
        work_mode: z.string().optional().describe("remote | hybrid | onsite"),
        company: z.string().optional().describe("Company name or slug"),
      },
    },
    async ({ q, seniority, work_mode, company }) => {
      const jobs = await searchJobs({ q, seniority, work_mode, company, limit: MCP_RESULT_CAP });
      return jsonContent(jobs.map(toPublicJob));
    },
  );

  server.registerTool(
    "get_job",
    {
      title: "Get a job by id",
      description: "Fetch one job by its Maneki id, including salary data when available.",
      inputSchema: { id: z.number().describe("Job id as returned by search_jobs") },
    },
    async ({ id }) => {
      const job = await getJob(id);
      if (!job) return jsonContent({ error: `No job with id ${id}` });
      return jsonContent(toJobWithSalary(job));
    },
  );

  server.registerTool(
    "list_hiring_companies",
    {
      title: "List hiring companies",
      description: "List Web3 companies currently hiring on maneki.work with open position counts.",
      inputSchema: {},
    },
    async () => jsonContent(await listHiringCompanies()),
  );

  return server;
}
