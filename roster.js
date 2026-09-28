// Checkpoint roster. Unimplemented entries are data only and cannot enter combat.
(function(root){
'use strict';
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
      "def": 39,
      "as": 0.88,
      "amp": 38,
      "range": 1
    },
    "implemented": false,
    "main": "amp"
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
      "def": 21,
      "as": 0.8,
      "amp": 126,
      "range": 3
    },
    "implemented": false,
    "main": "amp"
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
      "def": 36,
      "as": 0.92,
      "amp": 42,
      "range": 1
    },
    "implemented": false,
    "main": "amp"
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
      "def": 42,
      "as": 0.84,
      "amp": 36,
      "range": 1
    },
    "implemented": false,
    "main": "amp"
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
      "def": 18,
      "as": 1.08,
      "amp": 24,
      "range": 3
    },
    "implemented": true,
    "main": "atk"
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
      "def": 21,
      "as": 0.84,
      "amp": 112,
      "range": 3
    },
    "implemented": true,
    "main": "amp"
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
      "def": 19,
      "as": 0.86,
      "amp": 118,
      "range": 3
    },
    "implemented": false,
    "main": "amp"
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
      "def": 38,
      "as": 0.86,
      "amp": 104,
      "range": 1
    },
    "implemented": true,
    "main": "amp"
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
      "def": 31,
      "as": 0.98,
      "amp": 34,
      "range": 1
    },
    "implemented": true,
    "main": "atk"
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
      "def": 53,
      "as": 0.75,
      "amp": 24,
      "range": 1
    },
    "implemented": true,
    "main": "atk"
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
      "def": 30,
      "as": 0.9,
      "amp": 32,
      "range": 1
    },
    "implemented": false,
    "main": "amp"
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
      "def": 20,
      "as": 0.8,
      "amp": 122,
      "range": 3
    },
    "implemented": true,
    "main": "amp"
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
      "def": 38,
      "as": 0.88,
      "amp": 34,
      "range": 1
    },
    "implemented": false,
    "main": "amp"
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
      "def": 48,
      "as": 0.76,
      "amp": 72,
      "range": 1
    },
    "implemented": false,
    "main": "amp"
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
      "def": 34,
      "as": 0.88,
      "amp": 32,
      "range": 1
    },
    "implemented": false,
    "main": "amp"
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
      "def": 27,
      "as": 0.91,
      "amp": 128,
      "range": 1
    },
    "implemented": false,
    "main": "amp"
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
      "def": 28,
      "as": 0.88,
      "amp": 124,
      "range": 1
    },
    "implemented": false,
    "main": "amp"
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
      "def": 18,
      "as": 0.76,
      "amp": 132,
      "range": 3
    },
    "implemented": false,
    "main": "amp"
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
      "def": 23,
      "as": 0.72,
      "amp": 136,
      "range": 1
    },
    "implemented": false,
    "main": "amp"
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
      "def": 34,
      "as": 0.87,
      "amp": 92,
      "range": 1
    },
    "implemented": false,
    "main": "amp"
  },
  {
    "id": "leni",
    "name": "레니",
    "cost": 1,
    "role": "서포터",
    "affiliations": [
      "군악대"
    ],
    "baseStats": {
      "hp": 845,
      "atk": 46,
      "def": 27,
      "as": 0.78,
      "amp": 88,
      "range": 2
    },
    "implemented": false,
    "main": "amp"
  },
  {
    "id": "heart",
    "name": "하트",
    "cost": 1,
    "role": "원거리 평타",
    "affiliations": [
      "군악대"
    ],
    "baseStats": {
      "hp": 720,
      "atk": 64,
      "def": 17,
      "as": 1.04,
      "amp": 22,
      "range": 3
    },
    "implemented": false,
    "main": "amp"
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
      "def": 18,
      "as": 1.02,
      "amp": 20,
      "range": 3
    },
    "implemented": false,
    "main": "amp"
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
      "def": 16,
      "as": 0.94,
      "amp": 20,
      "range": 3
    },
    "implemented": false,
    "main": "amp"
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
      "def": 39,
      "as": 0.82,
      "amp": 102,
      "range": 1
    },
    "implemented": false,
    "main": "amp"
  },
  {
    "id": "johann",
    "name": "요한",
    "cost": 1,
    "role": "서포터",
    "affiliations": [
      "데몬헌터"
    ],
    "baseStats": {
      "hp": 830,
      "atk": 44,
      "def": 28,
      "as": 0.76,
      "amp": 90,
      "range": 2
    },
    "implemented": false,
    "main": "amp"
  },
  {
    "id": "nadine",
    "name": "나딘",
    "cost": 3,
    "role": "원거리 평타",
    "affiliations": [
      "데몬헌터"
    ],
    "baseStats": {
      "hp": 730,
      "atk": 67,
      "def": 17,
      "as": 0.94,
      "amp": 20,
      "range": 3
    },
    "implemented": false,
    "main": "amp"
  },
  {
    "id": "bernice",
    "name": "버니스",
    "cost": 2,
    "role": "원거리 평타",
    "affiliations": [
      "데몬헌터"
    ],
    "baseStats": {
      "hp": 780,
      "atk": 58,
      "def": 22,
      "as": 0.72,
      "amp": 18,
      "range": 2
    },
    "implemented": false,
    "main": "amp"
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
      "def": 16,
      "as": 0.78,
      "amp": 18,
      "range": 3
    },
    "implemented": false,
    "main": "amp"
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
      "def": 18,
      "as": 0.82,
      "amp": 128,
      "range": 3
    },
    "implemented": false,
    "main": "amp"
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
      "def": 58,
      "as": 0.72,
      "amp": 36,
      "range": 1
    },
    "implemented": false,
    "main": "amp"
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
      "def": 29,
      "as": 0.75,
      "amp": 94,
      "range": 2
    },
    "implemented": false,
    "main": "amp"
  }
];
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value)}return value}
const api=freeze({roster,byId:Object.fromEntries(roster.map(r=>[r.id,r]))});
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ERRoster=api;
})(globalThis);
