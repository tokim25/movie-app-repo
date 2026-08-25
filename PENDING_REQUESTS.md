# Movie request processing log

This is no longer the request queue. Requests come from the in-app "Request a
movie" form, which submits to a Google Form and lands as rows in the
"Movie Night Requests (Responses)" Sheet
(fileId `1zRCemYIpnMSoQer2vhi7nPQbQlY9bg2pRl0h983Gd_Q`).

Since there's no reliable way to mark a row "processed" directly on the sheet,
the `movie-watchlist-updater` skill logs each timestamped row here once it's
been researched and added, so a future run doesn't reprocess the same title.
Format: one line per processed row, `<timestamp> — <title> — added as num <N>`
(or `— skipped: <reason>` if it wasn't added, e.g. already in the catalog).

<!-- add processed rows below, oldest first -->
8/24/2026 10:08:04 — The sheep detective — added as num 838
8/24/2026 15:15:53 — Star Wars Episode V: The Empire Strikes Back — added as num 840
8/24/2026 15:15:58 — Star Wars Episode VI: Return of the Jedi — added as num 841
8/24/2026 15:16:05 — Star Wars Episode I: The Phantom Menace — added as num 842
8/24/2026 15:16:11 — Star Wars Episode II: Attack of the Clones — added as num 843
8/24/2026 15:16:17 — Star Wars Episode III: Revenge of the Sith — added as num 844
8/24/2026 15:16:27 — Star Wars Episode VII: The Force Awakens — added as num 845
8/24/2026 15:16:32 — Star Wars Episode VIII: The Last Jedi — added as num 846
8/24/2026 15:16:40 — Star Wars Episode IX: The Rise of Skywalker — added as num 847
8/24/2026 15:16:51 — Star Wars: Rogue One — added as num 848
8/24/2026 15:17:01 — Solo: A Star Wars Story — added as num 849
8/24/2026 15:17:07 — Mandalorian and Grogu — added as num 850
8/24/2026 15:17:19 — D2: Mighty Ducks — added as num 851
8/24/2026 15:17:25 — D3: Mighty Ducks 3 — added as num 852
8/24/2026 15:17:57 — Yellow Submarine — added as num 853
8/24/2026 15:18:05 — Harry Potter and the Chamber of Secrets — added as num 854
8/24/2026 15:18:12 — Harry Potter and the Prisoner of Azkaban — added as num 855
8/24/2026 15:18:15 — Harry Potter and the Goblet of Fire — added as num 856
8/24/2026 15:18:19 — Harry Potter and the Order of the Phoenix — added as num 857
8/24/2026 15:18:28 — Harry Potter and the Half-Blood Prince — added as num 858
8/24/2026 15:18:42 — Harry Potter and the Deathly Hallows Part 1 — added as num 859
8/24/2026 15:18:44 — Harry Potter and the Deathly Hallows Part 2 — added as num 860
8/24/2026 15:18:55 — Flubber — skipped: already in catalog (or duplicate of another row in this batch)
8/24/2026 15:19:12 — Stuart Little 2 — added as num 868
8/24/2026 15:19:45 — Space Jam — added as num 869
8/24/2026 15:19:55 — A Charlie Brown Christmas — added as num 863
8/24/2026 15:20:02 — The Chronicles of Narnia: The Lion, the Witch, and the Wardrobe (2005) — added as num 870
8/24/2026 15:20:08 — How the Grinch Stole Christmas (1966) — added as num 864
8/24/2026 15:20:19 — The Great Muppet Caper (1981) — added as num 865
8/24/2026 15:20:39 — Willy Wonka and the Chocolate Factory (1971) — skipped: already in catalog (or duplicate of another row in this batch)
8/24/2026 15:20:48 — A Christmas Story (1983) — added as num 866
8/24/2026 15:20:59 — Willow (1988) — added as num 872
8/24/2026 15:21:04 — The Lego Movie (2014) — skipped: already in catalog (or duplicate of another row in this batch)
8/24/2026 15:21:08 — Ninjago — added as num 874
8/24/2026 15:21:10 — The Lego Movie 2 — added as num 875
8/24/2026 15:21:15 — The Lego Batman Movie — skipped: already in catalog (or duplicate of another row in this batch)
8/24/2026 15:21:24 — Who Framed Roger Rabbit? (1988) — added as num 876
8/24/2026 15:21:32 — The Princess Bride (1987) — skipped: already in catalog (or duplicate of another row in this batch)
8/24/2026 15:21:42 — The Secret of NIMH (1982) — added as num 878
8/24/2026 15:21:53 — The Transformers: The Movie (1986) — added as num 879
8/24/2026 15:22:05 — Jurassic Park (1993) — added as num 881
8/24/2026 15:22:10 — Jurassic Park: The Lost World — added as num 882
8/24/2026 15:22:20 — The Hobbit (1977) — added as num 888
8/24/2026 15:22:30 — The Fantastic Mr. Fox (2009) — skipped: already in catalog (or duplicate of another row in this batch)
8/24/2026 15:22:54 — The Wizard of Oz (1939) — skipped: already in catalog (or duplicate of another row in this batch)
8/24/2026 15:23:14 — Jurassic Park III (2001) — added as num 883
8/24/2026 15:23:18 — Jurassic World (2015) — added as num 884
8/24/2026 15:23:23 — Jurassic World: Fallen Kingdom (2018) — added as num 885
8/24/2026 15:23:29 — Jurassic World: Dominion (2022) — added as num 886
8/24/2026 15:23:33 — Jurassic World Rebirth (2025) — added as num 887
8/24/2026 15:23:38 — The End of Oak Street — added as num 889
8/24/2026 15:24:59 — The Kid Who Would Be King — skipped: already in catalog (or duplicate of another row in this batch)
8/24/2026 15:25:05 — The Railway Children — added as num 891
8/24/2026 15:25:23 — Early Man — skipped: already in catalog (or duplicate of another row in this batch)
8/24/2026 15:25:56 — Fly Away Home — skipped: already in catalog (or duplicate of another row in this batch)
8/24/2026 15:26:31 — The Water Horse: Legend Of The Deep' (2007) — added as num 892
8/24/2026 15:26:41 — Fantastic Beasts and Where to Find Them' (2016) — added as num 861
8/24/2026 15:26:49 — Crimes of Grindelwald — added as num 862
8/24/2026 15:26:57 — Nanny McPhee' (2005) — added as num 867
8/24/2026 15:38:13 — School of Rock — skipped: already in catalog (or duplicate of another row in this batch)
8/24/2026 15:38:16 — Nacho Libre — added as num 894
8/24/2026 15:38:33 — The Goonies — skipped: already in catalog (or duplicate of another row in this batch)
8/24/2026 15:38:40 — Flight of the Navigator — skipped: already in catalog (or duplicate of another row in this batch)
8/24/2026 15:38:42 — Tron — added as num 895
8/24/2026 15:38:59 — Raiders of the Lost Ark — skipped: already in catalog (or duplicate of another row in this batch)
8/24/2026 15:39:06 — Indiana Jones and the Last Crusade — added as num 896
8/24/2026 15:39:13 — Indiana Jones and the Lost Temple — added as num 897
8/24/2026 15:39:22 — Indiana Jones and the Crystal Skull — added as num 898
8/24/2026 15:39:28 — Indiana Jones and the Dial of Destiny — added as num 899
8/24/2026 15:39:33 — The Karate Kid — skipped: already in catalog (or duplicate of another row in this batch)
8/24/2026 15:39:38 — Labyrinth — added as num 901
8/24/2026 15:39:44 — Adventures in Babysitting (1987) — added as num 1019
8/24/2026 15:39:52 — Ghostbusters — added as num 902
8/24/2026 15:40:10 — Ghostbusters II — added as num 903
8/24/2026 15:40:13 — The Karate Kid — skipped: already in catalog (or duplicate of another row in this batch)
8/24/2026 15:40:16 — The Karate Kid Part II — added as num 904
8/24/2026 15:40:21 — The Karate Kid Part III — added as num 905
8/24/2026 15:40:25 — Gremlins — added as num 906
8/24/2026 15:40:29 — Gremlins 2 — added as num 907
8/24/2026 15:40:34 — The Santa Clause — skipped: already in catalog (or duplicate of another row in this batch)
8/24/2026 15:40:39 — The Santa Clause 2 — added as num 908
8/24/2026 15:40:41 — The Santa Clause 3 — added as num 909
8/24/2026 15:40:44 — Turner and Hooch — added as num 910
8/24/2026 15:40:52 — Flash Gordon — added as num 911
8/24/2026 15:40:59 — The Muppets Take Manhattan — added as num 912
8/24/2026 15:41:08 — Harry and the Hendersons — added as num 913
8/24/2026 15:41:13 — Popeye — added as num 914
8/24/2026 15:41:20 — Goonies — skipped: already in catalog (or duplicate of another row in this batch)
8/24/2026 15:42:00 — All Dogs Go to Heaven — added as num 915
8/24/2026 15:42:02 — All Dogs Go to Heaven 2 — skipped: already in catalog (or duplicate of another row in this batch)
8/24/2026 15:42:28 — The Jetsons Meet the Flintstones — added as num 916
8/24/2026 15:42:40 — Mickey's Christmas Carol — added as num 917
8/24/2026 15:42:46 — My Little Pony: The Movie (1986 film) — added as num 918
8/24/2026 15:42:55 — The Secret of NIMH — skipped: already in catalog (or duplicate of another row in this batch)
8/24/2026 15:43:03 — The Transformers: The Movie — skipped: already in catalog (or duplicate of another row in this batch)
8/24/2026 15:43:07 — The Wiz — added as num 919
8/24/2026 15:43:29 — Little Monsters (1989 film) — added as num 920
8/24/2026 15:43:36 — Richie Rich — added as num 921
8/24/2026 15:43:38 — It Takes Two — added as num 922
8/24/2026 15:43:52 — Babes in Toyland (1986 film) — added as num 924
8/24/2026 15:43:59 — The Care Bears Movie — added as num 925
8/24/2026 15:44:03 — Care Bears Movie II: A New Generation — added as num 926
8/24/2026 15:44:47 — The Adventures of Elmo in Grouchland — added as num 927
8/24/2026 15:45:03 — The Brave Little Toaster to the Rescue — added as num 928
8/24/2026 15:45:08 — Casper (film) — added as num 929
8/24/2026 15:45:16 — Escape to Witch Mountain (1995 film) — added as num 930
8/24/2026 15:45:22 — FernGully 2: The Magical Rescue — added as num 931
8/24/2026 15:45:32 — Warriors of Virtue — added as num 932
8/24/2026 15:45:38 — Turbo: A Power Rangers Movie — added as num 933
8/24/2026 15:45:56 — Pippi Longstocking (1997 film) — added as num 934
8/24/2026 15:46:08 — Power Rangers: The Movie — added as num 935
8/24/2026 15:46:29 — Balto — added as num 936
8/24/2026 15:46:36 — Dennis the Menace (film) — added as num 937
8/24/2026 15:46:41 — Flipper (1996 film) — added as num 938
8/24/2026 15:46:46 — Jungle 2 Jungle — added as num 939
8/24/2026 15:46:50 — Tom and Huck — added as num 940
8/24/2026 15:46:55 — We're Back A Dinosaur's Story (film) — added as num 941
8/24/2026 15:46:58 — Wild America (film) — added as num 942
8/24/2026 15:47:24 — Cats Don't Dance — added as num 943
8/24/2026 15:47:33 — A Goofy Movie — skipped: already in catalog (or duplicate of another row in this batch)
8/24/2026 15:47:44 — The Land Before Time II: The Great Valley Adventure — added as num 944
8/24/2026 15:47:49 — The Land Before Time III: The Time of the Great Giving — added as num 945
8/24/2026 15:47:52 — The Land Before Time IV: Journey Through the Mists — added as num 946
8/24/2026 15:48:09 — Quest for Camelot — added as num 947
8/24/2026 15:48:14 — The Prince of Egypt — skipped: already in catalog (or duplicate of another row in this batch)
8/24/2026 15:48:19 — Pokemon: The First Movie — added as num 948
8/24/2026 15:48:30 — The Land Before Time V: The Mysterious Island — added as num 949
8/24/2026 15:48:33 — The Land Before Time VI: The Secret of Saurus Rock — added as num 950
8/24/2026 15:48:41 — An American Tail: Fievel Goes West — added as num 951
8/24/2026 15:48:47 — Angels in the Outfield (1994 film) — skipped: already in catalog (or duplicate of another row in this batch)
8/24/2026 15:48:50 — Babes in Toyland (1997 film) — added as num 924
8/24/2026 15:48:54 — Baby's Day Out — added as num 952
8/24/2026 15:49:00 — Blank Check (film) — added as num 953
8/24/2026 15:49:03 — The Brave Little Toaster to the Rescue — added as num 928
8/24/2026 15:49:07 — The Borrowers (1997 film) — added as num 954
8/24/2026 15:49:13 — Doug's 1st Movie — added as num 955
8/24/2026 15:49:16 — Dunston Checks In — added as num 956
8/24/2026 15:49:21 — First Kid — added as num 957
8/24/2026 15:49:24 — The Flintstones (film) — added as num 958
8/24/2026 15:49:28 — Harriet the Spy (film) — skipped: already in catalog (or duplicate of another row in this batch)
8/24/2026 15:49:32 — Hocus Pocus (1993 film) — skipped: already in catalog (or duplicate of another row in this batch)
8/24/2026 15:49:34 — Jingle All the Way — added as num 959
8/24/2026 15:49:47 — Sister Act — added as num 960
8/24/2026 15:49:49 — Sister Act 2: Back in the Habit — added as num 961
8/24/2026 15:50:05 — Miracle on 34th Street (1994 film) — added as num 962
8/24/2026 15:50:37 — North (1994 film) — added as num 963
8/24/2026 15:51:34 — Night at the Museum — added as num 964
8/24/2026 15:51:38 — Night at the Museum: Battle of the Smithsonian — added as num 965
8/24/2026 15:52:45 — The Polar Express — added as num 966
8/24/2026 15:53:20 — Curious George (film) — added as num 967
8/24/2026 15:53:26 — Happy Feet — added as num 968
8/24/2026 15:53:28 — Happy Feet 2 — added as num 969
8/24/2026 15:54:00 — Star Wars: The Clone Wars — added as num 970
8/24/2026 15:54:35 — Corpse Bride — added as num 971
8/24/2026 15:55:04 — ParaNorman — added as num 972
8/24/2026 15:55:17 — Isle of Dogs — added as num 973
8/24/2026 15:55:25 — Frankenweenie — skipped: already in catalog (or duplicate of another row in this batch)
8/24/2026 15:56:26 — Diary of a Wimpy Kid (2021 film) — added as num 974
8/24/2026 15:56:57 — The Bad Guys — skipped: already in catalog (or duplicate of another row in this batch)
8/24/2026 15:57:01 — The Bad Guys 2 — added as num 976
8/24/2026 15:57:12 — Minions: The Rise of Gru — added as num 977
8/24/2026 15:57:19 — DC League of Super-Pets — skipped: already in catalog (or duplicate of another row in this batch)
8/24/2026 15:57:29 — Sonic the Hedgehog — added as num 978
8/24/2026 15:57:30 — Sonic the Hedgehog 2 — added as num 979
8/24/2026 15:57:32 — Sonic the Hedgehog 3 — added as num 980
8/24/2026 15:57:50 — The Super Mario Bros. Movie — added as num 981
8/24/2026 15:57:53 — Super Mario Galaxy — added as num 982
8/24/2026 15:58:12 — Transformers One — added as num 983
8/24/2026 15:58:15 — IF (film) — added as num 984
8/24/2026 15:58:20 — The Wild Robot — skipped: already in catalog (or duplicate of another row in this batch)
8/24/2026 15:58:29 — KPop Demon Hunters — added as num 985
8/24/2026 15:58:39 — Diary of a Wimpy Kid: The Last Straw (film) — added as num 986
8/24/2026 15:58:44 — Smurfs (film) — added as num 987
8/24/2026 15:58:50 — The SpongeBob Movie: Search for SquarePants — added as num 988
8/24/2026 15:58:54 — Gabby's Dollhouse: The Movie — added as num 989
8/24/2026 15:59:07 — Minions & Monsters — skipped: already in catalog (or duplicate of another row in this batch)
8/24/2026 15:59:13 — Swapped — added as num 990
8/24/2026 15:59:17 — GOAT (2026 film) — added as num 991
8/24/2026 16:00:05 — Teenage Mutant Ninja Turtles II: The Secret of the Ooze — added as num 992
8/24/2026 16:00:13 — 3 Ninjas (film) — skipped: already in catalog (or duplicate of another row in this batch)
8/24/2026 16:00:15 — Beethoven — skipped: already in catalog (or duplicate of another row in this batch)
8/24/2026 16:00:20 — Beethoven's 2nd — added as num 993
8/24/2026 16:00:39 — Cool Runnings — skipped: already in catalog (or duplicate of another row in this batch)
8/24/2026 16:02:13 — Mr. Popper's Penguins' (2011) — added as num 994
8/24/2026 16:02:16 — We Bought a Zoo' (2011) — added as num 995
8/24/2026 16:02:22 — Earth to Echo' (2014) — added as num 996
8/24/2026 16:02:29 — The House with a Clock in Its Walls' (2018) — added as num 997
8/24/2026 16:02:35 — Diary of a Wimpy Kid: Rodrick Rules' (2011) — added as num 998
8/24/2026 16:02:38 — Mirror Mirror' (2012) — added as num 999
8/24/2026 16:02:59 — Barbie (2023) — added as num 1000
8/24/2026 16:03:33 — Roald Dahl's Matilda The Musical — added as num 1001
8/24/2026 16:03:46 — Wonka — added as num 1002
8/24/2026 16:04:28 — Sing 2 — added as num 1003
8/24/2026 16:05:35 — The Garfield Movie — added as num 1004
8/24/2026 16:05:48 — The Angry Birds Movie — added as num 1005
8/24/2026 16:05:49 — The Angry Birds Movie 2 — added as num 1006
8/24/2026 16:05:50 — The Angry Birds Movie 3 — skipped: not yet released as of 2026-08-24
8/24/2026 18:05:41 — All the jumanji movies — added Jumanji: Welcome to the Jungle as num 1007 and Jumanji: The Next Level as num 1008 (original 1995 Jumanji was already in the catalog)
8/24/2026 18:54:41 — Sandlot — skipped: already in catalog (or duplicate of another row in this batch)
8/24/2026 18:54:53 — Bridge to terabithia — skipped: already in catalog (or duplicate of another row in this batch)
8/24/2026 18:55:03 — Ramona and beezus — added as num 1010
8/24/2026 18:55:26 — Zathura a space adventure — added as num 1011
8/24/2026 18:55:34 — My girl — added as num 1012
8/24/2026 18:55:38 — My girl 2 — added as num 1013
8/24/2026 18:55:47 — The secret garden — added as num 1014
8/24/2026 18:55:56 — Life-size — added as num 1015
8/24/2026 18:56:05 — Ella enchanted — added as num 1016
8/24/2026 18:56:17 — How to eat fried worms — added as num 1017
8/24/2026 18:56:31 — Casper — added as num 929
8/24/2026 18:56:41 — Where the wild things are — added as num 1018
8/24/2026 18:56:59 — A little princess — skipped: already in catalog (or duplicate of another row in this batch)
