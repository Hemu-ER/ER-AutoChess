// 32-character roster. Pending entries use basic combat only; no invented skills.
(function(root){'use strict';
const roster=[
  {
    "id": "hyunwoo",
    "name": "멧현우",
    "cost": 1,
    "role": "전사",
    "affiliations": [
      "파자마"
    ],
    "baseStats": {
      "hp": 1080,
      "atk": 76,
      "amp": 38,
      "range": 1,
      "def": 39,
      "as": 0.92
    },
    "implemented": true,
    "main": "atk",
    "asset": {
      "sd": "assets/characters/hyunwoo.png"
    }
  },
  {
    "id": "adela",
    "name": "꿈델라",
    "cost": 2,
    "role": "원거리 스킬",
    "affiliations": [
      "파자마"
    ],
    "baseStats": {
      "hp": 760,
      "atk": 50,
      "amp": 126,
      "range": 3,
      "def": 21,
      "as": 0.8
    },
    "implemented": true,
    "main": "amp",
    "asset": {
      "sd": "assets/characters/adela.png"
    }
  },
  {
    "id": "dailin",
    "name": "다이린",
    "cost": 3,
    "role": "전사",
    "affiliations": [
      "파자마"
    ],
    "baseStats": {
      "hp": 1030,
      "atk": 78,
      "amp": 42,
      "range": 1,
      "def": 36,
      "as": 0.92
    },
    "implemented": true,
    "main": "atk",
    "asset": {
      "sd": "assets/characters/dailin.png"
    }
  },
  {
    "id": "yuki",
    "name": "유키멍",
    "cost": 2,
    "role": "전사",
    "affiliations": [
      "파자마"
    ],
    "baseStats": {
      "hp": 1110,
      "atk": 72,
      "amp": 36,
      "range": 1,
      "def": 42,
      "as": 0.84
    },
    "implemented": true,
    "main": "atk",
    "asset": {
      "sd": "assets/characters/yuki.png"
    }
  },
  {
    "id": "rio",
    "name": "리오",
    "cost": 2,
    "role": "원거리 평타",
    "affiliations": [
      "바니걸"
    ],
    "baseStats": {
      "hp": 735,
      "atk": 76,
      "amp": 24,
      "range": 3,
      "def": 18,
      "as": 1.08
    },
    "implemented": true,
    "main": "atk",
    "asset": {
      "sd": "assets/characters/rio.png"
    }
  },
  {
    "id": "justina",
    "name": "유스티나",
    "cost": 1,
    "role": "원거리 스킬",
    "affiliations": [
      "바니걸",
      "에레보스"
    ],
    "baseStats": {
      "hp": 770,
      "atk": 51,
      "amp": 112,
      "range": 3,
      "def": 21,
      "as": 0.84
    },
    "implemented": true,
    "main": "amp",
    "asset": {
      "sd": "assets/characters/justina.png"
    }
  },
  {
    "id": "jenny",
    "name": "제니",
    "cost": 2,
    "role": "원거리 스킬",
    "affiliations": [
      "바니걸"
    ],
    "baseStats": {
      "hp": 745,
      "atk": 50,
      "amp": 118,
      "range": 3,
      "def": 19,
      "as": 0.86
    },
    "implemented": true,
    "main": "amp",
    "asset": {
      "sd": "assets/characters/jenny.png"
    }
  },
  {
    "id": "nicky",
    "name": "니키",
    "cost": 3,
    "role": "전사",
    "affiliations": [
      "바니걸"
    ],
    "baseStats": {
      "hp": 1010,
      "atk": 62,
      "amp": 104,
      "range": 1,
      "def": 38,
      "as": 0.86
    },
    "implemented": true,
    "main": "amp",
    "asset": {
      "sd": "assets/characters/nicky.png"
    }
  },
  {
    "id": "shurin",
    "name": "슈린",
    "cost": 3,
    "role": "전사",
    "affiliations": [
      "수영복"
    ],
    "baseStats": {
      "hp": 965,
      "atk": 80,
      "amp": 34,
      "range": 1,
      "def": 31,
      "as": 0.98
    },
    "implemented": true,
    "main": "atk",
    "asset": {
      "sd": "assets/characters/shurin.png"
    }
  },
  {
    "id": "marcus",
    "name": "마커스",
    "cost": 2,
    "role": "탱커",
    "affiliations": [
      "수영복"
    ],
    "baseStats": {
      "hp": 1260,
      "atk": 60,
      "amp": 24,
      "range": 1,
      "def": 53,
      "as": 0.75
    },
    "implemented": true,
    "main": "atk",
    "asset": {
      "sd": "assets/characters/marcus.png"
    }
  },
  {
    "id": "ian",
    "name": "이안",
    "cost": 3,
    "role": "전사",
    "affiliations": [
      "마츠리"
    ],
    "baseStats": {
      "hp": 925,
      "atk": 79,
      "amp": 32,
      "range": 1,
      "def": 30,
      "as": 0.9
    },
    "implemented": true,
    "main": "atk",
    "asset": {
      "sd": "assets/characters/ian.png"
    }
  },
  {
    "id": "yumin",
    "name": "유민",
    "cost": 2,
    "role": "원거리 스킬",
    "affiliations": [
      "수영복"
    ],
    "baseStats": {
      "hp": 755,
      "atk": 48,
      "amp": 122,
      "range": 3,
      "def": 20,
      "as": 0.8
    },
    "implemented": true,
    "main": "amp",
    "asset": {
      "sd": "assets/characters/yumin.png"
    }
  },
  {
    "id": "debi-marlene",
    "name": "데비&마를렌",
    "cost": 1,
    "role": "전사",
    "affiliations": [
      "수영복"
    ],
    "baseStats": {
      "hp": 1060,
      "atk": 70,
      "amp": 34,
      "range": 1,
      "def": 38,
      "as": 0.88
    },
    "implemented": true,
    "main": "atk",
    "asset": {
      "sd": "assets/characters/debi-marlene.png"
    }
  },
  {
    "id": "garnet",
    "name": "가넷",
    "cost": 2,
    "role": "탱커",
    "affiliations": [
      "마츠리",
      "애증"
    ],
    "baseStats": {
      "hp": 1210,
      "atk": 50,
      "amp": 72,
      "range": 1,
      "def": 48,
      "as": 0.76
    },
    "implemented": true,
    "main": "amp",
    "asset": {
      "sd": "assets/characters/garnet.png"
    }
  },
  {
    "id": "kenneth",
    "name": "케네스",
    "cost": 1,
    "role": "전사",
    "affiliations": [
      "마츠리"
    ],
    "baseStats": {
      "hp": 1015,
      "atk": 73,
      "amp": 32,
      "range": 1,
      "def": 34,
      "as": 0.88
    },
    "implemented": true,
    "main": "atk",
    "asset": {
      "sd": "assets/characters/kenneth.png"
    }
  },
  {
    "id": "irem",
    "name": "이렘",
    "cost": 3,
    "role": "근거리 스킬",
    "affiliations": [
      "마츠리"
    ],
    "baseStats": {
      "hp": 850,
      "atk": 56,
      "amp": 128,
      "range": 1,
      "def": 27,
      "as": 0.91
    },
    "implemented": true,
    "main": "amp",
    "asset": {
      "sd": "assets/characters/irem.png"
    }
  },
  {
    "id": "laura",
    "name": "라우라",
    "cost": 3,
    "role": "근거리 스킬",
    "affiliations": [
      "프리즌"
    ],
    "baseStats": {
      "hp": 865,
      "atk": 55,
      "amp": 124,
      "range": 1,
      "def": 28,
      "as": 0.88
    },
    "implemented": true,
    "main": "amp",
    "asset": {
      "sd": "assets/characters/laura.png"
    }
  },
  {
    "id": "bianca",
    "name": "비앙카",
    "cost": 2,
    "role": "원거리 스킬",
    "affiliations": [
      "프리즌"
    ],
    "baseStats": {
      "hp": 735,
      "atk": 46,
      "amp": 132,
      "range": 3,
      "def": 18,
      "as": 0.76
    },
    "implemented": true,
    "main": "amp",
    "asset": {
      "sd": "assets/characters/bianca.png"
    }
  },
  {
    "id": "cathy",
    "name": "캐시",
    "cost": 3,
    "role": "암살자",
    "affiliations": [
      "프리즌"
    ],
    "baseStats": {
      "hp": 805,
      "atk": 54,
      "amp": 136,
      "range": 1,
      "def": 23,
      "as": 0.72
    },
    "implemented": true,
    "main": "amp",
    "asset": {
      "sd": "assets/characters/cathy.png"
    }
  },
  {
    "id": "abigail",
    "name": "아비게일",
    "cost": 1,
    "role": "전사",
    "affiliations": [
      "프리즌"
    ],
    "baseStats": {
      "hp": 990,
      "atk": 60,
      "amp": 92,
      "range": 1,
      "def": 34,
      "as": 0.87
    },
    "implemented": true,
    "main": "amp",
    "asset": {
      "sd": "assets/characters/abigail.png"
    }
  },
  {
    "id": "leny",
    "name": "레니",
    "cost": 1,
    "role": "서포터",
    "affiliations": [
      "군악대"
    ],
    "baseStats": {
      "hp": 845,
      "atk": 46,
      "amp": 88,
      "range": 2,
      "def": 27,
      "as": 0.78
    },
    "implemented": true,
    "main": "amp",
    "asset": {
      "sd": "assets/characters/leny.png"
    }
  },
  {
    "id": "hart",
    "name": "하트",
    "cost": 1,
    "role": "원거리 평타",
    "affiliations": [
      "군악대"
    ],
    "baseStats": {
      "hp": 720,
      "atk": 64,
      "amp": 22,
      "range": 3,
      "def": 17,
      "as": 1.04
    },
    "implemented": true,
    "main": "atk",
    "asset": {
      "sd": "assets/characters/hart.png"
    }
  },
  {
    "id": "isol",
    "name": "아이솔",
    "cost": 1,
    "role": "원거리 평타",
    "affiliations": [
      "새해"
    ],
    "baseStats": {
      "hp": 750,
      "atk": 72,
      "amp": 20,
      "range": 3,
      "def": 18,
      "as": 1.02
    },
    "implemented": true,
    "main": "atk",
    "asset": {
      "sd": "assets/characters/isol.png"
    }
  },
  {
    "id": "chloe",
    "name": "클로에",
    "cost": 2,
    "role": "원거리 평타",
    "affiliations": [
      "새해"
    ],
    "baseStats": {
      "hp": 690,
      "atk": 65,
      "amp": 20,
      "range": 3,
      "def": 16,
      "as": 0.94
    },
    "implemented": true,
    "main": "atk",
    "asset": {
      "sd": "assets/characters/chloe.png"
    }
  },
  {
    "id": "sua",
    "name": "수아",
    "cost": 2,
    "role": "전사",
    "affiliations": [
      "새해"
    ],
    "baseStats": {
      "hp": 1080,
      "atk": 58,
      "amp": 102,
      "range": 1,
      "def": 39,
      "as": 0.82
    },
    "implemented": true,
    "main": "amp",
    "asset": {
      "sd": "assets/characters/sua.png"
    }
  },
  {
    "id": "johann",
    "name": "요한",
    "cost": 1,
    "role": "서포터",
    "affiliations": [
      "악마사냥꾼"
    ],
    "baseStats": {
      "hp": 830,
      "atk": 44,
      "amp": 90,
      "range": 2,
      "def": 28,
      "as": 0.76
    },
    "implemented": true,
    "main": "amp",
    "asset": {
      "sd": "assets/characters/johann.png"
    }
  },
  {
    "id": "nadine",
    "name": "나딘",
    "cost": 3,
    "role": "원거리 평타",
    "affiliations": [
      "악마사냥꾼"
    ],
    "baseStats": {
      "hp": 730,
      "atk": 67,
      "amp": 20,
      "range": 3,
      "def": 17,
      "as": 0.94
    },
    "implemented": true,
    "main": "atk",
    "asset": {
      "sd": "assets/characters/nadine.png"
    }
  },
  {
    "id": "bernice",
    "name": "버니스",
    "cost": 2,
    "role": "원거리 평타",
    "affiliations": [
      "악마사냥꾼"
    ],
    "baseStats": {
      "hp": 780,
      "atk": 58,
      "amp": 18,
      "range": 2,
      "def": 22,
      "as": 0.72
    },
    "implemented": true,
    "main": "atk",
    "asset": {
      "sd": "assets/characters/bernice.png"
    }
  },
  {
    "id": "rozzi",
    "name": "로지",
    "cost": 1,
    "role": "원거리 평타",
    "affiliations": [
      "메이드"
    ],
    "baseStats": {
      "hp": 705,
      "atk": 59,
      "amp": 18,
      "range": 3,
      "def": 16,
      "as": 0.78
    },
    "implemented": true,
    "main": "atk",
    "asset": {
      "sd": "assets/characters/rozzi.png"
    }
  },
  {
    "id": "aya",
    "name": "아야",
    "cost": 3,
    "role": "원거리 스킬",
    "affiliations": [
      "메이드"
    ],
    "baseStats": {
      "hp": 720,
      "atk": 48,
      "amp": 128,
      "range": 3,
      "def": 18,
      "as": 0.82
    },
    "implemented": true,
    "main": "amp",
    "asset": {
      "sd": "assets/characters/aya.png"
    }
  },
  {
    "id": "mirka",
    "name": "미르카",
    "cost": 3,
    "role": "탱커",
    "affiliations": [
      "메이드"
    ],
    "baseStats": {
      "hp": 1370,
      "atk": 52,
      "amp": 36,
      "range": 1,
      "def": 58,
      "as": 0.72
    },
    "implemented": true,
    "main": "hp",
    "asset": {
      "sd": "assets/characters/mirka.png"
    }
  },
  {
    "id": "charlotte",
    "name": "샬럿",
    "cost": 1,
    "role": "서포터",
    "affiliations": [
      "치유의 노래"
    ],
    "baseStats": {
      "hp": 860,
      "atk": 43,
      "amp": 94,
      "range": 2,
      "def": 29,
      "as": 0.75
    },
    "implemented": true,
    "main": "amp",
    "asset": {
      "sd": "assets/characters/charlotte.png"
    }
  }
];
function freeze(v){if(v&&typeof v==='object'){Object.freeze(v);for(const x of Object.values(v))freeze(x)}return v}
for(const r of roster)freeze(r);freeze(roster);const byId=Object.freeze(Object.fromEntries(roster.map(r=>[r.id,r])));const api={roster,byId};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ERRoster=api;})(globalThis);
