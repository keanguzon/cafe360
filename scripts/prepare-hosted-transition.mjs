import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const baselinePath = join(root, 'supabase/migrations/20261016000000_circle_baseline.sql');
const quotaPath = join(root, 'supabase/migrations/20261016000001_places_quota.sql');
const preludePath = join(root, 'supabase/transition/hosted-prelude.sql');
const postludePath = join(root, 'supabase/transition/hosted-postlude.sql');
const outputPath = join(root, '.tmp/hosted-transition.sql');

const bucketBlock = `insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('avatars','avatars',true,5242880,array['image/jpeg','image/png','image/webp']),
       ('visit-photos','visit-photos',false,5242880,array['image/jpeg','image/png','image/webp']);`;
const bucketUpdate = `update storage.buckets as b
set public=d.public, file_size_limit=d.file_size_limit, allowed_mime_types=d.allowed_mime_types
from (values
  ('avatars',true,5242880::bigint,array['image/jpeg','image/png','image/webp']::text[]),
  ('visit-photos',false,5242880::bigint,array['image/jpeg','image/png','image/webp']::text[])
) as d(id,public,file_size_limit,allowed_mime_types)
where b.id=d.id;`;

export async function buildHostedTransition({ baselineSql } = {}) {
  const [prelude, baseline, quota, postlude] = await Promise.all([
    readFile(preludePath, 'utf8'),
    baselineSql === undefined ? readFile(baselinePath, 'utf8') : baselineSql,
    readFile(quotaPath, 'utf8'),
    readFile(postludePath, 'utf8'),
  ]);
  const normalized = baseline.replaceAll('\r\n', '\n');
  if (normalized.split(bucketBlock).length !== 2) {
    throw new Error('Expected exactly one checked-in baseline bucket block; source drift requires review');
  }
  const adapted = normalized.replace(bucketBlock, bucketUpdate);
  const result = [prelude, adapted, quota, postlude]
    .map((sql) => sql.replaceAll('\r\n', '\n'))
    .join('\n');
  if (!result.startsWith('begin;\n') || !result.trimEnd().endsWith('commit;')) {
    throw new Error('Transition prelude is missing');
  }
  return result;
}

if (process.argv[1] && fileURLToPath(import.meta.url).toLowerCase() === process.argv[1].toLowerCase()) {
  const sql = await buildHostedTransition();
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, sql, { flag: 'w' });
  process.stdout.write(`${outputPath}\n`);
}
