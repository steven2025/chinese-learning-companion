(function (root) {
  'use strict';
  const labels = {objective:'客观练习',subjective:'主观练习',vocabulary:'词语',text:'课文跟读',phonetics:'语音',writing:'写作',practice:'练习'};
  const value = x => x == null ? '' : typeof x === 'object' ? JSON.stringify(x, null, 2) : String(x);
  const title = x => typeof x === 'object' && x ? x['zh-CN'] || x.en || value(x) : value(x);
  function catalog(sources) {
    const entries = [];
    const add = (area, id, prompt, reference, number, options) => { if(id) entries.push({area,id,prompt:title(prompt),reference:value(reference),number:number || '',options}); };
    const subjective = new Set(['rewrite','openDialogue','shortAnswer','personalReflection','guidedProduction','guidedWriting','dialogueCompletion','cultureComparison','needsReview']);
    let n = 0;
    for (const section of sources.practice?.sections || []) for (const group of section.groups?.length ? section.groups : [section]) for (const item of group.items || []) {
      n++;
      add(subjective.has(item.type)?'subjective':'objective',item.id,
        [title(section.title),title(group !== section ? group.title : ''),title(section.instruction),title(item.prompt || item.question || item.title),item.items ? value(item.items) : '',item.blanks ? value(item.blanks) : ''].filter(Boolean).join('\n'),
        item.answer ?? item.answers, item.displayNumber || n,item.options || item.choices);
    }
    (sources.vocabulary?.entries || []).forEach((w,i)=>add('vocabulary',w.id,`${w.hanzi || ''} ${w.pinyin || ''}`,'',i+1));
    (sources.text?.cues || []).filter(c=>c.role==='sentence').forEach((c,i)=>add('text',c.id,c.texts?.['zh-CN'],'',i+1));
    for (const chapter of sources.phonetics?.chapters || []) for(const unit of chapter.units || []) {
      const items = [...(unit.items || unit.examples || []), ...(unit.groups || []).flatMap(g=>[...(g.items || []),...(g.pairs || []).flatMap(p=>[p.left,p.right])])];
      items.forEach((item,i)=>add('phonetics',`${unit.id}-${item.id || item.cueId || item.display || i}`.replace(/[^a-zA-Z0-9_-]+/g,'-'),`${title(unit.title)}\n${item.display || item.prompt || ''}`,'',i+1));
    }
    return [...new Map(entries.map(e=>[`${e.area}:${e.id}`,e])).values()];
  }
  function answerText(snapshot, options) {
    if(snapshot == null) return '答案详情未记录';
    if(typeof snapshot !== 'object') return value(snapshot);
    let answer = snapshot.answer;
    const opts = snapshot.options || options;
    if(Array.isArray(opts) && answer != null) {
      const chosen = opts.find(o=>typeof o==='object' && String(o.id ?? o.key ?? o.value)===String(answer));
      if(chosen) answer = `${answer}．${title(chosen.text ?? chosen.label ?? chosen.content ?? chosen)}`;
    }
    return [answer == null ? '' : value(answer),Object.keys(snapshot.fields || {}).length ? value(snapshot.fields) : '', snapshot.blanks ? value(snapshot.blanks) : ''].filter(Boolean).join('\n') || '空答案';
  }
  function rows(report, entries) {
    const known = new Map(entries.map(e=>[`${e.area}:${e.id}`,e]));
    const records = report.records || {};
    for(const area of ['objective','subjective','vocabulary','text']) for(const r of records[area] || []) {
      const id = r.itemId || r.wordId || r.unitId;
      if(!known.has(`${area}:${id}`)) known.set(`${area}:${id}`,{area,id,prompt:r.label || r.hanzi || r.sectionTitle || id,number:r.questionNumber || r.order || '',reference:''});
    }
    const out = [];
    for(const student of report.students || []) {
      for(const entry of known.values()) {
        const r = (records[entry.area] || []).find(r=>r.studentId===student.userId && (r.itemId || r.wordId || r.unitId)===entry.id);
        const events = (records.events || []).filter(e=>e.studentId===student.userId && e.itemId===entry.id && (e.area===entry.area || (e.area==='practice' && ['objective','subjective'].includes(entry.area)))).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
        const assessments = (report.assessments || []).filter(a=>a.studentId===student.userId && a.unitId===entry.id);
        const latest = r?.latestAnswer ?? events.filter(e=>e.action==='submit').at(-1)?.answer;
        const lastAssessment = assessments.filter(a=>a.status==='completed').sort((a,b)=>a.createdAt.localeCompare(b.createdAt)).at(-1);
        const aiHelpCount = events.filter(e=>e.action==='ai-help').length;
        const assessmentCount = Number(r?.assessmentCount || r?.assessments || assessments.length || 0);
        out.push({...entry,studentId:student.userId,name:student.name || student.englishName || student.userId,
          recorded:Boolean(r || events.length || assessments.length), answer:r || events.length ? answerText(latest,entry.options) : '无云端作答记录',
          firstScore:r?.firstScore ?? null,score:r?.latestScore ?? lastAssessment?.result?.scores?.suggestedScore ?? null,
          attempts:r?.attempts ?? r?.submissions ?? events.filter(e=>e.action==='submit').length,
          activity:r ? `查看 ${r.views ?? '—'}；播放 ${r.plays ?? '—'}；录音 ${r.recordings ?? '—'}` : '未记录',
          ai:assessmentCount || aiHelpCount ? `测评 ${assessmentCount} 次；AI提示 ${aiHelpCount} 次` : '没有可确认的AI使用记录',
          feedback:lastAssessment ? value(lastAssessment.result?.advice || '反馈未记录') : '反馈未记录',
          events,updatedAt:r?.lastAttemptAt || r?.lastSubmittedAt || r?.lastStudiedAt || events.at(-1)?.createdAt || lastAssessment?.createdAt || ''});
      }
      // Keep valid assessment records even when a historical catalog has changed.
      for(const a of report.assessments || []) if(a.studentId===student.userId && !out.some(r=>r.studentId===student.userId && r.id===a.unitId)) {
        out.push({area:a.type==='writing-review'?'writing':'phonetics',id:a.unitId,number:'',prompt:a.referenceText || a.unitId,reference:'',studentId:student.userId,name:student.name || student.englishName || student.userId,recorded:true,answer:'原始作答内容未记录',score:a.result?.scores?.suggestedScore ?? a.result?.scores?.total ?? null,firstScore:null,attempts:0,activity:'测评记录',ai:`${a.type} · ${a.status}`,feedback:value(a.result?.advice || '反馈未记录'),events:[],updatedAt:a.createdAt});
      }
    }
    return out;
  }
  function detailTable(data) {
    return [['姓名','学号','部分','题号','项目ID','题目','选项','参考答案／参考表达','学生答案','记录状态','首次分数','最新分数','提交次数','学习动作','AI使用','反馈摘要','最后记录时间'],...data.map(r=>[r.name,r.studentId,labels[r.area] || r.area,r.number,r.id,r.prompt,value(r.options),r.reference,r.answer,r.recorded?'有记录':'无云端记录',r.firstScore ?? '未记录',r.score ?? '未记录',r.attempts,r.activity,r.ai,r.feedback,r.updatedAt])];
  }
  function historyTable(data) {
    return [['姓名','学号','部分','题号','项目ID','时间','动作','原始答案','分数'],...data.flatMap(r=>r.events.map(e=>[r.name,r.studentId,labels[r.area] || r.area,r.number,r.id,e.createdAt,e.action,answerText(e.answer,r.options),e.score ?? '未评分']))];
  }
  const api = {catalog,rows,answerText,detailTable,historyTable,labels,value};
  if(typeof module==='object' && module.exports) module.exports=api; else root.TeacherInsightModel=api;
})(typeof window==='object'?window:globalThis);
