/** Things to count in a story scene, with both noun forms for "1 fish" vs "3 crabs". */
export interface CountingItem {
  readonly emoji: string;
  readonly one: string;
  readonly many: string;
}

/** One page of a counting story, which is one round of the counting game. */
export interface StoryScene {
  /** Sets the scene before the question: "Bunny is packing a picnic basket." */
  readonly setup: string;
  readonly item: CountingItem;
  /** The hero's happy reaction after a correct answer. */
  readonly cheer: string;
}

/** Two colors for the counting board's background gradient, top to bottom. */
export interface Scenery {
  readonly top: string;
  readonly bottom: string;
}

export interface Story {
  readonly id: string;
  readonly title: string;
  readonly hero: string;
  readonly scenery: Scenery;
  /**
   * Every page the story can have, in story order. A game tells a random few of them (see
   * PAGES_PER_GAME), so each scene must make sense without the ones before it.
   */
  readonly scenes: readonly StoryScene[];
  readonly ending: string;
}

export const STORIES: readonly Story[] = [
  {
    id: 'picnic',
    title: "Bunny's Picnic",
    hero: '🐰',
    scenery: { top: '#e0f7ff', bottom: '#c8f2b4' },
    scenes: [
      {
        setup: 'Bunny is packing a picnic basket.',
        item: { emoji: '🥕', one: 'carrot', many: 'carrots' },
        cheer: 'Crunch crunch!',
      },
      {
        setup: 'Bunny bakes cupcakes for the picnic.',
        item: { emoji: '🧁', one: 'cupcake', many: 'cupcakes' },
        cheer: 'Party time!',
      },
      {
        setup: 'Bunny picks apples from the tree.',
        item: { emoji: '🍎', one: 'apple', many: 'apples' },
        cheer: 'Yum yum!',
      },
      {
        setup: 'Bunny picks flowers on the way.',
        item: { emoji: '🌷', one: 'flower', many: 'flowers' },
        cheer: 'So pretty!',
      },
      {
        setup: 'Strawberries for dessert!',
        item: { emoji: '🍓', one: 'strawberry', many: 'strawberries' },
        cheer: 'So sweet!',
      },
      {
        setup: 'Butterflies come to say hello.',
        item: { emoji: '🦋', one: 'butterfly', many: 'butterflies' },
        cheer: 'Flutter flutter!',
      },
      {
        setup: 'Birds come to share the crumbs.',
        item: { emoji: '🐦', one: 'bird', many: 'birds' },
        cheer: 'Tweet tweet!',
      },
      {
        setup: "Bunny's friends come to the picnic.",
        item: { emoji: '🐿️', one: 'squirrel', many: 'squirrels' },
        cheer: 'Hello, friends!',
      },
    ],
    ending: 'What a yummy picnic! Bunny says thank you for counting!',
  },
  {
    id: 'walk',
    title: "Puppy's Walk",
    hero: '🐶',
    scenery: { top: '#d6ecff', bottom: '#b7e4a0' },
    scenes: [
      {
        setup: 'Puppy goes for a walk in the park.',
        item: { emoji: '🌳', one: 'tree', many: 'trees' },
        cheer: 'So tall!',
      },
      {
        setup: 'Squirrels race up the trees.',
        item: { emoji: '🐿️', one: 'squirrel', many: 'squirrels' },
        cheer: 'Up, up, up!',
      },
      {
        setup: 'Puppy hears birds singing.',
        item: { emoji: '🐦', one: 'bird', many: 'birds' },
        cheer: 'Tweet tweet!',
      },
      {
        setup: 'Puppy chases the butterflies.',
        item: { emoji: '🦋', one: 'butterfly', many: 'butterflies' },
        cheer: 'Flutter flutter!',
      },
      {
        setup: 'Puppy finds bones in the grass.',
        item: { emoji: '🦴', one: 'bone', many: 'bones' },
        cheer: 'Woof woof!',
      },
      {
        setup: 'Puppy finds apples under a tree.',
        item: { emoji: '🍎', one: 'apple', many: 'apples' },
        cheer: 'Crunch crunch!',
      },
      {
        setup: 'Puppy wants to play fetch.',
        item: { emoji: '🎾', one: 'ball', many: 'balls' },
        cheer: 'Fetch!',
      },
      {
        setup: 'Puppy sniffs the flowers.',
        item: { emoji: '🌼', one: 'flower', many: 'flowers' },
        cheer: 'Sniff sniff!',
      },
    ],
    ending: 'Puppy had a wonderful walk. Woof! Thank you for counting!',
  },
  {
    id: 'space',
    title: 'Space Trip',
    hero: '🚀',
    scenery: { top: '#1d2a5b', bottom: '#4b3a8c' },
    scenes: [
      {
        setup: 'Three, two, one, blast off! The rocket zooms into the sky.',
        item: { emoji: '⭐', one: 'star', many: 'stars' },
        cheer: 'Twinkle twinkle!',
      },
      {
        setup: 'The rocket flies past the planets.',
        item: { emoji: '🪐', one: 'planet', many: 'planets' },
        cheer: 'Whoosh!',
      },
      {
        setup: 'Look at all the moons!',
        item: { emoji: '🌙', one: 'moon', many: 'moons' },
        cheer: 'So shiny!',
      },
      {
        setup: 'Astronauts float outside the space station.',
        item: { emoji: '🧑‍🚀', one: 'astronaut', many: 'astronauts' },
        cheer: 'Hello, astronauts!',
      },
      {
        setup: 'Friendly aliens wave hello.',
        item: { emoji: '👽', one: 'alien', many: 'aliens' },
        cheer: 'Hello, aliens!',
      },
      {
        setup: 'Flying saucers spin around the rocket.',
        item: { emoji: '🛸', one: 'flying saucer', many: 'flying saucers' },
        cheer: 'Zip zap!',
      },
      {
        setup: 'Robots dance on the moon.',
        item: { emoji: '🤖', one: 'robot', many: 'robots' },
        cheer: 'Beep boop!',
      },
      {
        setup: 'Comets zoom by.',
        item: { emoji: '☄️', one: 'comet', many: 'comets' },
        cheer: 'Zoom zoom!',
      },
    ],
    ending: 'The rocket lands safely back home. What a trip! Great counting!',
  },
  {
    id: 'sea',
    title: 'Under the Sea',
    hero: '🐙',
    scenery: { top: '#b9f0ff', bottom: '#4fb3e8' },
    scenes: [
      {
        setup: 'Octopus swims with the fish.',
        item: { emoji: '🐟', one: 'fish', many: 'fish' },
        cheer: 'Blub blub!',
      },
      {
        setup: 'Dolphins leap out of the water.',
        item: { emoji: '🐬', one: 'dolphin', many: 'dolphins' },
        cheer: 'Splish splash!',
      },
      {
        setup: 'Octopus finds pretty shells.',
        item: { emoji: '🐚', one: 'shell', many: 'shells' },
        cheer: 'So pretty!',
      },
      {
        setup: 'Octopus juggles beach balls.',
        item: { emoji: '🏐', one: 'ball', many: 'balls' },
        cheer: 'What a juggler!',
      },
      {
        setup: 'Crabs dance on the sand.',
        item: { emoji: '🦀', one: 'crab', many: 'crabs' },
        cheer: 'Snip snap!',
      },
      {
        setup: 'Birds fly over the waves.',
        item: { emoji: '🐦', one: 'bird', many: 'birds' },
        cheer: 'Tweet tweet!',
      },
      {
        setup: 'Turtles swim by slowly.',
        item: { emoji: '🐢', one: 'turtle', many: 'turtles' },
        cheer: 'Hello, turtles!',
      },
      {
        setup: 'A family of whales sings a song.',
        item: { emoji: '🐳', one: 'whale', many: 'whales' },
        cheer: 'Splash!',
      },
    ],
    ending: 'Octopus had a splashy day. Thank you for counting!',
  },
  {
    id: 'farm',
    title: "Piggy's Farm",
    hero: '🐷',
    scenery: { top: '#dff4ff', bottom: '#cde89a' },
    scenes: [
      {
        setup: 'Piggy says good morning to the chickens.',
        item: { emoji: '🐔', one: 'chicken', many: 'chickens' },
        cheer: 'Cluck cluck!',
      },
      {
        setup: 'The hens laid eggs in the barn.',
        item: { emoji: '🥚', one: 'egg', many: 'eggs' },
        cheer: "Careful, don't drop them!",
      },
      {
        setup: 'Cows munch on the grass.',
        item: { emoji: '🐄', one: 'cow', many: 'cows' },
        cheer: 'Moo moo!',
      },
      {
        setup: 'Piggy digs up carrots in the garden.',
        item: { emoji: '🥕', one: 'carrot', many: 'carrots' },
        cheer: 'Crunch crunch!',
      },
      {
        setup: 'Sheep rest in the meadow.',
        item: { emoji: '🐑', one: 'sheep', many: 'sheep' },
        cheer: 'Baa baa!',
      },
      {
        setup: 'Birds sing on the fence.',
        item: { emoji: '🐦', one: 'bird', many: 'birds' },
        cheer: 'Tweet tweet!',
      },
      {
        setup: 'Piggy picks apples for a snack.',
        item: { emoji: '🍎', one: 'apple', many: 'apples' },
        cheer: 'Yum yum!',
      },
      {
        setup: 'Horses gallop across the field.',
        item: { emoji: '🐴', one: 'horse', many: 'horses' },
        cheer: 'Clip clop!',
      },
    ],
    ending: 'The sun sets on the farm. Oink oink! Thank you for counting!',
  },
  {
    id: 'dino',
    title: "Dino's Big Day",
    hero: '🦕',
    scenery: { top: '#fff1c9', bottom: '#a8d672' },
    scenes: [
      {
        setup: 'Dino stomps through the jungle.',
        item: { emoji: '🌴', one: 'tree', many: 'trees' },
        cheer: 'Stomp stomp!',
      },
      {
        setup: 'Dino finds eggs in a nest.',
        item: { emoji: '🥚', one: 'egg', many: 'eggs' },
        cheer: 'Crack crack!',
      },
      {
        setup: "Dino's friends come to play.",
        item: { emoji: '🦖', one: 'dinosaur', many: 'dinosaurs' },
        cheer: 'Roar!',
      },
      {
        setup: 'Dino munches on leaves.',
        item: { emoji: '🍃', one: 'leaf', many: 'leaves' },
        cheer: 'Munch munch!',
      },
      {
        setup: 'Dino digs up bones.',
        item: { emoji: '🦴', one: 'bone', many: 'bones' },
        cheer: 'Dig dig dig!',
      },
      {
        setup: "Butterflies land on Dino's nose.",
        item: { emoji: '🦋', one: 'butterfly', many: 'butterflies' },
        cheer: 'That tickles!',
      },
      {
        setup: 'Dino climbs over the rocks.',
        item: { emoji: '🪨', one: 'rock', many: 'rocks' },
        cheer: 'Up and over!',
      },
      {
        setup: 'Volcanoes rumble far away.',
        item: { emoji: '🌋', one: 'volcano', many: 'volcanoes' },
        cheer: 'Rumble rumble!',
      },
    ],
    ending: 'Dino is sleepy after a big day. Goodnight, Dino! Thank you for counting!',
  },
];
