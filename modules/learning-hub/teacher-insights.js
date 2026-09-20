(function () {
  'use strict';
  const M = window.TeacherInsightModel;
  const panel = document.querySelector('#teacherPracticePanel');
  if (!panel || !M) return;
  const lesson = document.querySelector('#practiceReportLesson');
  const status = document.querySelector('#practiceReportStatus');
  const content = document.querySelector('#practiceReportContent');
  const refresh = document.querySelector('#refreshPracticeReport');
  const escape = x => String(x ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let report = null, allRows = [], selected = '', area = 'all', view = 'class', generation = 0, contextKey = '';
  const areas = ['vocabulary','phonetics','text','objective','subjective','writing'];
  panel.querySelector('.learning-report-tabs').hidden = true;
  panel.querySelector('#practiceKindTabs').hidden = true;
  panel.querySelector('h2').textContent = '班级学情';
  panel.querySelector('header p').textContent = '查看原答案、提交记录和测评反馈';
  const toolbar = document.createElement('div');
  toolbar.className = 'insight-toolbar';
  toolbar.innerHTML = '<div><button data-insight-view="class" aria-pressed="true">全班详情</button><button data-insight-view="student" aria-pressed="false">学生详情</button><button data-insight-view="removed" aria-pressed="false" hidden>已移出历史</button></div><span id="insightClassName"></span><div><button data-insight-export="student" disabled>下载该学生本课</button><button data-insight-export="class" disabled>下载全班本课</button><button data-insight-export="removed" disabled hidden>下载已移出历史</button></div>';
  panel.insertBefore(toolbar,status);
  function updateExports() {
    const activeStudents = (report?.students || []).filter(s=>s.active!==false);
    const removedStudents = (report?.students || []).filter(s=>s.active===false);
    toolbar.querySelector('[data-insight-export="student"]').disabled = !report || !selected;
    toolbar.querySelector('[data-insight-export="class"]').disabled = !activeStudents.length;
    toolbar.querySelector('[data-insight-export="removed"]').disabled = !removedStudents.length;
    toolbar.querySelector('[data-insight-export="removed"]').hidden = !removedStudents.length;
    toolbar.querySelector('[data-insight-view="removed"]').hidden = !removedStudents.length;
  }
  function table(headers, rows) {
    return `<div class="insight-scroll" tabindex="0" role="region" aria-label="学情明细，可横向及纵向滚动"><table class="insight-table"><thead><tr>${headers.map(h=>`<th scope="col">${escape(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
  }
  function render() {
    updateExports();
    if(!report) {content.innerHTML=''; return;}
    toolbar.querySelectorAll('[data-insight-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.insightView===view)));
    document.querySelector('#insightClassName').textContent=report.courseName;
    if(!report.students.length) {content.innerHTML='<p>当前班级尚无学生。</p>';return;}
    const activeStudents=report.students.filter(s=>s.active!==false);
    const removedStudents=report.students.filter(s=>s.active===false);
    if(view==='class' || view==='removed') {
      const students=view==='removed'?removedStudents:activeStudents;
      if(!students.length) {content.innerHTML=`<p>${view==='removed'?'没有已移出学生的历史记录。':'当前班级尚无在班学生。'}</p>`;return;}
      const rows = students.map(s=>{
        const own = allRows.filter(r=>r.studentId===s.userId);
        return `<tr><th scope="row"><button data-insight-student="${escape(s.userId)}">${escape(s.name || s.englishName || s.userId)}<small>${escape(s.userId)}</small></button></th>${areas.map(a=>{
          const set=own.filter(r=>r.area===a); const scored=set.filter(r=>r.score!==null && r.score!==undefined);
          return `<td><button data-insight-student="${escape(s.userId)}" data-insight-area="${a}">${set.filter(r=>r.recorded).length}/${set.length} 项有记录${scored.length?`<small>均分 ${(scored.reduce((sum,r)=>sum+Number(r.score),0)/scored.length).toFixed(1)}</small>`:''}</button></td>`;
        }).join('')}<td>${escape(own.map(r=>r.updatedAt).filter(Boolean).sort().at(-1) || '未记录')}</td></tr>`;
      });
      content.innerHTML=`<p class="insight-note">${view==='removed'?`${removedStudents.length}名已移出学生；仅供查看历史，不计入当前全班统计。`:`${activeStudents.length}名在班学生；已移出 ${removedStudents.length} 名，不计入本表。`} 点击姓名或某一部分查看原答案。数字表示“有记录项目／目录项目”，不等于完成率。</p>`+table(['学生／学号',...areas.map(a=>M.labels[a]),'最后记录'],rows);
    } else {
      const studentRows=allRows.filter(r=>r.studentId===selected);
      const selectedStudent=report.students.find(s=>s.userId===selected);
      const studentPool=selectedStudent?.active===false?removedStudents:activeStudents;
      const shown=studentRows.filter(r=>area==='all'||r.area===area);
      const rowHtml=shown.map(r=>`<tr><th scope="row">${escape(M.labels[r.area])}<small>${escape(r.number || r.id)}</small></th><td class="insight-wide">${escape(r.prompt)}${r.options?`<details><summary>选项</summary><pre>${escape(M.value(r.options))}</pre></details>`:''}${r.reference?`<details><summary>参考答案／参考表达</summary><pre>${escape(r.reference)}</pre></details>`:''}</td><td class="insight-wide"><pre>${escape(r.answer)}</pre></td><td>${r.recorded?'有记录':'无云端记录'}<small>首次：${escape(r.firstScore ?? '未记录')}<br>最新：${escape(r.score ?? '未记录')}</small></td><td>${escape(r.attempts)}<details><summary>提交过程</summary>${r.events.length?r.events.map(e=>`<p>${escape(e.createdAt)} · ${escape(e.action==='submit'?'提交':'测评')} · ${escape(e.score ?? '未评分')}<pre>${escape(M.answerText(e.answer,r.options))}</pre></p>`).join(''):'历史详细过程未记录'}</details></td><td>${escape(r.activity)}</td><td>${escape(r.ai)}<details><summary>反馈摘要</summary><pre>${escape(r.feedback)}</pre></details></td></tr>`);
      content.innerHTML=`<nav class="insight-students" aria-label="选择学生">${studentPool.map(s=>`<button data-insight-student="${escape(s.userId)}" aria-pressed="${s.userId===selected}">${escape(s.name || s.englishName || s.userId)}<small>${escape(s.userId)}${s.active===false?' · 已移出':''}</small></button>`).join('')}</nav><div class="insight-areas">${['all',...areas].map(a=>`<button data-insight-area="${a}" aria-pressed="${area===a}">${a==='all'?'全部':M.labels[a]}</button>`).join('')}</div><p class="insight-note">${selectedStudent?.active===false?'已移出学生历史 · ':''}本课 ${studentRows.length} 项 · ${studentRows.filter(r=>r.recorded).length} 项有记录 · 下载包含本课所有部分，不受当前筛选影响。</p>`+table(['部分／题号','题目','学生原答案','结果','提交次数','学习动作','AI／反馈'],rowHtml || ['<tr><td colspan="7">此部分没有目录或记录。</td></tr>']);
    }
    content.insertAdjacentHTML('beforeend',`<p class="insight-note">${(report.limitations || []).map(escape).join(' ')}</p>`);
  }
  async function fetchSource(lessonId, filename) {
    const root=window.HANZI_COMPANION_CONFIG?.runtimeDataRoot || '../../data';
    const res=await fetch(`${root}/lessons/${lessonId}/${filename}`,{cache:'no-cache'});
    if(res.status===404) return null;
    if(!res.ok) throw Error(`${filename} 读取失败 (${res.status})`);
    return res.json();
  }
  async function load() {
    const ticket=++generation;
    report=null; allRows=[]; render(); refresh.disabled=true;
    const profile=window.LearningApi?.profile?.();
    const course=window.__activeTeacherCourse;
    const courseId=window.__activeTeacherCourseId;
    if(profile?.role!=='teacher' || !courseId) {status.textContent='请在课程管理中打开一个班级，再查看学情。';refresh.disabled=false;return;}
    const bookAliases={'elementary-comprehensive-1':'beginner-comprehensive-1','cjzh-1':'beginner-comprehensive-1','zjzh-1':'intermediate-comprehensive-1'};
    const bookId=bookAliases[course?.bookId] || course?.bookId;
    const prefix={'beginner-comprehensive-1':'cjzh-1-','intermediate-comprehensive-1':'zjzh-1-'}[bookId] || '';
    if(!prefix) {status.textContent='当前教材暂未接入详细学情。';refresh.disabled=false;return;}
    if(contextKey!==courseId) {contextKey=courseId; selected=''; lesson.innerHTML=Array.from({length:5},(_,i)=>`<option value="${prefix}${i+1}">第${i+1}课</option>`).join('');}
    const lessonId=lesson.value;
    status.textContent='正在读取本课题目和已保存的学习记录…';
    try {
      if(typeof window.LearningApi?.teacherLessonDetails !== 'function') throw Error('前端学习接口客户端仍是旧版，请更新 learning-api-client.js 并刷新网站缓存');
      const [response,practice,vocabulary,text,phonetics]=await Promise.all([
        window.LearningApi.teacherLessonDetails({courseId,lessonId}),fetchSource(lessonId,'lesson-practice.json'),fetchSource(lessonId,'vocabulary-metadata.json'),fetchSource(lessonId,'text-audio.json'),fetchSource(lessonId,'pronunciation.json')]);
      if(ticket!==generation || courseId!==window.__activeTeacherCourseId) return;
      report=response.report;
      if(report.courseId!==courseId || report.lessonId!==lessonId) throw Error('学情范围不匹配，请重新选择班级');
      const sources={practice,vocabulary,text,phonetics};
      const missing=Object.entries(sources).filter(([,v])=>!v).map(([k])=>k);
      if(missing.length) report.limitations.push(`未提供的目录：${missing.join('、')}；仅展示已有记录，不将缺失目录计为已完成。`);
      allRows=M.rows(report,M.catalog(sources));
      if(!report.students.some(s=>s.userId===selected)) selected=report.students.find(s=>s.active!==false)?.userId || report.students[0]?.userId || '';
      const activeCount=report.students.filter(s=>s.active!==false).length;
      const removedCount=report.students.length-activeCount;
      status.textContent=`第${lessonId.split('-').at(-1)}课 · ${activeCount}名在班${removedCount?` · ${removedCount}名已移出`:''} · 更新于 ${new Date(report.generatedAt).toLocaleString('zh-CN')}`;
      render();
    } catch(e) {if(ticket===generation){report=null;allRows=[];render();status.textContent=`详情读取未完成：${e.message}。如提示接口不存在，请先更新 chinese-learning-api 云函数。`;}}
    finally {if(ticket===generation) refresh.disabled=false;}
  }
  function download(scope) {
    if(!report || !window.XLSX) {status.textContent='数据或 Excel 导出组件尚未准备好。';return;}
    const students=scope==='student'?report.students.filter(s=>s.userId===selected):report.students.filter(s=>scope==='removed'?s.active===false:s.active!==false);
    const ids=new Set(students.map(s=>s.userId));
    const data=allRows.filter(r=>ids.has(r.studentId));
    const summary=[['姓名','学号',...areas.map(a=>`${M.labels[a]}有记录项目数`)],...students.map(s=>[s.name || s.englishName,s.userId,...areas.map(a=>data.filter(r=>r.studentId===s.userId&&r.area===a&&r.recorded).length)])];
    const sheets=[['本课汇总',summary],['逐题答案',M.detailTable(data)],['提交记录',M.historyTable(data)],['测评反馈',[['姓名','学号','部分','项目ID','AI使用','反馈'],...data.filter(r=>r.feedback!=='反馈未记录').map(r=>[r.name,r.studentId,M.labels[r.area],r.id,r.ai,r.feedback])]],['数据说明',[['项目','内容'],['班级',report.courseName],['课次',report.lessonId],['读取时间',report.generatedAt],...(report.limitations || []).map(t=>['范围说明',t])]]];
    const wb=XLSX.utils.book_new();
    const overflow=[['工作表','数据行','列','分段序号','完整内容分段（顺序拼接）']];
    for(const [name,tableData] of sheets) {
      const safe=tableData.map((row,ri)=>row.map((cell,ci)=>{
        if(typeof cell==='string'&&cell.length>30000){for(let p=0;p<cell.length;p+=30000)overflow.push([name,ri+1,ci+1,p/30000+1,cell.slice(p,p+30000)]);return '长文本见“长文本续页”，按分段序号拼接';}return cell ?? '';
      }));
      const ws=XLSX.utils.aoa_to_sheet(safe); // Strings remain strings, never Excel formulas.
      ws['!cols']=tableData[0].map((h,i)=>({wch:i<2?18:Math.min(55,Math.max(18,h.length*2+4))}));
      ws['!autofilter']={ref:ws['!ref']};
      XLSX.utils.book_append_sheet(wb,ws,name);
    }
    if(overflow.length>1) XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(overflow),'长文本续页');
    XLSX.writeFile(wb,`${report.lessonId}-${scope==='class'?'当前全班':scope==='removed'?'已移出学生历史':selected}-学习详情.xlsx`);
  }
  panel.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.insightView){
      view=b.dataset.insightView;
      if(view==='student' && !report?.students.some(s=>s.userId===selected&&s.active!==false)) selected=report?.students.find(s=>s.active!==false)?.userId || '';
      render();
    }
    if(b.dataset.insightStudent){selected=b.dataset.insightStudent;view='student';area=b.dataset.insightArea || 'all';render();}
    else if(b.dataset.insightArea){area=b.dataset.insightArea;render();}
    if(b.dataset.insightExport)download(b.dataset.insightExport);
  });
  lesson.addEventListener('change',()=>void load()); refresh.addEventListener('click',()=>void load());
  window.PracticeAnalytics=Object.freeze({render:()=>void load()});
})();
