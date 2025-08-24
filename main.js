 const HOURS_START = 6;   // 6:00
    const HOURS_END   = 22;  // 22:00

    const $grid = document.getElementById('grid');
    const $slotTpl = document.getElementById('slotTemplate');
    const $taskTpl = document.getElementById('taskTemplate');

    const $date = document.getElementById('datePicker');
    const $prev = document.getElementById('prevDay');
    const $next = document.getElementById('nextDay');
    const $today = document.getElementById('todayBtn');
    const $search = document.getElementById('searchInput');
    const $theme = document.getElementById('themeBtn');
    const $export = document.getElementById('exportBtn');
    const $import = document.getElementById('importInput');
    const $clearDay = document.getElementById('clearDayBtn');

    const STORAGE_KEY = 'day-planner-v1';

    const store = {
      load() { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); },
      save(data) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); },
      for(date) { const d = this.load(); return d[date] || []; },
      set(date, tasks) { const d = this.load(); d[date] = tasks; this.save(d); },
      all() { return this.load(); }
    };

    function fmtDate(d) { return d.toISOString().slice(0,10); }
    function parseDate(str) { const d = new Date(str + 'T00:00'); return d; }
    function hourLabel(h) {
      const ampm = h >= 12 ? 'PM' : 'AM';
      const display = ((h + 11) % 12 + 1);
      return `${display} ${ampm}`;
    }

    // THEME
    /*
    (function initTheme(){
      const saved = localStorage.getItem('theme') || 'dark';
      if(saved === 'light') document.body.classList.add('light');
      $theme.addEventListener('click', () => {
        document.body.classList.toggle('light');
        localStorage.setItem('theme', document.body.classList.contains('light') ? 'light' : 'dark');
      });
    })();*/

    (function initTheme() {
  const $themeBtn = document.getElementById('themeBtn');
  const themes = ["dark", "light", "blue", "green"];

  // Load saved theme or default
  let current = localStorage.getItem('theme') || 'dark';
  document.body.className = current;

  // On click → switch to next theme
  $themeBtn.addEventListener('click', () => {
    let next = themes[(themes.indexOf(current) + 1) % themes.length];
    document.body.className = next;
    localStorage.setItem('theme', next);
    current = next;
  });
})();

    // DATE CONTROLS
    (function initDate(){
      const today = new Date();
      $date.value = fmtDate(today);
      $prev.onclick = () => { moveDay(-1); };
      $next.onclick = () => { moveDay(+1); };
      $today.onclick = () => { $date.value = fmtDate(new Date()); render(); };
      $date.addEventListener('change', render);
      document.addEventListener('keydown', (e)=>{
        if(e.key.toLowerCase() === 't') { $today.click(); }
      });
    })();

    // SEARCH
    $search.addEventListener('input', ()=> filterTasks($search.value.trim().toLowerCase()));

    // EXPORT / IMPORT
    $export.addEventListener('click', ()=>{
      const data = store.all();
      const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'day-planner-data.json';
      a.click();
      URL.revokeObjectURL(a.href);
    });

    $import.addEventListener('change', async (e)=>{
      const file = e.target.files[0]; if(!file) return;
      const text = await file.text();
      try {
        const json = JSON.parse(text);
        const all = store.all();
        const merged = { ...all, ...json };
        store.save(merged);
        render();
        alert('Import complete.');
      } catch(err){
        alert('Invalid file.');
      }
      e.target.value = '';
    });

    $clearDay.addEventListener('click', ()=>{
      if(!confirm('Clear all tasks for this day?')) return;
      store.set($date.value, []);
      render();
    });

    function moveDay(delta){
      const d = parseDate($date.value);
      d.setDate(d.getDate() + delta);
      $date.value = fmtDate(d);
      render();
    }

    function render(){
      // Build grid skeleton
      $grid.innerHTML = '';
      const now = new Date();
      const isToday = fmtDate(now) === $date.value;

      for(let h = HOURS_START; h <= HOURS_END; h++){
        const frag = $slotTpl.content.cloneNode(true);
        const hourEl = frag.querySelector('.hour');
        const slot = frag.querySelector('.slot');
        const addBtn = frag.querySelector('.addTask');
        const newTask = frag.querySelector('.new-task');
        const createBtn = frag.querySelector('.createBtn');
        const input = newTask.querySelector('input');
        const select = newTask.querySelector('select');

        hourEl.textContent = hourLabel(h);
        slot.dataset.hour = String(h);
        if(isToday && now.getHours() === h) slot.classList.add('now');

        addBtn.addEventListener('click', ()=>{
          newTask.classList.toggle('visible');
          input.focus();
        });
        createBtn.addEventListener('click', ()=>{
          const text = input.value.trim();
          if(!text) return;
          const pri = select.value;
          addTaskToHour(h, text, pri);
          input.value='';
          newTask.classList.remove('visible');
        });
        input.addEventListener('keydown', (e)=>{
          if(e.key==='Enter'){ e.preventDefault(); createBtn.click(); }
          if(e.key==='Escape'){ newTask.classList.remove('visible'); }
        });

        // DnD events on slot
        slot.addEventListener('dragover', (e)=>{ e.preventDefault(); });
        slot.addEventListener('drop', (e)=>{
          e.preventDefault();
          const id = e.dataTransfer.getData('text/plain');
          moveTaskToHour(id, h);
        });

        $grid.appendChild(frag);
      }

      // Render tasks
      const tasks = store.for($date.value);
      tasks.sort((a,b)=> (a.hour - b.hour) || (a.order - b.order));
      for(const t of tasks){
        const slot = $grid.querySelector(`.slot[data-hour="${t.hour}"]`);
        if(!slot) continue;
        const wrap = slot.querySelector('.tasks');
        wrap.appendChild(renderTask(t));
      }

      filterTasks($search.value.trim().toLowerCase());
    }

    function renderTask(t){
      const node = $taskTpl.content.cloneNode(true).children[0];
      node.dataset.id = t.id;
      node.querySelector('.txt').textContent = t.text;
      node.querySelector('input[type="checkbox"]').checked = !!t.done;
      if(t.done) node.classList.add('done');
      const badge = node.querySelector('.badge');
      badge.textContent = ({low:'Low', med:'Medium', high:'High'})[t.priority] || 'Medium';
      badge.classList.remove('pri-low','pri-med','pri-high');
      badge.classList.add(`pri-${t.priority}`);

      // checkbox
      node.querySelector('input').addEventListener('change', (e)=>{
        t.done = e.target.checked; saveTask(t); node.classList.toggle('done', t.done);
      });

      // edit
      node.querySelector('.editBtn').addEventListener('click', ()=>{
        const txt = node.querySelector('.txt');
        const editing = txt.getAttribute('contenteditable') === 'true';
        if(!editing){
          txt.setAttribute('contenteditable','true'); txt.focus();
          placeCaretAtEnd(txt);
        } else {
          txt.setAttribute('contenteditable','false');
          const val = txt.textContent.trim();
          if(val){ t.text = val; saveTask(t); } else { deleteTask(t.id); node.remove(); }
        }
      });

      // delete
      node.querySelector('.delBtn').addEventListener('click', ()=>{
        if(confirm('Delete this task?')){ deleteTask(t.id); node.remove(); }
      });

      // DnD
      node.addEventListener('dragstart', (e)=>{
        node.classList.add('dragging');
        e.dataTransfer.setData('text/plain', t.id);
      });
      node.addEventListener('dragend', ()=> node.classList.remove('dragging'));

      // dblclick to quick edit
      node.addEventListener('dblclick', ()=> node.querySelector('.editBtn').click());

      return node;
    }

    function addTaskToHour(hour, text, priority='med'){
      const list = store.for($date.value);
      const id = crypto.randomUUID();
      const order = (Math.max(-1, ...list.filter(x=>x.hour===hour).map(x=>x.order)) + 1) || 0;
      list.push({ id, text, hour, priority, done:false, order });
      store.set($date.value, list);
      render();
    }

    function moveTaskToHour(id, hour){
      const list = store.for($date.value);
      const t = list.find(x=>x.id===id); if(!t) return;
      t.hour = hour;
      t.order = (Math.max(-1, ...list.filter(x=>x.hour===hour).map(x=>x.order)) + 1) || 0;
      store.set($date.value, list);
      render();
    }

    function saveTask(t){
      const list = store.for($date.value);
      const idx = list.findIndex(x=>x.id===t.id);
      if(idx>=0){ list[idx] = t; store.set($date.value, list); }
    }

    function deleteTask(id){
      const list = store.for($date.value).filter(x=>x.id!==id);
      store.set($date.value, list);
    }

    function filterTasks(q){
      const items = Array.from(document.querySelectorAll('.task'));
      if(!q){ items.forEach(el=> el.style.display='grid'); return; }
      items.forEach(el=>{
        const text = el.querySelector('.txt').textContent.toLowerCase();
        el.style.display = text.includes(q) ? 'grid' : 'none';
      });
    }

    function placeCaretAtEnd(el){
      const range = document.createRange(); range.selectNodeContents(el); range.collapse(false);
      const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
    }

    // Keyboard: add new task to focused hour slot
    document.addEventListener('keydown', (e)=>{
      if(e.key.toLowerCase() === 'n'){
        const slot = document.activeElement.closest?.('.slot') || document.querySelector('.slot.now') || document.querySelector('.slot');
        slot?.querySelector('.addTask')?.click();
      }
    });

    // Initial render
    render();