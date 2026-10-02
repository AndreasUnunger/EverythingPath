import { reviewedAdmissionSchema } from './admission-schema.ts';
import { legalResourcesSchema } from './legal-types.ts';
import registryData from './data/section15-registry.json';
import assessmentsData from './data/attribution-assessments.json';
import evidenceData from './data/attribution-evidence.json';
import resourcesData from './data/resources.json';

export const reviewedAdmission = reviewedAdmissionSchema.parse({
  assessments: assessmentsData,
  evidence: evidenceData,
  registry: registryData,
});

export const section15Registry = reviewedAdmission.registry;
export const legalResources = legalResourcesSchema.parse(resourcesData);
