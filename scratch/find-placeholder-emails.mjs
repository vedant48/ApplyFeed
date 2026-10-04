import { Client, Databases, Query } from 'node-appwrite';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);

async function main() {
  console.log('Querying emails with placeholder text...');
  let offset = 0;
  const limit = 100;
  let totalFound = 0;
  const placeholderIds = [];

  while (true) {
    const res = await databases.listDocuments('applyfeed', 'emails', [
      Query.limit(limit),
      Query.offset(offset),
    ]);

    for (const doc of res.documents) {
      const body = (doc.bodyText || '').trim().toLowerCase();
      if (body.includes('please enable html') || body === 'please enable html' || body === 'enable html') {
        totalFound++;
        placeholderIds.push({
          id: doc.$id,
          subject: doc.subject,
          snippet: doc.snippet,
          bodyText: doc.bodyText,
          sender: doc.sender,
          providerMessageId: doc.providerMessageId,
        });
      }
    }

    offset += res.documents.length;
    if (res.documents.length === 0 || offset >= res.total) {
      break;
    }
  }

  console.log(`Found ${totalFound} emails with "Please Enable HTML" out of total emails scanned.`);
  if (placeholderIds.length > 0) {
    console.log('Sample matching emails:');
    placeholderIds.slice(0, 5).forEach((p, idx) => {
      console.log(`[${idx + 1}] ID: ${p.id}`);
      console.log(`    Sender: ${p.sender}`);
      console.log(`    Subject: ${p.subject}`);
      console.log(`    Snippet: ${p.snippet}`);
      console.log(`    BodyText: ${p.bodyText}`);
    });
  }
}

main().catch(console.error);
