window.LISTENING_SPEAKING_DEMO = Object.freeze({
  dictation: {
    id: "dc-e1-l01-001",
    text: "我每天坐地铁去学校。",
    hint: "句子有九个汉字，关键词是“每天、地铁、学校”。",
    tiles: ["学校", "每天", "我", "去", "地铁", "坐"],
    keySentence: "我每天坐地铁去学校。"
  },
  listeningTest: {
    id: "lt-e1-l01-001",
    audioText: "男：我们明天上午见面，可以吗？女：上午我有课，下午三点怎么样？男：好，明天下午三点见。",
    answer: "C",
    keySentence: "我们明天下午三点见。"
  },
  reading: {
    repeat: { text: "我每天坐地铁去学校。", pinyin: "Wǒ měitiān zuò dìtiě qù xuéxiào." },
    oral: { text: "今天天气很好，我们一起去公园散步吧。", pinyin: "Jīntiān tiānqì hěn hǎo, wǒmen yìqǐ qù gōngyuán sànbù ba." }
  },
  scenarios: {
    restaurant: { title: "在餐厅点一份午饭和一杯饮料", opening: "你好，欢迎光临！请问你想吃点儿什么？", reply: "好的。你还想喝点儿什么？", rounds: 6 },
    shopping: { title: "询问商品价格、颜色和大小", opening: "你好，你想买什么？", reply: "有的。你喜欢什么颜色？", rounds: 6 },
    directions: { title: "询问去地铁站的路线", opening: "你好，请问你要去哪里？", reply: "地铁站离这里不远。你一直往前走。", rounds: 8 },
    campus: { title: "和同学讨论今天的课程安排", opening: "你今天上午有什么课？", reply: "我也有汉语课。下课以后一起吃饭吧。", rounds: 8 }
  }
});
