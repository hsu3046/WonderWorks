// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {cards,stepCard} from '../src/cards.ts';

test('the collection ships 30 distinct JPEG artworks with unique identities',()=>{
  assert.equal(cards.length,30);
  assert.equal(new Set(cards.map(card=>card.id)).size,30);
  const hashes=cards.map(card=>{
    const bytes=readFileSync(new URL(`../public/${card.image}`,import.meta.url));
    assert.equal(bytes.subarray(0,3).toString('hex'),'ffd8ff');
    assert.ok(bytes.length>10000,card.id);
    return createHash('sha256').update(bytes).digest('hex');
  });
  assert.equal(new Set(hashes).size,30);
});

test('navigation wraps both ends and re-enters the collection from a custom image',()=>{
  assert.equal(stepCard(29,1),0);
  assert.equal(stepCard(0,-1),29);
  assert.equal(stepCard(null,1),0);
  assert.equal(stepCard(null,-1),29);
  let cursor=0;
  for(let i=0;i<30;i++)cursor=stepCard(cursor,1);
  assert.equal(cursor,0);
  assert.equal(stepCard(0,1,1),0);
  assert.equal(stepCard(null,1,0),null);
});
