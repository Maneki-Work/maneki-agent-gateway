/**
 * Data layer over the Maneki jobs.
 *
 * Two modes:
 * - Remote (production): MANEKI_DATA_API + AGENT_GATEWAY_KEY set — every
 *   query hits Maneki's private search API. The full dataset never exists
 *   as a file anywhere; access is revocable server-side at any time.
 * - Local fallback: reads the public sample (100 most recent jobs) from
 *   github.com/Maneki-Work/jobs-data so anyone can clone and run this repo.
 */

const SAMPLE_URL =
  "https://raw.githubusercontent.com/Maneki-Work/jobs-data/main/sample.json";
const CACHE_TTL_MS = 30 * 60 * 1000;

export interface Job {
  id: number;
  title: string;
  company: string;
  company_slug: string;
  logo_url: string | null;
  location: string | null;
  remote: boolean | null;
  work_mode: string | null;
  seniority: string | null;
  skills: string[];
  job_url?: string;
  posted_at: string | null;
  scraped_at?: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  salary_period: string | null;
  salary_offers_equity: boolean | null;
  maneki_url: string;
  company_url: string | null;
}

/**
 * Public projection of a job. Deliberately excludes `job_url` (the direct
 * ATS/apply link): applications go through the Maneki job page, same rule as
 * every other Maneki distribution surface (Telegram, newsletter, MCP).
 */
export interface PublicJob {
  id: number;
  title: string;
  company: string;
  location: string | null;
  work_mode: string | null;
  seniority: string | null;
  skills: string[];
  posted_at: string | null;
  maneki_url: string;
  company_url: string | null;
}

export interface JobWithSalary extends PublicJob {
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  salary_period: string | null;
  salary_offers_equity: boolean | null;
}

let cache: { jobs: Job[]; fetchedAt: number } | null = null;

function remoteApi(): { url: string; key: string } | null {
  const url = process.env.MANEKI_DATA_API;
  const key = process.env.AGENT_GATEWAY_KEY;
  return url && key ? { url, key } : null;
}

async function remoteFetch<T>(params: Record<string, string>): Promise<T> {
  const api = remoteApi()!;
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${api.url}?${qs}`, {
    headers: { "x-agent-gateway-key": api.key },
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Maneki data API error: ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function loadJobs(): Promise<Job[]> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache.jobs;
  const res = await fetch(SAMPLE_URL);
  if (!res.ok) {
    if (cache) return cache.jobs;
    throw new Error(`Failed to load jobs dataset: ${res.status}`);
  }
  const jobs = (await res.json()) as Job[];
  cache = { jobs, fetchedAt: Date.now() };
  return jobs;
}

export function toPublicJob(job: Job): PublicJob {
  return {
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location,
    work_mode: job.work_mode,
    seniority: job.seniority,
    skills: job.skills,
    posted_at: job.posted_at,
    maneki_url: job.maneki_url,
    company_url: job.company_url,
  };
}

export function toJobWithSalary(job: Job): JobWithSalary {
  return {
    ...toPublicJob(job),
    salary_min: job.salary_min,
    salary_max: job.salary_max,
    salary_currency: job.salary_currency,
    salary_period: job.salary_period,
    salary_offers_equity: job.salary_offers_equity,
  };
}

export interface SearchParams {
  q?: string;
  seniority?: string;
  work_mode?: string;
  company?: string;
  limit?: number;
}

export async function searchJobs(params: SearchParams): Promise<Job[]> {
  if (remoteApi()) {
    const query: Record<string, string> = { limit: String(params.limit ?? 20) };
    if (params.q) query.q = params.q;
    if (params.seniority) query.seniority = params.seniority;
    if (params.work_mode) query.work_mode = params.work_mode;
    if (params.company) query.company = params.company;
    const { jobs } = await remoteFetch<{ jobs: Job[] }>(query);
    return jobs;
  }
  const jobs = await loadJobs();
  const q = params.q?.toLowerCase().trim();
  const results = jobs.filter((job) => {
    if (params.seniority && job.seniority !== params.seniority) return false;
    if (params.work_mode && job.work_mode !== params.work_mode) return false;
    if (
      params.company &&
      job.company_slug !== params.company &&
      job.company.toLowerCase() !== params.company.toLowerCase()
    )
      return false;
    if (q) {
      const haystack = [job.title, job.company, job.location ?? "", ...job.skills]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
  return results.slice(0, params.limit ?? 20);
}

export async function getJob(id: number): Promise<Job | undefined> {
  if (remoteApi()) {
    const { job } = await remoteFetch<{ job: Job | null }>({ id: String(id) });
    return job ?? undefined;
  }
  const jobs = await loadJobs();
  return jobs.find((job) => job.id === id);
}

export async function listHiringCompanies(): Promise<
  { company: string; company_slug: string | null; open_positions: number; company_url: string | null }[]
> {
  if (remoteApi()) {
    const { companies } = await remoteFetch<{
      companies: { company: string; company_slug: string | null; open_positions: number; company_url: string | null }[];
    }>({ aggregate: "companies" });
    return companies;
  }
  const jobs = await loadJobs();
  const bySlug = new Map<
    string,
    { company: string; company_slug: string; open_positions: number; company_url: string | null }
  >();
  for (const job of jobs) {
    const entry = bySlug.get(job.company_slug);
    if (entry) entry.open_positions += 1;
    else
      bySlug.set(job.company_slug, {
        company: job.company,
        company_slug: job.company_slug,
        open_positions: 1,
        company_url: job.company_url,
      });
  }
  return [...bySlug.values()].sort((a, b) => b.open_positions - a.open_positions);
}
