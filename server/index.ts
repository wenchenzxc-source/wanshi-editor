import path from 'node:path';
import { createApp } from './app';
import { loadTemplates } from './templates';
const port = Number(process.env.PORT || 4310);
const app = await createApp(path.resolve(process.env.DATA_DIR || 'data'), { templates: await loadTemplates() });
app.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`萬事造物編輯器 API http://127.0.0.1:${port}`));
