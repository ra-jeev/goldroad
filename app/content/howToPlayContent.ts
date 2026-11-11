/**
 * The longer half of How to Play. The sheet's quick reference lives in
 * `UI_COPY.helpSheet`; these sections sit folded beneath it, so the sheet
 * stays short for a player mid-road and still carries the full rules at
 * `/how-to-play`.
 */

export const HOW_TO_PLAY_SEO = {
  title: 'How to Play – GoldRoad',
  description:
    'The rules of GoldRoad, a free daily number path puzzle. Walk from the footprints to the flag and land exactly on the target score.',
} as const;

export const HOW_TO_PLAY_EXAMPLE = {
  /** The tutorial lesson whose tiles the picture reuses. */
  lessonId: 'icons',
  title: 'A small example',
  ariaLabel:
    'A row of three tiles: footprints on 5, then 3, then the finish flag on 6',
  paragraphs: [
    'Each tile you step on adds its value to your score, and the tile you start on counts too.',
    'Start on 5. Step to 3, and your score is 8. Step to 6, the finish, and your score is 14. If the target is 14, the road is solved.',
  ],
} as const;

export type HowToPlaySection = {
  id: string;
  title: string;
  paragraphs?: readonly string[];
  items?: readonly string[];
};

export const HOW_TO_PLAY_MORE: readonly HowToPlaySection[] = [
  {
    id: 'modes',
    title: 'Classic and Expedition',
    paragraphs: [
      'Every day has two roads. Classic is the main daily road. Solve it to unlock Expedition for the day.',
      'Expedition adds toll lanes and bonus lanes. Crossing a toll lane takes points from your score. Crossing a bonus lane adds points. The legend by the board shows what each is worth.',
    ],
  },
  {
    id: 'medals',
    title: 'Medals',
    paragraphs: [
      'Your medal depends on which try solves the road. Gold is the 1st try, Silver is the 2nd and Bronze is the 3rd. After that the road still counts as solved, but there is no medal.',
    ],
  },
  {
    id: 'daily',
    title: 'A new road every day',
    paragraphs: [
      'A new road opens every day at 00:00 UTC. Roads you missed stay open for a while in Past Roads.',
    ],
  },
  {
    id: 'tips',
    title: 'A few tips',
    items: [
      'Compare Board with Target. The gap tells you how much value you must leave out.',
      'Plan the end of the route first. The finish never moves.',
      'A wrong walk costs only a try, so use an early try to learn the road.',
      'In Expedition, count the tolls and bonuses before you commit to a lane.',
    ],
  },
];
