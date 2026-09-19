import { EmailClassificationInput, ClassificationResult } from './types';

export interface AIClassifierProvider {
  name: string;
  classifyEmail(input: EmailClassificationInput): Promise<ClassificationResult>;
}
