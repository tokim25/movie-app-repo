// Curated lists: MOVIE_LISTS is a hand-picked, ordered set of catalog nums
// per list. Shelf shows them under "Browse by"; a list with a `season`
// ({from, to} as "MM-DD", may wrap the new year) is put first while in
// season, and every in-season list (up to 3, in this order) gets a card on Tonight.
// Lists describe what is in the films (a holiday, a sport, a decade), never
// which families they suit. Lists without a `season` (or `dates`) are never pushed on
// Tonight. Rules for adding entries: real catalog nums only, in the order a
// parent would want to see them; a list needs at least 5 titles that fit the
// selected kids before the app shows it at all. `copy` is the one line under
// the name on its passport card, and an optional `short` name (up to 22
// characters) goes on its coming-attraction ticket when the full name is long.
const MOVIE_LISTS = Object.freeze([
  {
    // Hanukkah moves every year, so it uses real date ranges (from three
    // days before the first candle to the last night) instead of a season.
    // Dates checked against hebcal.com on 2026-11-15; add a year each
    // December. It sits ahead of Christmas so its short window gets the
    // first Tonight card, and needs only 2 fitting titles (tokim25, 2026-11-15:
    // show it even when only two fit) because so few Hanukkah films exist.
    id: 'hanukkah',
    short: 'Hanukkah',
    name: 'Hanukkah movies',
    copy: 'Candles, latkes and a Rugrats special.',
    blurb: 'The story of the Hanukkah lights, a Rugrats special and two films with a Hanukkah at their heart.',
    dates: [['2026-12-01', '2026-12-12'], ['2027-12-21', '2028-01-01'], ['2028-12-09', '2028-12-20'], ['2029-11-28', '2029-12-09'], ['2030-12-17', '2030-12-28']],
    minFit: 2,
    pins: [1155, 1156, 617, 197]
  },
  {
    // Ramadan and Eid move through the Gregorian calendar. These calculated
    // North American dates come from the Fiqh Council of North America and
    // can vary by a day with local moon sighting; checked 2026-11-16.
    id: 'ramadan-eid',
    short: 'Ramadan & Eid',
    name: 'Ramadan nights and Eid mornings',
    copy: 'Faith, family and a joyful Eid morning.',
    blurb: 'Muslim children and families at the center, from Ramadan reflection to the joy of Eid.',
    dates: [['2027-02-08', '2027-03-10'], ['2028-01-28', '2028-02-27'], ['2029-01-16', '2029-02-15'], ['2030-01-05', '2030-02-05'], ['2030-12-26', '2031-01-25']],
    minFit: 1,
    pins: [1157, 1158, 1160, 84, 1159, 63]
  },
  {
    // Passover moves with the Hebrew calendar. Dates run from a week before
    // the first seder to the last day of Passover, worked out with the Gauss
    // Passover formula and checked against known years on 2026-11-22. Add a
    // year each spring. Few family Passover films exist, so it needs only 2.
    id: 'passover',
    short: 'Passover',
    name: 'Passover movies',
    copy: 'Moses, matzah and a puppet seder.',
    blurb: 'The Exodus story for different ages, from a puppet seder to two big retellings.',
    dates: [['2027-04-14', '2027-04-29'], ['2028-04-03', '2028-04-18'], ['2029-03-23', '2029-04-07'], ['2030-04-10', '2030-04-25']],
    minFit: 2,
    pins: [1170, 500, 1171]
  },
  {
    // Easter (Western date) moves too: two weeks before through Easter
    // Monday. Dates computed with the standard Gregorian Easter algorithm.
    id: 'easter',
    short: 'Easter',
    name: 'Easter movies',
    copy: 'Egg hunts, bunnies and a beagle.',
    blurb: 'Specials, cartoons and an old musical for the weeks around Easter.',
    dates: [['2027-03-14', '2027-03-29'], ['2028-04-02', '2028-04-17'], ['2029-03-18', '2029-04-02'], ['2030-04-07', '2030-04-22']],
    minFit: 3,
    pins: [1174, 1175, 1173, 1176, 1172, 521, 1177, 1178]
  },
  {
    // US Thanksgiving, the fourth Thursday of November. It starts on
    // November 3 so it doesn't overlap Día de los Muertos, which ends
    // November 2, and sits ahead of Christmas so it comes first on Tonight
    // until Thanksgiving Day.
    id: 'thanksgiving',
    short: 'Thanksgiving',
    name: 'Thanksgiving movies',
    copy: 'Toast, popcorn and two runaway turkeys.',
    blurb: 'A Peanuts classic, a Pooh feast and a turkey comedy for November.',
    dates: [['2026-11-03', '2026-11-26'], ['2027-11-03', '2027-11-25'], ['2028-11-03', '2028-11-23'], ['2029-11-03', '2029-11-22'], ['2030-11-03', '2030-11-28']],
    minFit: 2,
    pins: [1179, 1181, 1180]
  },
  {
    id: 'christmas',
    short: 'Christmas',
    name: 'Christmas movies',
    copy: 'Cocoa, cardigans and a reindeer or two.',
    blurb: 'Specials, classics and newer favorites for the weeks before Christmas.',
    season: { from: '11-20', to: '12-26' },
    pins: [1137, 863, 1138, 864, 917, 624, 966, 1142, 653, 663, 962, 390, 112, 1118, 463, 908, 909, 1030, 115, 866, 381, 1083, 1075, 178, 186, 229, 559, 660, 959, 250, 1049, 1061, 1149, 1211, 1216]
  },
  {
    id: 'snow-day',
    name: 'Snow day',
    copy: 'Sleds, snowmen and a lot of ice.',
    blurb: 'Snow, ice and sled dogs for the cold months.',
    season: { from: '12-01', to: '02-28' },
    pins: [103, 305, 546, 1138, 966, 645, 968, 969, 936, 408, 422, 465, 387, 596, 414, 1095, 478, 1197, 1211]
  },
  {
    id: 'spooky-not-too-scary',
    short: 'Spooky',
    name: 'Spooky but not too scary',
    copy: 'Friendly ghosts and goofy monsters.',
    blurb: 'Pumpkins, friendly ghosts and goofy monsters for October.',
    season: { from: '10-01', to: '10-31' },
    pins: [1139, 1146, 929, 1103, 1104, 1106, 142, 143, 202, 213, 1094, 1098, 1099, 209, 216, 139, 626, 642, 87, 1109, 1110, 1028, 1029, 594, 475, 1191]
  },
  {
    // Sits after Spooky so Spooky comes first on Tonight through October 31.
    id: 'dia-de-los-muertos',
    short: 'Día de los Muertos',
    name: 'Día de los Muertos',
    copy: 'Marigolds, music and family memories.',
    blurb: 'Stories about remembering the people we love, from a preschool special to Coco.',
    season: { from: '10-25', to: '11-02' },
    minFit: 2,
    pins: [1182, 1183, 111, 1133, 1094, 1194]
  },
  {
    id: 'baseball',
    short: 'Baseball',
    name: 'Baseball movies',
    copy: 'Sandlots, big leagues, one good dog.',
    blurb: 'Sandlots, big leagues and one very good dog, for baseball season.',
    season: { from: '03-20', to: '10-31' },
    pins: [71, 1067, 391, 410, 445, 583, 196, 1205]
  },
  {
    id: 'nothing-but-net',
    name: 'Nothing but net',
    copy: 'Big shots, buzzer beaters and one very good dog.',
    blurb: 'Basketball dreams, unlikely teams and players learning when to pass.',
    pins: [399, 869, 140, 187, 197, 1035, 1199]
  },
  {
    id: 'the-beautiful-game',
    name: 'The beautiful game',
    copy: 'Big goals and teams built from scratch.',
    blurb: 'Soccer stories about finding your position, your people and the back of the net.',
    pins: [1069, 664, 582, 43, 1081]
  },
  {
    id: 'friday-night-football',
    short: 'Football nights',
    name: 'Friday night football',
    copy: 'Hail Marys, hard hits and second chances.',
    blurb: 'Football teams and families learning what matters after the whistle.',
    pins: [1143, 581, 1068, 406, 424, 468, 132]
  },
  {
    id: 'ice-snow-and-underdogs',
    short: 'Ice & snow',
    name: 'Ice, snow and underdogs',
    copy: 'Skates, snowboards and one fast bobsled.',
    blurb: 'Cold-weather competitors finding their nerve on ice, snow and the bobsled track.',
    pins: [206, 851, 234, 162, 414, 387, 596, 1095, 1210]
  },
  {
    id: 'wheels-and-waves',
    name: 'Wheels and waves',
    copy: 'Boards, bikes and the courage to commit.',
    blurb: 'Surfers, skaters and racers chasing the next wave, turn or finish line.',
    pins: [1119, 158, 170, 162, 179, 194, 171, 1080, 1120, 1209, 1212]
  },
  {
    id: 'girls-in-the-game',
    name: 'Girls in the game',
    copy: 'They came to play—and changed the field.',
    blurb: 'Girls competing, leading and making room for the athletes coming next.',
    pins: [170, 187, 194, 206, 234, 1068, 1095, 63, 190]
  },
  {
    id: 'black-joy-family-big-dreams',
    short: 'Black joy',
    name: 'Black joy, family and big dreams',
    copy: 'Big imaginations, close families and room to shine.',
    blurb: 'Black children and families finding joy, chasing ambitions and showing up for one another.',
    pins: [299, 636, 49, 125, 214, 55, 869, 919, 468, 80, 93, 1195, 1198, 1200, 1213]
  },
  {
    id: 'latino-families-many-stories',
    short: 'Latino families',
    name: 'Latino families, many stories',
    copy: 'Music, adventure and families with plenty to say.',
    blurb: 'Latino children and families at the center of stories about home, memory, courage and celebration.',
    pins: [11, 111, 23, 122, 661, 133, 190, 567, 1091, 1147, 448, 1193, 1194, 1196]
  },
  {
    id: 'asian-families-many-stories',
    short: 'Asian families',
    name: 'Asian families, many stories',
    copy: 'Tradition, change and adventures of their own.',
    blurb: 'Distinct East, South, Southeast and Central Asian stories about family, heritage and growing into yourself.',
    pins: [15, 50, 248, 211, 51, 48, 286, 497, 1093, 1157, 63, 73, 1199]
  },
  {
    id: 'more-than-one-culture-at-home',
    short: 'More than one culture',
    name: 'More than one culture at home',
    copy: 'Families shaped by more than one story.',
    blurb: 'Multiracial, blended, adoptive and bicultural families finding their own way to belong together.',
    pins: [45, 1161, 457, 408, 636, 1162, 1193, 1196, 1199]
  },
  {
    id: 'families-with-pride',
    name: 'Families with pride',
    copy: 'Queer kids, parents and love, right at home.',
    blurb: 'Stories where LGBTQ+ kids, parents and partners are part of the family—not a punchline or a passing cameo.',
    pins: [306, 53, 252, 496, 1163, 1164]
  },
  {
    id: 'muslim-kids-at-the-center',
    short: 'Muslim kids',
    name: 'Muslim kids at the center',
    copy: 'Their homes, hopes and everyday courage.',
    blurb: 'Stories that put Muslim children, families and communities at the heart of the frame.',
    minFit: 1,
    pins: [1157, 1158, 84, 63, 1159, 1160]
  },
  {
    id: 'sibling-teams',
    name: 'Sibling teams',
    copy: 'Built-in teammates, occasional rivals.',
    blurb: 'Brothers and sisters who squabble, solve problems and show up for one another.',
    pins: [103, 305, 35, 292, 489, 11, 53, 294, 1184, 1191]
  },
  {
    id: 'girls-lead-the-way',
    short: 'Girls lead',
    name: 'Girls lead the way',
    copy: 'Brave choices and big ideas.',
    blurb: 'Girls taking the lead with courage, curiosity and their own point of view.',
    pins: [303, 286, 48, 491, 118, 125, 80, 104, 650, 93, 1184, 1185, 1194, 1195, 1198, 1200, 1208, 1213, 1214]
  },
  {
    id: 'food-family-and-the-table',
    short: 'Food & family',
    name: 'Food, family and the table',
    copy: 'Recipes, restaurants and room for everyone.',
    blurb: 'Food as craft, memory and the thing that brings a family back around the same table.',
    pins: [485, 299, 1071, 1002, 1031, 9, 104, 11]
  },
  {
    id: 'inventors-and-problem-solvers',
    short: 'Problem-solvers',
    name: 'Inventors and problem-solvers',
    copy: 'Tinker, test, fail, try again.',
    blurb: 'Curious kids and grown-ups who build, experiment and find another way through.',
    pins: [302, 297, 397, 382, 548, 646, 109, 93, 78, 53, 1189, 1196, 1202, 1204, 1207]
  },
  {
    id: 'around-the-world',
    name: 'Around the world',
    copy: 'A passport full of stories.',
    blurb: 'Family stories and adventures rooted in places and cultures around the world.',
    pins: [1, 111, 657, 637, 63, 80, 78, 72, 655, 1158, 104, 1193, 1194, 1205, 1210, 1215]
  },
  {
    id: 'good-teammates',
    name: 'Good teammates',
    copy: 'Winning, and losing, together.',
    blurb: 'Teams that win, and lose, by sticking together.',
    pins: [596, 851, 852, 1068, 1069, 71, 387, 406, 414, 448, 391, 1081, 187, 190, 169, 197, 214, 664, 1192, 1199, 1205, 1208, 1209, 1210, 1212]
  },
  {
    id: 'underdogs',
    short: 'Underdogs',
    name: 'Underdogs who never quit',
    copy: 'Long shots who keep on going.',
    blurb: 'Long shots who keep going when nobody expects them to.',
    pins: [1119, 523, 488, 1080, 1085, 435, 387, 1067, 410, 420, 414, 664, 571, 991, 96, 448, 445, 90, 424, 132, 1196, 1199, 1207]
  },
  {
    id: 'eighties',
    short: 'The ’80s',
    name: 'What Mom & Dad watched: the ’80s',
    copy: 'The ones you wore out on tape.',
    blurb: 'The movies a lot of parents grew up on.',
    pins: [36, 70, 88, 114, 119, 1, 621, 617, 279, 382, 379, 901, 872, 840, 841, 912, 913, 104, 866, 129, 1059, 90, 902, 906, 876]
  },
  {
    id: 'nineties',
    short: 'The ’90s',
    name: 'What Mom & Dad watched: the ’90s',
    copy: 'Big musicals and the first Toy Story.',
    blurb: 'Nineties classics, from Disney musicals to the Sandlot.',
    pins: [101, 281, 282, 4, 286, 110, 389, 116, 118, 1066, 71, 387, 1067, 596, 115, 624, 626, 929, 395, 397, 869, 606, 605, 594, 599, 602, 881, 1203, 1207]
  },
  {
    id: 'summer-break',
    name: 'Summer break',
    copy: 'Beaches, camps and long, lazy days.',
    blurb: 'Beaches, camps, road trips and long summer days.',
    season: { from: '06-01', to: '08-31' },
    pins: [12, 1, 9, 71, 632, 1105, 292, 303, 1119, 606, 150, 156, 603, 578, 654, 407, 227, 561, 1091, 1077, 1126, 92]
  },
  {
    id: 'back-to-school',
    name: 'Back to school',
    copy: 'New classrooms and first-day jitters.',
    blurb: 'New classrooms, new kids and first days, for the start of the school year.',
    season: { from: '08-15', to: '09-15' },
    pins: [10, 492, 118, 1010, 974, 549, 955, 543, 466, 1017, 160, 214, 155, 125, 85, 140, 98, 1001, 498, 89]
  },
  {
    id: 'studio-ghibli',
    short: 'Studio Ghibli',
    name: 'Studio Ghibli, where to start',
    copy: 'Totoro first, then wander on.',
    blurb: 'The Japanese studio behind Totoro, in a good order to watch it.',
    pins: [1, 104, 9, 831, 820, 829, 121, 827, 828, 832, 825, 835, 833, 823, 824, 836, 834, 837, 830, 822, 826]
  },
  {
    id: 'dogs',
    name: 'Dog movies',
    copy: 'Good dogs, lost dogs, sled dogs.',
    blurb: 'Good dogs, lost dogs, sled dogs and one dog who plays basketball.',
    pins: [266, 268, 389, 298, 936, 399, 1079, 74, 395, 597, 422, 408, 465, 278, 380, 1051, 427, 555, 339, 423, 157, 464, 394, 1153, 442, 973, 915, 275, 338, 1192, 1208, 1209]
  },
  {
    id: 'read-the-book-first',
    name: 'Read the book first',
    copy: 'Read it at bedtime, watch it Friday.',
    blurb: 'Films of children’s books, from picture books to chapter books, to read before you watch.',
    pins: [1132, 1144, 1018, 1071, 6, 5, 641, 994, 396, 113, 67, 118, 116, 542, 1010, 974, 531, 74, 47, 14, 39, 870, 92, 425, 98, 57, 105, 1014, 1016, 1017, 1021, 70, 30, 1190, 1194, 1206, 1207]
  },
  {
    id: 'award-winners',
    short: 'Oscar winners',
    name: 'Oscar winners: Best Animated Feature',
    copy: 'Every Best Animated winner we have.',
    blurb: 'Every winner of the Academy Award for Best Animated Feature that is in the catalog, newest first.',
    pins: [673, 837, 11, 49, 495, 133, 111, 13, 10, 302, 103, 491, 557, 494, 22, 109, 485, 968, 508, 489, 2, 121, 502]
  },
  {
    id: 'funny-for-grown-ups-too',
    short: 'Funny for grown-ups',
    name: 'Funny for grown-ups too',
    copy: 'Jokes for them, and jokes for you.',
    blurb: 'Comedies with jokes for the kids and a second layer of jokes for the adults on the couch.',
    pins: [120, 5, 310, 4, 439, 106, 290, 18, 502, 513, 1071, 524, 47, 762, 53, 537, 489, 13, 133, 70, 1086, 1203]
  },
  {
    id: 'made-by-hand',
    name: 'Made by hand',
    copy: 'Puppets moved one frame at a time.',
    blurb: 'Stop-motion films, where every puppet and set was moved by hand one frame at a time.',
    pins: [7, 665, 1089, 102, 508, 1121, 664, 540, 113, 396, 672, 1145, 626, 69, 442, 650, 971, 972, 973, 1130]
  },
  {
    id: 'real-life-adventures',
    short: 'Real-life adventures',
    name: 'Real-life adventures',
    copy: 'Penguins, polar bears, true stories.',
    blurb: 'True stories and nature documentaries, from penguins and polar bears to a girl who hunts with an eagle.',
    pins: [21, 471, 470, 446, 455, 478, 16, 17, 66, 61, 63, 58, 86, 85, 60, 83, 1186, 1188, 1194, 1195, 1196, 1197, 1198, 1200, 1204, 1205, 1207, 1210, 1213]
  },
  {
    id: 'sing-along-musicals',
    name: 'Sing-along musicals',
    copy: 'Songs you will hum all week.',
    blurb: 'Big, hummable songs the whole family ends up singing, from Disney favorites to the classic stage musicals.',
    pins: [270, 101, 103, 300, 286, 19, 29, 30, 282, 279, 303, 11, 67, 612, 28, 615, 299, 285, 353, 1001, 1037, 385, 1201, 1206, 1215, 1216]
  }
]);


// The Lists tab groups the year-round lists onto themed shelves. Seasonal
// lists sit in "In season" while in season and "Coming back later" when not,
// so they don't belong on a shelf. Every year-round list must be on exactly
// one shelf (validate-data.mjs checks).
const MOVIE_LIST_SHELVES = Object.freeze([
  { id: 'story-time', name: 'Story time', aside: 'Books, puppets and songs', lists: ['read-the-book-first', 'studio-ghibli', 'made-by-hand', 'sing-along-musicals'] },
  { id: 'families-and-neighbors', name: 'Families and neighbors', aside: 'Home, identity and the wider world', lists: ['muslim-kids-at-the-center', 'black-joy-family-big-dreams', 'latino-families-many-stories', 'asian-families-many-stories', 'more-than-one-culture-at-home', 'families-with-pride', 'sibling-teams', 'food-family-and-the-table', 'around-the-world'] },
  { id: 'game-day', name: 'Game day', aside: 'Courts, fields, ice and open water', lists: ['nothing-but-net', 'the-beautiful-game', 'friday-night-football', 'ice-snow-and-underdogs', 'wheels-and-waves', 'girls-in-the-game'] },
  { id: 'brave-and-curious', name: 'Brave and curious', aside: 'Leaders, makers and bright ideas', lists: ['girls-lead-the-way', 'inventors-and-problem-solvers'] },
  { id: 'cheer-them-on', name: 'Cheer them on', aside: 'Teams, long shots, good dogs', lists: ['good-teammates', 'underdogs', 'dogs', 'real-life-adventures'] },
  { id: 'from-the-grown-ups', name: 'From the grown-ups', aside: 'The ones you remember', lists: ['eighties', 'nineties', 'funny-for-grown-ups-too', 'award-winners'] }
]);
// One small two-tone icon per list (32x32, currentColor plus var(--icon-tint)),
// drawn for this app. Shown on the Shelf tile and the Tonight season card.
const LIST_ICONS = Object.freeze({
  "passover": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\" width=\"32\" height=\"32\" aria-hidden=\"true\" focusable=\"false\"><rect fill=\"var(--icon-tint, #ECC6B3)\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\" stroke-linecap=\"round\" x=\"3.5\" y=\"13.5\" width=\"15\" height=\"14.5\" rx=\"1.5\"/><path fill=\"currentColor\" d=\"M7 17.2h1.6v1.6H7zM11.2 17.2h1.6v1.6h-1.6zM15.4 17.2H17v1.6h-1.6zM7 22h1.6v1.6H7zM11.2 22h1.6v1.6h-1.6zM15.4 22H17v1.6h-1.6z\"/><path fill=\"var(--icon-tint, #ECC6B3)\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\" stroke-linecap=\"round\" d=\"M19.5 4.5h8.5l-.8 6.2a3.5 3.5 0 0 1-6.9 0z\"/><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\" stroke-linecap=\"round\" d=\"M23.75 14.2v12.8M20.3 27.5h6.9\"/></svg>",
  "easter": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\" width=\"32\" height=\"32\" aria-hidden=\"true\" focusable=\"false\"><path fill=\"var(--icon-tint, #ECC6B3)\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\" stroke-linecap=\"round\" d=\"M16 3.5c5.4 0 9.5 8.2 9.5 14.2a9.5 9.5 0 0 1-19 0C6.5 11.7 10.6 3.5 16 3.5z\"/><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.75\" stroke-linejoin=\"round\" stroke-linecap=\"round\" d=\"M7 15.8l3-2.6 3 2.6 3-2.6 3 2.6 3-2.6 3 2.6\"/><circle fill=\"currentColor\" cx=\"12\" cy=\"21.8\" r=\"1.4\"/><circle fill=\"currentColor\" cx=\"16\" cy=\"23.2\" r=\"1.4\"/><circle fill=\"currentColor\" cx=\"20\" cy=\"21.8\" r=\"1.4\"/><circle fill=\"currentColor\" cx=\"16\" cy=\"9.2\" r=\"1.3\"/></svg>",
  "thanksgiving": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\" width=\"32\" height=\"32\" aria-hidden=\"true\" focusable=\"false\"><path fill=\"var(--icon-tint, #ECC6B3)\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\" stroke-linecap=\"round\" d=\"M3.5 17.5C5 11.8 10 8.5 16 8.5s11 3.3 12.5 9z\"/><path fill=\"currentColor\" d=\"M3 17h26a1 1 0 0 1 1 1.2l-1.7 7.2a2 2 0 0 1-2 1.6H5.7a2 2 0 0 1-2-1.6L2 18.2A1 1 0 0 1 3 17z\"/><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.75\" stroke-linejoin=\"round\" stroke-linecap=\"round\" d=\"M10 15.5l2.6-4.4M15 15.5l2.6-5.4M20 15.5l2.6-3.8\"/><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.75\" stroke-linejoin=\"round\" stroke-linecap=\"round\" d=\"M13 3.2q-1.4 1.5 0 3M18 2.6q-1.4 1.5 0 3\"/></svg>",
  "dia-de-los-muertos": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\" width=\"32\" height=\"32\" aria-hidden=\"true\" focusable=\"false\"><circle fill=\"var(--icon-tint, #ECC6B3)\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\" stroke-linecap=\"round\" cx=\"11\" cy=\"11\" r=\"7.5\"/><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.75\" stroke-linejoin=\"round\" stroke-linecap=\"round\" d=\"M11 3.8v3M11 15.2v3M3.8 11h3M15.2 11h3M5.9 5.9 8 8M14 14l2.1 2.1M16.1 5.9 14 8M8 14l-2.1 2.1\"/><circle fill=\"currentColor\" cx=\"11\" cy=\"11\" r=\"2.6\"/><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\" stroke-linecap=\"round\" d=\"M11 18.5v9.5M11 24.5c-2.6-.2-4.4-1.6-5-3.8 2.4-.2 4.2.9 5 3.8z\"/><rect fill=\"var(--icon-tint, #ECC6B3)\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\" stroke-linecap=\"round\" x=\"19.5\" y=\"15.5\" width=\"8\" height=\"12.5\" rx=\"1.2\"/><path fill=\"currentColor\" d=\"M23.5 5.6c2.1 2.6 2.7 4.4 2.7 5.6a2.7 2.7 0 0 1-5.4 0c0-1.2.6-3 2.7-5.6z\"/></svg>",
  "christmas": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\" width=\"32\" height=\"32\" aria-hidden=\"true\" focusable=\"false\"><path fill=\"var(--icon-tint, #ECC6B3)\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\" stroke-linecap=\"round\" d=\"M16 3.5 22 12h-3l6 10H7l6-10h-3z\"/><rect fill=\"currentColor\" x=\"13.5\" y=\"22\" width=\"5\" height=\"5.5\" rx=\"1\"/><circle fill=\"currentColor\" cx=\"13.2\" cy=\"18.2\" r=\"1.6\"/><circle fill=\"currentColor\" cx=\"19\" cy=\"15.6\" r=\"1.6\"/><circle fill=\"currentColor\" cx=\"16\" cy=\"9.6\" r=\"1.4\"/></svg>",
  "snow-day": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\" width=\"32\" height=\"32\" aria-hidden=\"true\" focusable=\"false\"><path fill=\"var(--icon-tint, #ECC6B3)\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\" stroke-linecap=\"round\" d=\"M11.6 22.5V18.2C8.6 17.8 6.3 15.2 6.7 12.4c.3-1.7 2.3-2 3.4-.8l1.5 1.7v-2.8a5.6 5.6 0 0 1 11.2 0v12z\"/><rect fill=\"currentColor\" x=\"10.2\" y=\"22\" width=\"14\" height=\"5.8\" rx=\"1.6\"/><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.75\" stroke-linejoin=\"round\" stroke-linecap=\"round\" d=\"M5.2 2.6v5.2M2.95 3.9l4.5 2.6M2.95 6.5l4.5-2.6M27.2 7v5.2M24.95 8.3l4.5 2.6M24.95 10.9l4.5-2.6\"/></svg>",
  "spooky-not-too-scary": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\" width=\"32\" height=\"32\" aria-hidden=\"true\" focusable=\"false\"><path fill=\"var(--icon-tint, #ECC6B3)\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\" stroke-linecap=\"round\" d=\"M7.5 27.5V14.5a8.5 8.5 0 0 1 17 0v13l-2.83-2.2-2.84 2.2-2.83-2.2-2.83 2.2-2.84-2.2z\"/><ellipse fill=\"currentColor\" cx=\"12.7\" cy=\"14.8\" rx=\"1.5\" ry=\"2\"/><ellipse fill=\"currentColor\" cx=\"19.3\" cy=\"14.8\" rx=\"1.5\" ry=\"2\"/><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.75\" stroke-linejoin=\"round\" stroke-linecap=\"round\" d=\"M14.3 19.4q1.7 1.5 3.4 0\"/></svg>",
  "baseball": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\" width=\"32\" height=\"32\" aria-hidden=\"true\" focusable=\"false\"><circle fill=\"var(--icon-tint, #ECC6B3)\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\" stroke-linecap=\"round\" cx=\"16\" cy=\"16\" r=\"11.5\"/><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.75\" stroke-linejoin=\"round\" stroke-linecap=\"round\" d=\"M9.4 6.6c3.8 4.6 3.8 14.2 0 18.8M22.6 6.6c-3.8 4.6-3.8 14.2 0 18.8\"/><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.75\" stroke-linejoin=\"round\" stroke-linecap=\"round\" d=\"M9.6 10.6l2.6-1.1M10.6 14.6h2.8M10.6 17.4h2.8M9.6 21.4l2.6 1.1M22.4 10.6l-2.6-1.1M21.4 14.6h-2.8M21.4 17.4h-2.8M22.4 21.4l-2.6 1.1\"/></svg>",
  "good-teammates": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\" width=\"32\" height=\"32\" aria-hidden=\"true\" focusable=\"false\"><path fill=\"var(--icon-tint, #ECC6B3)\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\" stroke-linecap=\"round\" d=\"M14.6 28v-2.6a6.3 6.3 0 0 1 12.6 0V28z\"/><circle fill=\"var(--icon-tint, #ECC6B3)\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\" stroke-linecap=\"round\" cx=\"20.9\" cy=\"13.8\" r=\"3.3\"/><path fill=\"var(--icon-tint, #ECC6B3)\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\" stroke-linecap=\"round\" d=\"M4.8 28v-2.6a6.3 6.3 0 0 1 12.6 0V28z\"/><circle fill=\"var(--icon-tint, #ECC6B3)\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\" stroke-linecap=\"round\" cx=\"11.1\" cy=\"13.8\" r=\"3.3\"/><path fill=\"currentColor\" d=\"M16 3.6c-.8-1.5-3.2-1.2-3.2.6 0 1.4 1.8 2.5 3.2 3.5 1.4-1 3.2-2.1 3.2-3.5 0-1.8-2.4-2.1-3.2-.6z\"/></svg>",
  "underdogs": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\" width=\"32\" height=\"32\" aria-hidden=\"true\" focusable=\"false\"><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\" stroke-linecap=\"round\" d=\"M16 22.5V12.5\"/><path fill=\"var(--icon-tint, #ECC6B3)\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\" stroke-linecap=\"round\" d=\"M16 16.5c-4.2 0-7.6-2.2-8.2-6.6 4.4-.4 7.8 1.8 8.2 6.6z\"/><path fill=\"var(--icon-tint, #ECC6B3)\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\" stroke-linecap=\"round\" d=\"M16 13c.4-4.6 3.8-7.6 9-7.6-.2 4.6-3.8 7.4-9 7.6z\"/><path fill=\"var(--icon-tint, #ECC6B3)\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\" stroke-linecap=\"round\" d=\"M3 22.5h9.8l2 3 1.2-2.2 1.2 2.2 2-3H29v5.5H3z\"/><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.75\" stroke-linejoin=\"round\" stroke-linecap=\"round\" d=\"M10.6 20.4 8.6 19.4M21.4 20.4l2-1\"/></svg>",
  "eighties": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\" width=\"32\" height=\"32\" aria-hidden=\"true\" focusable=\"false\"><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\" stroke-linecap=\"round\" d=\"M10 11V7.5h12V11\"/><rect fill=\"var(--icon-tint, #ECC6B3)\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\" stroke-linecap=\"round\" x=\"2.5\" y=\"11\" width=\"27\" height=\"15.5\" rx=\"3\"/><circle fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.75\" stroke-linejoin=\"round\" stroke-linecap=\"round\" cx=\"9\" cy=\"19.5\" r=\"4\"/><circle fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.75\" stroke-linejoin=\"round\" stroke-linecap=\"round\" cx=\"23\" cy=\"19.5\" r=\"4\"/><path fill=\"currentColor\" d=\"M9 17.7a1.8 1.8 0 1 0 .01 0zM23 17.7a1.8 1.8 0 1 0 .01 0z\"/><rect fill=\"currentColor\" x=\"14\" y=\"14\" width=\"4\" height=\"4.5\" rx=\"0.8\"/><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.75\" stroke-linejoin=\"round\" stroke-linecap=\"round\" d=\"M14.3 22.5h3.4\"/></svg>",
  "nineties": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\" width=\"32\" height=\"32\" aria-hidden=\"true\" focusable=\"false\"><rect fill=\"var(--icon-tint, #ECC6B3)\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\" stroke-linecap=\"round\" x=\"7.5\" y=\"2.5\" width=\"17\" height=\"27\" rx=\"3\"/><rect fill=\"currentColor\" x=\"10.5\" y=\"5.5\" width=\"11\" height=\"9\" rx=\"1.5\"/><path fill=\"currentColor\" d=\"M11.4 19.2h1.9v-1.9h1.8v1.9H17v1.8h-1.9v1.9h-1.8V21h-1.9z\" transform=\"translate(-0.6 0)\"/><circle fill=\"currentColor\" cx=\"20.6\" cy=\"18.8\" r=\"1.4\"/><circle fill=\"currentColor\" cx=\"18.6\" cy=\"22\" r=\"1.4\"/><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.75\" stroke-linejoin=\"round\" stroke-linecap=\"round\" d=\"M14 26.2h1.6M17.4 26.2H19\"/></svg>",
  "summer-break": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\" width=\"32\" height=\"32\" aria-hidden=\"true\" focusable=\"false\"><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\" stroke-linecap=\"round\" d=\"M16 1.8v2.4M16 27.8v2.4M1.8 16h2.4M27.8 16h2.4M6 6l1.7 1.7M24.3 24.3 26 26M26 6l-1.7 1.7M7.7 24.3 6 26\"/><circle fill=\"var(--icon-tint, #ECC6B3)\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\" stroke-linecap=\"round\" cx=\"16\" cy=\"16\" r=\"8.6\"/><path fill=\"currentColor\" d=\"M10.2 13.6h5v1.9a2.5 2.5 0 0 1-5 0zM16.8 13.6h5v1.9a2.5 2.5 0 0 1-5 0z\"/><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.75\" stroke-linejoin=\"round\" stroke-linecap=\"round\" d=\"M15 14.2h2M13 20q3 2.2 6 0\"/></svg>",
  "back-to-school": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\" width=\"32\" height=\"32\" aria-hidden=\"true\" focusable=\"false\"><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\" stroke-linecap=\"round\" d=\"M12.5 7.5V6a3.5 3.5 0 0 1 7 0v1.5\"/><rect fill=\"var(--icon-tint, #ECC6B3)\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\" stroke-linecap=\"round\" x=\"6.5\" y=\"7.5\" width=\"19\" height=\"21\" rx=\"6\"/><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.75\" stroke-linejoin=\"round\" stroke-linecap=\"round\" d=\"M6.8 14.2q9.2 3.4 18.4 0\"/><rect fill=\"currentColor\" x=\"10.5\" y=\"18.5\" width=\"11\" height=\"7.5\" rx=\"2\"/><path fill=\"currentColor\" d=\"M14.6 17.6h2.8v2.2h-2.8z\"/></svg>",
  "studio-ghibli": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\" width=\"32\" height=\"32\" aria-hidden=\"true\" focusable=\"false\"><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\" stroke-linecap=\"round\" d=\"M16 5V2.8M16 16v8.6a2.3 2.3 0 0 1-4.6 0\"/><path fill=\"var(--icon-tint, #ECC6B3)\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\" stroke-linecap=\"round\" d=\"M3.8 16C3.8 9.5 9.3 5 16 5s12.2 4.5 12.2 11c-2-1.5-4.1-1.5-6.1 0-2-1.5-4.1-1.5-6.1 0-2-1.5-4.1-1.5-6.1 0-2-1.5-4.1-1.5-6.1 0z\"/><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.75\" stroke-linejoin=\"round\" stroke-linecap=\"round\" d=\"M16 5c-2.6 2.6-3.6 6.4-3.4 10.4M16 5c2.6 2.6 3.6 6.4 3.4 10.4\"/><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.75\" stroke-linejoin=\"round\" stroke-linecap=\"round\" d=\"M6 20.5l-1 2.6M23.6 20.5l-1 2.6M26.6 24.5l-1 2.6\"/></svg>",
  "dogs": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\" width=\"32\" height=\"32\" aria-hidden=\"true\" focusable=\"false\"><circle fill=\"var(--icon-tint, #ECC6B3)\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\" stroke-linecap=\"round\" cx=\"16\" cy=\"17.5\" r=\"9.5\"/><path fill=\"currentColor\" d=\"M10 8.6C5.2 7.6 2.6 12 3.4 18.4c.2 1.6 1.7 2.1 2.7 1C8.4 17 9.6 13.4 10 8.6zM22 8.6c4.8-1 7.4 3.4 6.6 9.8-.2 1.6-1.7 2.1-2.7 1C23.6 17 22.4 13.4 22 8.6z\"/><circle fill=\"currentColor\" cx=\"12.6\" cy=\"16.2\" r=\"1.45\"/><circle fill=\"currentColor\" cx=\"19.4\" cy=\"16.2\" r=\"1.45\"/><path fill=\"currentColor\" d=\"M13.8 20.2h4.4c.4 0 .6.4.4.7l-1.7 1.9c-.5.5-1.3.5-1.8 0l-1.7-1.9c-.2-.3 0-.7.4-.7z\"/><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.75\" stroke-linejoin=\"round\" stroke-linecap=\"round\" d=\"M16 22.6v1.4c-.8 1.2-2.4 1.2-3 .2M16 24c.8 1.2 2.4 1.2 3 .2\"/></svg>",
  "read-the-book-first": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\" width=\"32\" height=\"32\" aria-hidden=\"true\" focusable=\"false\"><path fill=\"var(--icon-tint, #ECC6B3)\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\" stroke-linecap=\"round\" d=\"M16 9.2C12.4 6.6 7.6 6.2 3 7.2v18c4.6-1 9.4-.6 13 2z\"/><path fill=\"var(--icon-tint, #ECC6B3)\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\" stroke-linecap=\"round\" d=\"M16 9.2c3.6-2.6 8.4-3 13-2v18c-4.6-1-9.4-.6-13 2z\"/><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.75\" stroke-linejoin=\"round\" stroke-linecap=\"round\" d=\"M6.4 12.4c2.2-.3 4.4-.1 6.2.6M6.4 16.4c2.2-.3 4.4-.1 6.2.6M6.4 20.4c2.2-.3 4.4-.1 6.2.6M19.4 17c1.8-.7 4-.9 6.2-.6M19.4 21c1.8-.7 4-.9 6.2-.6\"/><path fill=\"currentColor\" d=\"M20.5 6.6h4.2v8.6l-2.1-1.7-2.1 1.7z\"/></svg>",
  "award-winners": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\" width=\"32\" height=\"32\" aria-hidden=\"true\" focusable=\"false\"><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\" stroke-linecap=\"round\" d=\"M10.2 7.5H6.5c0 4 1.8 6.2 4.8 6.6M21.8 7.5h3.7c0 4-1.8 6.2-4.8 6.6\"/><path fill=\"var(--icon-tint, #ECC6B3)\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\" stroke-linecap=\"round\" d=\"M10 4h12v7.5a6 6 0 0 1-12 0z\"/><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\" stroke-linecap=\"round\" d=\"M16 17.5v4.2\"/><rect fill=\"currentColor\" x=\"10\" y=\"22\" width=\"12\" height=\"5.5\" rx=\"1.5\"/><path fill=\"currentColor\" d=\"M16 6.4l1.05 2.13 2.35.34-1.7 1.66.4 2.34L16 11.77l-2.1 1.1.4-2.34-1.7-1.66 2.35-.34z\"/></svg>",
  "funny-for-grown-ups-too": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\" width=\"32\" height=\"32\" aria-hidden=\"true\" focusable=\"false\"><circle fill=\"var(--icon-tint, #ECC6B3)\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\" stroke-linecap=\"round\" cx=\"10.4\" cy=\"9.8\" r=\"3.4\"/><circle fill=\"var(--icon-tint, #ECC6B3)\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\" stroke-linecap=\"round\" cx=\"21.6\" cy=\"9.8\" r=\"3.4\"/><circle fill=\"var(--icon-tint, #ECC6B3)\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\" stroke-linecap=\"round\" cx=\"16\" cy=\"7.2\" r=\"3.8\"/><path fill=\"var(--icon-tint, #ECC6B3)\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\" stroke-linecap=\"round\" d=\"M7.5 13h17l-2.2 15H9.7z\"/><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.75\" stroke-linejoin=\"round\" stroke-linecap=\"round\" d=\"M11.8 18.4q1.3-1.6 2.6 0M17.6 18.4q1.3-1.6 2.6 0\"/><path fill=\"currentColor\" d=\"M12.2 20.8h7.6a3.8 3.8 0 0 1-7.6 0z\"/></svg>",
  "made-by-hand": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\" width=\"32\" height=\"32\" aria-hidden=\"true\" focusable=\"false\"><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\" stroke-linecap=\"round\" d=\"M3 8.5V3h5.5M23.5 3H29v5.5M29 23.5V29h-5.5M8.5 29H3v-5.5\"/><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\" stroke-linecap=\"round\" d=\"M20.6 18.6l4-3.2\"/><path fill=\"var(--icon-tint, #ECC6B3)\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\" stroke-linecap=\"round\" d=\"M9.2 26.4c-.6-4.4.8-8.2 3.2-9.9-1.6-1.4-1.8-4.3 0-6s5-1.8 6.6 0 1.6 4.6 0 6c2.4 1.7 3.8 5.5 3.2 9.9z\"/><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.75\" stroke-linejoin=\"round\" stroke-linecap=\"round\" d=\"M14.4 15.3q1.3 1 2.6 0\"/><path fill=\"currentColor\" d=\"M14.2 12.8a.95.95 0 1 0 .01 0zM17.2 12.8a.95.95 0 1 0 .01 0z\"/></svg>",
  "real-life-adventures": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\" width=\"32\" height=\"32\" aria-hidden=\"true\" focusable=\"false\"><rect fill=\"var(--icon-tint, #ECC6B3)\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\" stroke-linecap=\"round\" x=\"5\" y=\"6\" width=\"9\" height=\"13\" rx=\"2.5\"/><rect fill=\"var(--icon-tint, #ECC6B3)\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\" stroke-linecap=\"round\" x=\"18\" y=\"6\" width=\"9\" height=\"13\" rx=\"2.5\"/><rect fill=\"currentColor\" x=\"13\" y=\"10\" width=\"6\" height=\"5\" rx=\"1\"/><circle fill=\"var(--icon-tint, #ECC6B3)\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\" stroke-linecap=\"round\" cx=\"9.5\" cy=\"21\" r=\"6\"/><circle fill=\"var(--icon-tint, #ECC6B3)\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\" stroke-linecap=\"round\" cx=\"22.5\" cy=\"21\" r=\"6\"/><path fill=\"currentColor\" d=\"M8 18.4a2.2 2.2 0 1 0 .01 0zM21 18.4a2.2 2.2 0 1 0 .01 0z\"/></svg>",
  "sing-along-musicals": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\" width=\"32\" height=\"32\" aria-hidden=\"true\" focusable=\"false\"><path fill=\"currentColor\" d=\"M15.1 15.2l3.6 3.6-9.4 9a1.9 1.9 0 0 1-2.7-2.7z\"/><circle fill=\"var(--icon-tint, #ECC6B3)\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\" stroke-linecap=\"round\" cx=\"20.6\" cy=\"11.4\" r=\"6\"/><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.75\" stroke-linejoin=\"round\" stroke-linecap=\"round\" d=\"M16.4 7.2l8.4 8.4\"/><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\" stroke-linecap=\"round\" d=\"M5.2 13.5V4.6l6-1.4V12\"/><path fill=\"currentColor\" d=\"M5.2 13.5a1.9 1.5 -20 1 1-3.6 1.2 1.9 1.5 -20 1 1 3.6-1.2zM11.2 12a1.9 1.5 -20 1 1-3.6 1.2 1.9 1.5 -20 1 1 3.6-1.2z\"/></svg>",
  "hanukkah": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\" width=\"32\" height=\"32\" aria-hidden=\"true\" focusable=\"false\"><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.75\" stroke-linejoin=\"round\" stroke-linecap=\"round\" d=\"M4 15.5V12M7 15.5V12M10 15.5V12M13 15.5V12M16 15.5V8.5M19 15.5V12M22 15.5V12M25 15.5V12M28 15.5V12\"/><path fill=\"currentColor\" d=\"M4 8c.75.9 1.1 1.6 1.1 2.2a1.1 1.1 0 0 1-2.2 0c0-.6.35-1.3 1.1-2.2zM7 8c.75.9 1.1 1.6 1.1 2.2a1.1 1.1 0 0 1-2.2 0c0-.6.35-1.3 1.1-2.2zM10 8c.75.9 1.1 1.6 1.1 2.2a1.1 1.1 0 0 1-2.2 0c0-.6.35-1.3 1.1-2.2zM13 8c.75.9 1.1 1.6 1.1 2.2a1.1 1.1 0 0 1-2.2 0c0-.6.35-1.3 1.1-2.2zM16 4.5c.75.9 1.1 1.6 1.1 2.2a1.1 1.1 0 0 1-2.2 0c0-.6.35-1.3 1.1-2.2zM19 8c.75.9 1.1 1.6 1.1 2.2a1.1 1.1 0 0 1-2.2 0c0-.6.35-1.3 1.1-2.2zM22 8c.75.9 1.1 1.6 1.1 2.2a1.1 1.1 0 0 1-2.2 0c0-.6.35-1.3 1.1-2.2zM25 8c.75.9 1.1 1.6 1.1 2.2a1.1 1.1 0 0 1-2.2 0c0-.6.35-1.3 1.1-2.2zM28 8c.75.9 1.1 1.6 1.1 2.2a1.1 1.1 0 0 1-2.2 0c0-.6.35-1.3 1.1-2.2z\"/><rect fill=\"var(--icon-tint, #ECC6B3)\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\" stroke-linecap=\"round\" x=\"3\" y=\"15.5\" width=\"26\" height=\"3.6\" rx=\"1.8\"/><path fill=\"currentColor\" d=\"M14.6 19h2.8v5.4h-2.8z\"/><path fill=\"var(--icon-tint, #ECC6B3)\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\" stroke-linecap=\"round\" d=\"M9 28.5c0-2.9 3.1-4.6 7-4.6s7 1.7 7 4.6z\"/></svg>",
  "ramadan-eid": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\" width=\"32\" height=\"32\" aria-hidden=\"true\"><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" d=\"M12 7V4h8v3M16 4V2\"/><path fill=\"var(--icon-tint, #ECC6B3)\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linejoin=\"round\" d=\"m9 10 3-3h8l3 3-2 19H11z\"/><path fill=\"currentColor\" d=\"M16 13a5.5 5.5 0 0 0-3.2 10 5 5 0 1 1 5.8-8.1A5.5 5.5 0 0 0 16 13zM22 13l.7 1.4 1.6.2-1.2 1.1.3 1.6-1.4-.8-1.4.8.3-1.6-1.2-1.1 1.6-.2z\"/></svg>",
  "muslim-kids-at-the-center": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\" width=\"32\" height=\"32\" aria-hidden=\"true\"><path fill=\"var(--icon-tint, #ECC6B3)\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\" d=\"M16 14c-4-3-8-3-12-2v14c4-1 8-1 12 2zM16 14c4-3 8-3 12-2v14c-4-1-8-1-12 2z\"/><path fill=\"currentColor\" d=\"m16 3 2 3 3.6-.4-.4 3.6 3 2-3 2 .4 3.6-3.6-.4-2 3-2-3-3.6.4.4-3.6-3-2 3-2-.4-3.6 3.6.4z\"/><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" d=\"M8 17h5M19 17h5M8 21h4M20 21h4\"/></svg>",
  "sibling-teams": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\" width=\"32\" height=\"32\" aria-hidden=\"true\"><path fill=\"var(--icon-tint, #ECC6B3)\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\" d=\"M4 5h11v14L9.5 16 4 19zM17 5h11v14l-5.5-3-5.5 3z\"/><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M8 25c2-3 5-3 8 0 3-3 6-3 8 0M11 22l5 5 5-5\"/><circle fill=\"var(--icon-3, #BFDCEB)\" cx=\"9.5\" cy=\"10.5\" r=\"2\"/><circle fill=\"var(--icon-3, #BFDCEB)\" cx=\"22.5\" cy=\"10.5\" r=\"2\"/></svg>",
  "girls-lead-the-way": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\" width=\"32\" height=\"32\" aria-hidden=\"true\"><circle fill=\"var(--icon-tint, #ECC6B3)\" stroke=\"currentColor\" stroke-width=\"2\" cx=\"14\" cy=\"17\" r=\"11\"/><path fill=\"var(--icon-3, #BFDCEB)\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linejoin=\"round\" d=\"m16 8-4 7-6 4 7 1 2 7 3-7 7-4-7-1z\"/><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" d=\"M25 4v12\"/><path fill=\"var(--icon-2, #F2A36B)\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linejoin=\"round\" d=\"M25 5h5l-2 3 2 3h-5z\"/></svg>",
  "food-family-and-the-table": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\" width=\"32\" height=\"32\" aria-hidden=\"true\"><ellipse fill=\"var(--icon-tint, #ECC6B3)\" stroke=\"currentColor\" stroke-width=\"2\" cx=\"16\" cy=\"19\" rx=\"12\" ry=\"6\"/><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" d=\"M7 24v5M25 24v5M4 19H1v7h4M28 19h3v7h-4\"/><path fill=\"var(--icon-3, #F3D28A)\" stroke=\"currentColor\" stroke-width=\"1.8\" d=\"M10 18c1-5 11-5 12 0z\"/><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" d=\"M16 13v-2M10 8c0-2 2-2 2-5M18 8c0-2 2-2 2-5\"/></svg>",
  "inventors-and-problem-solvers": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\" width=\"32\" height=\"32\" aria-hidden=\"true\"><path fill=\"var(--icon-tint, #ECC6B3)\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\" d=\"M5 13a9 9 0 1 1 15 7v3H10v-3a9 9 0 0 1-5-7z\"/><path fill=\"var(--icon-3, #C9B7E8)\" stroke=\"currentColor\" stroke-width=\"1.7\" d=\"m24 18 2-2 2 2-1 3 3 1v3l-3 1 1 3-2 2-3-2-2 2-2-2 1-3-3-1v-3l3-1-1-3 2-2 2 2z\"/><circle fill=\"var(--icon-2, #8EBFE6)\" stroke=\"currentColor\" stroke-width=\"1.5\" cx=\"24\" cy=\"24\" r=\"2.5\"/><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" d=\"M10 27h8M11 23v-7l3 2 3-2v7\"/></svg>",
  "around-the-world": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\" width=\"32\" height=\"32\" aria-hidden=\"true\"><rect fill=\"var(--icon-tint, #ECC6B3)\" stroke=\"currentColor\" stroke-width=\"2\" x=\"5\" y=\"3\" width=\"22\" height=\"26\" rx=\"3\"/><circle fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" cx=\"16\" cy=\"15\" r=\"7\"/><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" d=\"M9 15h14M16 8c3 3 3 11 0 14M16 8c-3 3-3 11 0 14M10 25h8\"/></svg>",
  "nothing-but-net": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\" width=\"32\" height=\"32\" aria-hidden=\"true\"><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M5 5h16v11H7M7 17h16M9 18l2 10h8l2-10M11 21h10M12 25h8\"/><circle fill=\"var(--icon-tint, #ECC6B3)\" stroke=\"currentColor\" stroke-width=\"2\" cx=\"24\" cy=\"8\" r=\"5\"/><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" d=\"M19 8h10M24 3c-2 2-2 8 0 10M24 3c2 2 2 8 0 10\"/></svg>",
  "the-beautiful-game": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\" width=\"32\" height=\"32\" aria-hidden=\"true\"><path fill=\"var(--icon-tint, #ECC6B3)\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\" d=\"M4 18c7 0 10-4 13-10l5 3-3 7 6 3c1 1 1 4-2 5H8c-3 0-5-3-4-8z\"/><circle fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" cx=\"25\" cy=\"9\" r=\"5\"/><path fill=\"currentColor\" d=\"m25 6 2 1.5-.8 2.5h-2.4L23 7.5z\"/><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" d=\"M4 11H1M7 7 4 5\"/></svg>",
  "friday-night-football": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\" width=\"32\" height=\"32\" aria-hidden=\"true\"><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" d=\"M5 4v12M27 4v12M5 8h22M16 8v6\"/><circle fill=\"currentColor\" cx=\"5\" cy=\"3\" r=\"2\"/><circle fill=\"currentColor\" cx=\"27\" cy=\"3\" r=\"2\"/><path fill=\"var(--icon-tint, #ECC6B3)\" stroke=\"currentColor\" stroke-width=\"2\" d=\"M5 25c3-9 11-12 22-7-3 9-11 12-22 7z\"/><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" d=\"m11 24 10-5M14 20l4 4M17 19l3 3\"/></svg>",
  "ice-snow-and-underdogs": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\" width=\"32\" height=\"32\" aria-hidden=\"true\"><path fill=\"var(--icon-tint, #ECC6B3)\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\" d=\"M8 5h10v12l7 3v5H7c-4 0-4-5 1-8z\"/><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" d=\"M5 28h20c3 0 4-1 4-3M21 4v9M17 8h8M18 5l6 6M24 5l-6 6\"/></svg>",
  "wheels-and-waves": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\" width=\"32\" height=\"32\" aria-hidden=\"true\"><path fill=\"var(--icon-tint, #ECC6B3)\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" d=\"M3 23c5 4 9 4 13 0s8-4 13 0v6H3z\"/><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" d=\"M5 16c6 2 14 2 22 0M7 13c5 1 11 1 18 0\"/><circle fill=\"currentColor\" cx=\"10\" cy=\"18\" r=\"2\"/><circle fill=\"currentColor\" cx=\"23\" cy=\"18\" r=\"2\"/><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" d=\"M4 7c4-4 8 4 12 0s8 4 12 0\"/></svg>",
  "girls-in-the-game": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\" width=\"32\" height=\"32\" aria-hidden=\"true\"><circle fill=\"var(--icon-tint, #ECC6B3)\" stroke=\"currentColor\" stroke-width=\"2\" cx=\"16\" cy=\"8\" r=\"4\"/><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M16 12v8M16 15l-7-3M16 15l7-4M16 20l-5 8M16 20l7 7\"/><path fill=\"currentColor\" d=\"m25 3 1.2 2.5 2.8.4-2 2 .5 2.8-2.5-1.4-2.5 1.4.5-2.8-2-2 2.8-.4z\"/><circle fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" cx=\"7\" cy=\"11\" r=\"3\"/></svg>",
  "black-joy-family-big-dreams": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\" width=\"32\" height=\"32\" aria-hidden=\"true\"><circle fill=\"var(--icon-tint, #ECC6B3)\" stroke=\"currentColor\" stroke-width=\"2.2\" cx=\"15\" cy=\"17\" r=\"11\"/><circle fill=\"currentColor\" cx=\"15\" cy=\"17\" r=\"4\"/><circle fill=\"var(--icon-tint, #ECC6B3)\" cx=\"15\" cy=\"17\" r=\"1.4\"/><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" d=\"M8 12a8 8 0 0 1 11-2M7 18a8 8 0 0 0 12 6\"/><path fill=\"currentColor\" d=\"m25 2 1.4 3 3.3.5-2.4 2.3.6 3.3-2.9-1.6-3 1.6.6-3.3-2.4-2.3 3.3-.5zM27 16l.8 1.6 1.8.3-1.3 1.2.3 1.8-1.6-.9-1.6.9.3-1.8-1.3-1.2 1.8-.3z\"/></svg>",
  "latino-families-many-stories": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\" width=\"32\" height=\"32\" aria-hidden=\"true\"><path fill=\"var(--icon-tint, #ECC6B3)\" stroke=\"currentColor\" stroke-width=\"2\" d=\"M5 28V13C5 6 10 3 16 3s11 3 11 10v15z\"/><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" d=\"M11 28V16c0-4 2-6 5-6s5 2 5 6v12\"/><path fill=\"currentColor\" d=\"M24 5c-1-3-4-2-4 0-2-2-5 0-3 2l3 2 2-2 2 2 3-2c2-2-1-4-3-2zM9 7h2v7c2-1 4 0 4 2s-2 3-4 3-4-1-4-3c0-1 1-2 2-2z\"/></svg>",
  "asian-families-many-stories": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\" width=\"32\" height=\"32\" aria-hidden=\"true\"><rect fill=\"var(--icon-tint, #ECC6B3)\" stroke=\"currentColor\" stroke-width=\"2\" x=\"3\" y=\"3\" width=\"26\" height=\"26\" rx=\"4\"/><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" d=\"M16 4v24M4 16h24\"/><path fill=\"currentColor\" d=\"M10 7a4 4 0 1 0 3 6 3.5 3.5 0 1 1-3-6zM19 13l3-5 4 5zM8 25h6l-3-5z\"/><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" d=\"M20 25v-6l5-1v5M20 25c-2 0-2-3 0-3M25 23c2 0 2-3 0-3\"/></svg>",
  "more-than-one-culture-at-home": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\" width=\"32\" height=\"32\" aria-hidden=\"true\"><path fill=\"var(--icon-tint, #ECC6B3)\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\" d=\"M3 15 16 4l13 11v14H3z\"/><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" d=\"M16 5v24M3 20h26M8 15l4-4M20 14l4-4M6 25l4-4M20 27l7-7\"/><path fill=\"currentColor\" d=\"M16 17c-3-3-7 1-4 4l4 4 4-4c3-3-1-7-4-4z\"/></svg>",
  "families-with-pride": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\" width=\"32\" height=\"32\" aria-hidden=\"true\"><path fill=\"var(--icon-tint, #ECC6B3)\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\" d=\"M3 15 16 4l13 11v14H3z\"/><path fill=\"none\" stroke=\"#D96A5F\" stroke-width=\"2.2\" stroke-linecap=\"round\" d=\"M7 23a9 9 0 0 1 18 0\"/><path fill=\"none\" stroke=\"#D99B27\" stroke-width=\"2.2\" stroke-linecap=\"round\" d=\"M10 23a6 6 0 0 1 12 0\"/><path fill=\"none\" stroke=\"#4F86C6\" stroke-width=\"2.2\" stroke-linecap=\"round\" d=\"M13 23a3 3 0 0 1 6 0\"/><path fill=\"currentColor\" d=\"M16 20c-2-3-6 0-3 3l3 3 3-3c3-3-1-6-3-3z\"/></svg>"
});
