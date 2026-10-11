// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
export const cards = [
  {
    "id": "solvyr",
    "name": "SOLVYR",
    "species": "DAWN PHOENIX",
    "image": "./art/cards/solvyr.jpg"
  },
  {
    "id": "nerissa",
    "name": "NERISSA",
    "species": "TIDAL SERPENT",
    "image": "./art/cards/nerissa.jpg"
  },
  {
    "id": "sylvara",
    "name": "SYLVARA",
    "species": "GROVE STAG",
    "image": "./art/cards/sylvara.jpg"
  },
  {
    "id": "vespera",
    "name": "VESPERA",
    "species": "DUSK MOTH",
    "image": "./art/cards/vespera.jpg"
  },
  {
    "id": "ignivar",
    "name": "IGNIVAR",
    "species": "EMBER DRAKE",
    "image": "./art/cards/ignivar.jpg"
  },
  {
    "id": "glacielle",
    "name": "GLACIELLE",
    "species": "FROST SWAN",
    "image": "./art/cards/glacielle.jpg"
  },
  {
    "id": "aureon",
    "name": "AUREON",
    "species": "SUN LION",
    "image": "./art/cards/aureon.jpg"
  },
  {
    "id": "zephyra",
    "name": "ZEPHYRA",
    "species": "SKY RAY",
    "image": "./art/cards/zephyra.jpg"
  },
  {
    "id": "noctelle",
    "name": "NOCTELLE",
    "species": "STAR OWL",
    "image": "./art/cards/noctelle.jpg"
  },
  {
    "id": "mosswick",
    "name": "MOSSWICK",
    "species": "FERN TURTLE",
    "image": "./art/cards/mosswick.jpg"
  },
  {
    "id": "corallin",
    "name": "CORALLIN",
    "species": "REEF SEAHORSE",
    "image": "./art/cards/corallin.jpg"
  },
  {
    "id": "thundrel",
    "name": "THUNDREL",
    "species": "STORM WOLF",
    "image": "./art/cards/thundrel.jpg"
  },
  {
    "id": "opalith",
    "name": "OPALITH",
    "species": "CRYSTAL HARE",
    "image": "./art/cards/opalith.jpg"
  },
  {
    "id": "rosetta",
    "name": "ROSETTA",
    "species": "BLOOM CAT",
    "image": "./art/cards/rosetta.jpg"
  },
  {
    "id": "umbriel",
    "name": "UMBRIEL",
    "species": "ECLIPSE RAVEN",
    "image": "./art/cards/umbriel.jpg"
  },
  {
    "id": "marisol",
    "name": "MARISOL",
    "species": "PEARL KOI",
    "image": "./art/cards/marisol.jpg"
  },
  {
    "id": "citrinel",
    "name": "CITRINEL",
    "species": "AMBER BEETLE",
    "image": "./art/cards/citrinel.jpg"
  },
  {
    "id": "luneth",
    "name": "LUNETH",
    "species": "MOON JELLY",
    "image": "./art/cards/luneth.jpg"
  },
  {
    "id": "bramble",
    "name": "BRAMBLE",
    "species": "THORN BEAR",
    "image": "./art/cards/bramble.jpg"
  },
  {
    "id": "elysian",
    "name": "ELYSIAN",
    "species": "AURORA CRANE",
    "image": "./art/cards/elysian.jpg"
  },
  {
    "id": "prismara",
    "name": "PRISMARA",
    "species": "GLASS BUTTERFLY",
    "image": "./art/cards/prismara.jpg"
  },
  {
    "id": "pyrella",
    "name": "PYRELLA",
    "species": "FLAME SALAMANDER",
    "image": "./art/cards/pyrella.jpg"
  },
  {
    "id": "wisterin",
    "name": "WISTERIN",
    "species": "WISTERIA DRAGON",
    "image": "./art/cards/wisterin.jpg"
  },
  {
    "id": "thalora",
    "name": "THALORA",
    "species": "DEEP WHALE",
    "image": "./art/cards/thalora.jpg"
  },
  {
    "id": "celestine",
    "name": "CELESTINE",
    "species": "COMET UNICORN",
    "image": "./art/cards/celestine.jpg"
  },
  {
    "id": "saffra",
    "name": "SAFFRA",
    "species": "DESERT FENNEC",
    "image": "./art/cards/saffra.jpg"
  },
  {
    "id": "florielle",
    "name": "FLORIELLE",
    "species": "ORCHID MANTIS",
    "image": "./art/cards/florielle.jpg"
  },
  {
    "id": "onyxar",
    "name": "ONYXAR",
    "species": "NIGHT PANTHER",
    "image": "./art/cards/onyxar.jpg"
  },
  {
    "id": "aurielle",
    "name": "AURIELLE",
    "species": "GOLDEN GRYPHON",
    "image": "./art/cards/aurielle.jpg"
  },
  {
    "id": "astralis",
    "name": "ASTRALIS",
    "species": "COSMIC LEVIATHAN",
    "image": "./art/cards/astralis.jpg"
  }
] as const;

// A null cursor represents an uploaded image; return to either end of the collection.
export function stepCard(index:number|null,delta:number,count:number=cards.length):number|null {
 if(count<=0)return null;
 const start=index===null?(delta<0?0:-1):index;
 return ((start+delta)%count+count)%count;
}
