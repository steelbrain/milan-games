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
        setup: 'Bunny picks apples from the tree.',
        item: { emoji: '🍎', one: 'apple', many: 'apples' },
        cheer: 'Yum yum!',
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
        setup: 'Puppy hears birds singing.',
        item: { emoji: '🐦', one: 'bird', many: 'birds' },
        cheer: 'Tweet tweet!',
      },
      {
        setup: 'Puppy finds bones in the grass.',
        item: { emoji: '🦴', one: 'bone', many: 'bones' },
        cheer: 'Woof woof!',
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
        setup: 'Friendly aliens wave hello.',
        item: { emoji: '👽', one: 'alien', many: 'aliens' },
        cheer: 'Hello, aliens!',
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
        setup: 'Octopus finds pretty shells.',
        item: { emoji: '🐚', one: 'shell', many: 'shells' },
        cheer: 'So pretty!',
      },
      {
        setup: 'Crabs dance on the sand.',
        item: { emoji: '🦀', one: 'crab', many: 'crabs' },
        cheer: 'Snip snap!',
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
];
