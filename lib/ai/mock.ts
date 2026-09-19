import { AIClassifierProvider } from './provider';
import { EmailClassificationInput, ClassificationResult, ClassificationResultSchema, JobCategory } from './types';
import { detectPlatform, extractCompany, extractRole } from '../email/extractor';

export class RuleBasedClassifierProvider implements AIClassifierProvider {
  name = 'rule-based-fallback';

  async classifyEmail(input: EmailClassificationInput): Promise<ClassificationResult> {
    const text = `${input.subject} ${input.snippet} ${input.bodyText || ''}`.toLowerCase();
    const subject = input.subject.toLowerCase();
    const sender = `${input.sender} ${input.senderEmail}`.toLowerCase();

    const platform = detectPlatform(`${input.snippet} ${input.bodyText || ''}`, input.links || []);
    const company = extractCompany(input.sender, input.senderEmail, input.subject, input.bodyText || input.snippet);
    const role = extractRole(input.subject, input.bodyText || input.snippet);

    let category: JobCategory = 'OTHER_JOB';
    let isJobRelated = true;
    let requiresAttention = false;
    let confidence = 0.95;

    // 1. Rejections
    if (
      subject.includes('thank you for your interest') ||
      subject.includes('update on your application') ||
      text.includes('unfortunately') ||
      text.includes('decided to pursue other candidates') ||
      text.includes('chosen to move forward with other') ||
      text.includes('not moving forward') ||
      text.includes('we will not be moving forward')
    ) {
      category = 'REJECTION';
      requiresAttention = false;
    }
    // 2. Offers
    else if (
      subject.includes('offer of employment') ||
      subject.includes('job offer') ||
      subject.includes('offer letter') ||
      text.includes('pleased to offer you') ||
      text.includes('thrilled to extend an offer') ||
      text.includes('offer to join')
    ) {
      category = 'OFFER';
      requiresAttention = true;
    }
    // 3. Interview Schedule / Invitations
    else if (
      subject.includes('schedule your') ||
      subject.includes('interview schedule') ||
      subject.includes('time slot') ||
      text.includes('select a time') ||
      text.includes('calendly.com') ||
      text.includes('schedule an interview')
    ) {
      category = 'INTERVIEW_SCHEDULE';
      requiresAttention = true;
    }
    else if (
      subject.includes('interview invitation') ||
      subject.includes('invite to interview') ||
      subject.includes('invitation to interview') ||
      text.includes('like to invite you to') ||
      text.includes('technical interview') ||
      text.includes('onsite interview')
    ) {
      category = 'INTERVIEW';
      requiresAttention = true;
    }
    // 4. Assessments
    else if (
      subject.includes('assessment') ||
      subject.includes('take-home') ||
      subject.includes('coding challenge') ||
      subject.includes('hackerrank') ||
      subject.includes('coderpad') ||
      text.includes('complete the coding test') ||
      text.includes('asynchronous coding exercise')
    ) {
      category = 'ASSESSMENT';
      requiresAttention = true;
    }
    // 5. Application received
    else if (
      subject.includes('application received') ||
      subject.includes('thank you for applying') ||
      subject.includes('we received your application') ||
      text.includes('received your application') ||
      text.includes('thanks for applying')
    ) {
      category = 'APPLICATION_RECEIVED';
      requiresAttention = false;
    }
    // 6. Recruiter reachout
    else if (
      sender.includes('recruiter') ||
      sender.includes('talent') ||
      subject.includes('opportunity at') ||
      subject.includes('saw your profile') ||
      text.includes('came across your profile') ||
      text.includes('impressed by your background')
    ) {
      category = 'RECRUITER';
      requiresAttention = true;
    }
    // 7. General application
    else if (
      subject.includes('application status') ||
      subject.includes('job application') ||
      text.includes('your candidacy')
    ) {
      category = 'APPLICATION';
      requiresAttention = false;
    }
    // 8. Follow up
    else if (
      subject.includes('following up') ||
      subject.includes('status check') ||
      text.includes('following up on your')
    ) {
      category = 'FOLLOW_UP';
      requiresAttention = true;
    }
    // 9. Non job related
    else {
      isJobRelated = false;
      category = 'NOT_JOB_RELATED';
      confidence = 0.85;
    }

    const result: ClassificationResult = {
      isJobRelated,
      category,
      company,
      role,
      platform,
      requiresAttention,
      confidence,
    };

    return ClassificationResultSchema.parse(result);
  }
}
