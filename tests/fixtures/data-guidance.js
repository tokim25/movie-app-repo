// Test fixture only (illustrative). The real data-guidance.js comes from the
// openui/movie-guidance-data branch. Quotes are copied from these titles' `full`
// text in data-bundle.js; levels were set by hand for tests, not reviewed.
// The object after `=` must stay valid JSON: tests JSON.parse it.
const MOVIE_GUIDANCE = {
 "1": {
  "concerns": {
   "parentInDanger": {
    "level": "mild",
    "quote": "The girls' mother is ill and hospitalized (nothing graphic, but real worry)"
   },
   "scaryVillain": {
    "level": "no",
    "quote": ""
   },
   "sadOrLoss": {
    "level": "mild",
    "quote": "there's a tense sequence where the younger sister goes missing"
   },
   "rudeHumor": {
    "level": "no",
    "quote": ""
   },
   "animalPeril": {
    "level": "no",
    "quote": ""
   }
  },
  "preShow": "root = Card([hdr, watch, after])\nhdr = CardHeader(\"My Neighbor Totoro\", \"Studio Ghibli, CSM 5+\")\nwatch = Callout(\"warning\", \"A real worry\", \"The girls' mother is ill and hospitalized, and the younger sister goes missing for a tense stretch.\")\nafter = TextContent(\"Ask after: what helped Satsuki stay brave?\", \"small\")"
 },
 "2": {
  "concerns": {
   "parentInDanger": {
    "level": "yes",
    "quote": "the opening shows Nemo's mother and siblings-to-be killed by a predator"
   },
   "scaryVillain": {
    "level": "no",
    "quote": ""
   },
   "sadOrLoss": {
    "level": "yes",
    "quote": "a gut-punch for sensitive kids"
   },
   "rudeHumor": {
    "level": "no",
    "quote": ""
   },
   "animalPeril": {
    "level": "yes",
    "quote": "Marlin faces sharks, jellyfish, and an anglerfish in genuinely scary scenes"
   }
  },
  "preShow": "root = Card([hdr, tags, watch, after])\nhdr = CardHeader(\"Finding Nemo\", \"Pixar, CSM 6+\")\ntags = TagBlock([\"Scary moments\", \"Almost no language\"], \"sm\")\nwatch = Callout(\"warning\", \"Be ready early on\", \"The opening shows Nemo's mother and siblings-to-be killed by a predator. Quick, not graphic, but a gut-punch for sensitive kids.\")\nafter = TextContent(\"Ask after: why was Marlin so scared to let Nemo go?\", \"small\")"
 },
 "5": {
  "concerns": {
   "parentInDanger": {
    "level": "no",
    "quote": ""
   },
   "scaryVillain": {
    "level": "yes",
    "quote": "a taxidermist villain wants to stuff Paddington"
   },
   "sadOrLoss": {
    "level": "no",
    "quote": ""
   },
   "rudeHumor": {
    "level": "mild",
    "quote": "slapstick"
   },
   "animalPeril": {
    "level": "yes",
    "quote": "a taxidermist villain wants to stuff Paddington"
   }
  }
 },
 "104": {
  "concerns": {
   "parentInDanger": {
    "level": "no",
    "quote": ""
   },
   "scaryVillain": {
    "level": "no",
    "quote": ""
   },
   "sadOrLoss": {
    "level": "no",
    "quote": ""
   },
   "rudeHumor": {
    "level": "no",
    "quote": ""
   },
   "animalPeril": {
    "level": "mild",
    "quote": "an aggressive crow that may startle"
   }
  },
  "preShow": "root = Card([gentle])\ngentle = TextContent(\"Gentle. Nothing to prep for.\")"
 }
};
