// Curated lists: MOVIE_LISTS is a hand-picked, ordered set of catalog nums
// per list. Shelf shows them under "Browse by"; a list with a `season`
// ({from, to} as "MM-DD", may wrap the new year) is put first while in
// season, and the first in-season list also gets a card on Tonight.
// Lists describe what is in the films (a holiday, a sport, a decade), never
// which families they suit. Lists without a `season` are never pushed on
// Tonight. Rules for adding entries: real catalog nums only, in the order a
// parent would want to see them; a list needs at least 5 titles that fit the
// selected kids before the app shows it at all.
const MOVIE_LISTS = Object.freeze([
  {
    id: 'christmas',
    name: 'Christmas movies',
    blurb: 'Specials, classics and newer favorites for the weeks before Christmas.',
    season: { from: '11-20', to: '12-26' },
    pins: [1137, 863, 1138, 864, 917, 624, 966, 1142, 653, 663, 962, 390, 112, 1118, 463, 908, 909, 1030, 115, 866, 381, 1083, 1075, 178, 186, 229, 559, 660, 959, 250, 1049, 1061, 1149]
  },
  {
    id: 'snow-day',
    name: 'Snow day',
    blurb: 'Snow, ice and sled dogs for the cold months.',
    season: { from: '12-01', to: '02-28' },
    pins: [103, 305, 546, 1138, 966, 645, 968, 969, 936, 408, 422, 465, 387, 596, 414, 1095, 478]
  },
  {
    id: 'spooky-not-too-scary',
    name: 'Spooky but not too scary',
    blurb: 'Pumpkins, friendly ghosts and goofy monsters for October.',
    season: { from: '10-01', to: '10-31' },
    pins: [1139, 1146, 929, 1103, 1104, 1106, 142, 143, 202, 213, 1094, 1098, 1099, 209, 216, 139, 626, 642, 87, 1109, 1110, 1028, 1029, 594, 475]
  },
  {
    id: 'baseball',
    name: 'Baseball movies',
    blurb: 'Sandlots, big leagues and one very good dog, for baseball season.',
    season: { from: '03-20', to: '10-31' },
    pins: [71, 1067, 391, 410, 445, 583, 196]
  },
  {
    id: 'good-teammates',
    name: 'Good teammates',
    blurb: 'Teams that win, and lose, by sticking together.',
    pins: [596, 851, 852, 1068, 1069, 71, 387, 406, 414, 448, 391, 1081, 187, 190, 169, 197, 214, 664]
  },
  {
    id: 'underdogs',
    name: 'Underdogs who never quit',
    blurb: 'Long shots who keep going when nobody expects them to.',
    pins: [1119, 523, 488, 1080, 1085, 435, 387, 1067, 410, 420, 414, 664, 571, 991, 96, 448, 445, 90, 424, 132]
  },
  {
    id: 'eighties',
    name: 'What Mom & Dad watched: the ’80s',
    blurb: 'The movies a lot of parents grew up on.',
    pins: [36, 70, 88, 114, 119, 1, 621, 617, 279, 382, 379, 901, 872, 840, 841, 912, 913, 104, 866, 129, 1059, 90, 902, 906, 876]
  },
  {
    id: 'nineties',
    name: 'What Mom & Dad watched: the ’90s',
    blurb: 'Nineties classics, from Disney musicals to the Sandlot.',
    pins: [101, 281, 282, 4, 286, 110, 389, 116, 118, 1066, 71, 387, 1067, 596, 115, 624, 626, 929, 395, 397, 869, 606, 605, 594, 599, 602, 881]
  }
]);
