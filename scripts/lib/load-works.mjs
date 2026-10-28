// node のスクリプト用：config/characters.json と config/corners/*.json を読んで、作品の一覧をひとつにする
import { readdirSync } from 'node:fs';
import { readJson } from './util.mjs';
import { mergeWorks } from './works.mjs';

export function loadWorks() {
  const chars = readJson('config/characters.json');
  const files = readdirSync('config/corners')
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => readJson(`config/corners/${f}`));
  return mergeWorks(chars, files);
}
