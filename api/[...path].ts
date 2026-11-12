import path from 'node:path';
import { createApp } from '../server/app.js';
import { loadTemplates } from '../server/templates.js';
import { waitUntil } from '@vercel/functions';

if (!process.env.SUPABASE_URL || !(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)) {
  throw new Error('Vercel 部署缺少 SUPABASE_URL 與 SUPABASE_SECRET_KEY');
}

const app = await createApp(path.resolve('/tmp/wanshi-editor'), { templates: await loadTemplates(), background: waitUntil });
export default app;
