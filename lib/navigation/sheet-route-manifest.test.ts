import { existsSync } from 'node:fs';
import { expect, it } from 'vitest';
const routeFiles = [
 'app/(main)/map/layout.tsx','app/(main)/map/default.tsx',
 'app/(main)/map/@sheet/default.tsx','app/(main)/map/@sheet/page.tsx','app/(main)/map/@sheet/[...catchAll]/page.tsx',
 'app/(main)/map/@sheet/(..)profile/page.tsx',
 'app/(main)/map/@sheet/(..)profile/collections/page.tsx',
 'app/(main)/map/@sheet/(..)profile/collections/[name]/page.tsx',
 'app/(main)/map/@sheet/(..)profile/[userId]/page.tsx',
 'app/(main)/map/@sheet/(..)circles/page.tsx',
 'app/(main)/map/@sheet/(..)circles/[groupId]/page.tsx',
 'app/(main)/map/@sheet/(..)circles/[groupId]/timeline/page.tsx',
 'app/(main)/map/@sheet/(..)circles/groups/new/page.tsx',
 'app/(main)/map/@sheet/(..)settings/page.tsx',
 'app/(main)/map/@sheet/(..)cafes/[cafeId]/[[...segments]]/page.tsx',
 'app/(main)/map/@sheet/(..)memories/[visitId]/page.tsx',
];
it.each(routeFiles)('retains only cafe and memory interception, leaving personal and Circle pages standalone: %s',file=>{
 const standalone=/\(\.\.\)(profile|circles|settings)/.test(file);
 expect(existsSync(file)).toBe(!standalone);
});

