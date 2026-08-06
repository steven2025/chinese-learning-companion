// 临时教材字库：发展汉语·中级综合（Ⅰ）第1—2课
const HANZI_DATA = [
  {
    "char": "闻",
    "pinyin": "wén",
    "meaning": "“闻名”的“闻”，表示有名",
    "category": "第1课",
    "emoji": "①"
  },
  {
    "char": "误",
    "pinyin": "wù",
    "meaning": "“误解”的“误”，表示错误",
    "category": "第1课",
    "emoji": "①"
  },
  {
    "char": "拥",
    "pinyin": "yōng",
    "meaning": "“拥挤”的“拥”，表示挤在一起",
    "category": "第1课",
    "emoji": "①"
  },
  {
    "char": "客",
    "pinyin": "kè",
    "meaning": "“顾客”的“客”，接受服务的人",
    "category": "第1课",
    "emoji": "①"
  },
  {
    "char": "分",
    "pinyin": "fēn",
    "meaning": "“分享”的“分”，分开或分给",
    "category": "第1课",
    "emoji": "①"
  },
  {
    "char": "盒",
    "pinyin": "hé",
    "meaning": "“饭盒”的“盒”，装东西的器具",
    "category": "第1课",
    "emoji": "①"
  },
  {
    "char": "轮",
    "pinyin": "lún",
    "meaning": "“轮到”的“轮”，依次替换",
    "category": "第1课",
    "emoji": "①"
  },
  {
    "char": "松",
    "pinyin": "sōng",
    "meaning": "“放松”的“松”，不紧张",
    "category": "第1课",
    "emoji": "①"
  },
  {
    "char": "招",
    "pinyin": "zhāo",
    "meaning": "“招牌”的“招”，招引或招呼",
    "category": "第1课",
    "emoji": "①"
  },
  {
    "char": "影",
    "pinyin": "yǐng",
    "meaning": "“身影”的“影”，人或物的形象",
    "category": "第1课",
    "emoji": "①"
  },
  {
    "char": "祖",
    "pinyin": "zǔ",
    "meaning": "“外祖母”的“祖”，祖辈",
    "category": "第2课",
    "emoji": "②"
  },
  {
    "char": "消",
    "pinyin": "xiāo",
    "meaning": "“消除”的“消”，使不存在",
    "category": "第2课",
    "emoji": "②"
  },
  {
    "char": "悲",
    "pinyin": "bēi",
    "meaning": "“悲伤”的“悲”，伤心",
    "category": "第2课",
    "emoji": "②"
  },
  {
    "char": "扑",
    "pinyin": "pū",
    "meaning": "向前猛冲或用力拍打",
    "category": "第2课",
    "emoji": "②"
  },
  {
    "char": "坪",
    "pinyin": "píng",
    "meaning": "“草坪”的“坪”，平坦的场地",
    "category": "第2课",
    "emoji": "②"
  },
  {
    "char": "慰",
    "pinyin": "wèi",
    "meaning": "“安慰”的“慰”，使心情平静",
    "category": "第2课",
    "emoji": "②"
  },
  {
    "char": "谜",
    "pinyin": "mí",
    "meaning": "“谜语”的“谜”，需要猜的内容",
    "category": "第2课",
    "emoji": "②"
  },
  {
    "char": "箭",
    "pinyin": "jiàn",
    "meaning": "用弓发射的兵器",
    "category": "第2课",
    "emoji": "②"
  },
  {
    "char": "赢",
    "pinyin": "yíng",
    "meaning": "比赛中获得胜利",
    "category": "第2课",
    "emoji": "②"
  },
  {
    "char": "途",
    "pinyin": "tú",
    "meaning": "“用途”的“途”，道路或作用",
    "category": "第2课",
    "emoji": "②"
  }
];

function getTotalLevels() { return Math.ceil(HANZI_DATA.length / 10); }
function getLevelData(level) { return HANZI_DATA.slice((level - 1) * 10, level * 10); }
function getSimilarChars(char, count = 3) { return shuffleArray(HANZI_DATA.map((item) => item.char).filter((item) => item !== char)).slice(0, count); }
function shuffleArray(items) { const copy = [...items]; for (let index = copy.length - 1; index > 0; index -= 1) { const target = Math.floor(Math.random() * (index + 1)); [copy[index], copy[target]] = [copy[target], copy[index]]; } return copy; }
