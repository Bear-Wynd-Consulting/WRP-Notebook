/**
 * Structured lease/contract fields extracted from a PDF via AI.
 *
 * Every scalar allows an "unclear" sentinel instead of forcing a guess — this
 * data seeds the Property Management app's tenant database via the public
 * API, so admitting uncertainty (and routing it through human review before
 * commit) is safer than a hallucinated rent or lease-end date.
 */
import { z } from "zod";

const extractedString = (max: number) =>
  z.union([z.string().trim().max(max), z.literal("unclear")]).nullable();

export const contractFieldsSchema = z.object({
  tenantName: extractedString(300),
  rentalRate: extractedString(50),
  rentalFrequency: z
    .enum(["monthly", "weekly", "annually", "quarterly", "unclear"])
    .nullable(),
  leaseStartDate: extractedString(20),
  leaseEndDate: extractedString(20),
  unitIdentifier: extractedString(200),
  renewalTerms: extractedString(1000),
  autoRenew: z.union([z.boolean(), z.literal("unclear")]),
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
});

export type ContractFields = z.infer<typeof contractFieldsSchema>;
