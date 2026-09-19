import { AIClassifierProvider } from './provider';
import { OpenAIClassifierProvider } from './openai';
import { RuleBasedClassifierProvider } from './mock';

export function getAIClassifier(): AIClassifierProvider {
  if (process.env.OPENAI_API_KEY) {
    return new OpenAIClassifierProvider();
  }
  return new RuleBasedClassifierProvider();
}

export * from './types';
export * from './provider';
