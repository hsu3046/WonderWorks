// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import type { PageContent } from './types';

// Original AIB sample prose. This is never presented as fetched Wikipedia text.
export const sample: PageContent = {
  title: 'The web is a living thing.', url: 'wonderworks://field-notes', source: 'demo', truncated: false,
  blocks: [
    { kind: 'h1', text: 'The web is a living thing.' },
    { kind: 'p', text: 'Every page is a little ecosystem. Words gather into sentences, sentences branch into stories, and links reach out like silken threads. Somewhere in this tangle, a small creature is getting hungry.' },
    { kind: 'h2', text: '01 / A different kind of crawler' },
    { kind: 'p', text: 'Most web crawlers move quietly. They follow an address, collect a page, and disappear into the machinery of a search engine. This one has eight legs, a curious nature, and an appetite for language.' },
    { kind: 'p', text: 'Watch closely. A foot finds its place between two words. Another reaches across a line. The body turns toward a fragment of meaning, and a sentence begins to come undone. Nothing is wasted. Every little letter becomes part of the journey.' },
    { kind: 'quote', text: 'What if reading a page left a beautiful, visible trace?' },
    { kind: 'h2', text: '02 / Follow the thread' },
    { kind: 'p', text: 'A spider understands a web through movement. A vibration becomes a direction; a direction becomes a path. Our little crawler follows a similar instinct, looking for nearby words and leaving a fine thread behind.' },
    { kind: 'p', text: 'Click a word to offer it to the spider. Give it a whole sentence when it is especially hungry. Slow things down to watch the choreography, or invite a few friends to share the feast.' },
    { kind: 'h2', text: '03 / 작은 문장들의 생태계' },
    { kind: 'p', text: '거미에게 웹은 읽을 수 있는 풍경입니다. 가느다란 다리는 글자 사이를 디디고, 단어 하나는 몸을 향해 날아갑니다. 문장이 사라진 자리에는 조용한 여백과 실 한 가닥이 남습니다.' },
    { kind: 'p', text: '위에 웹사이트 주소를 넣어 새로운 먹이를 찾아 주세요. 화면에 보이는 단어를 누르면 거미가 다가옵니다. 페이지를 아래로 스크롤하면 아직 읽지 않은 이야기가 기다리고 있습니다.' },
    { kind: 'h2', text: '04 / An endless appetite' },
    { kind: 'p', text: 'The internet keeps growing, one thought at a time. A field note from a distant island. An explanation of the stars. A recipe written on a rainy afternoon. No two pages taste quite the same.' },
    { kind: 'p', text: 'At the end of a page, follow a discovered link to continue exploring. Or restore the words and let the dance begin again. The original page stays exactly as its author left it.' },
  ],
  links: [
    { title: 'The first website', url: 'https://info.cern.ch/hypertext/WWW/TheProject.html' },
    { title: 'Example Domain', url: 'https://example.com' },
  ],
};
