// Certification Desk: renders tools/desk-batch.oui (OpenUI Lang written by
// the movie-watchlist-updater skill) with the same self-hosted OpenUI
// bundle the app's Pre-show uses. Button presses are only recorded and
// summarized here; Claude applies them after Tony pastes the summary back.
(function(){
  const status = document.getElementById('deskStatus');
  const list = document.getElementById('deskChoices');
  const summary = document.getElementById('deskSummary');
  const choices = [];

  function formValues(formState){
    // formState is { formName: { field: { value, componentType } } }.
    const out = [];
    Object.entries(formState || {}).forEach(([formName, fields])=>{
      if(formName.startsWith('$') || !fields || typeof fields !== 'object') return;
      Object.entries(fields).forEach(([field, entry])=>{
        const value = entry && typeof entry === 'object' && 'value' in entry ? entry.value : entry;
        out.push(`${field} = ${Array.isArray(value) ? value.join(', ') : value}`);
      });
    });
    return out;
  }

  function renderChoices(){
    list.replaceChildren();
    const lines = ['Certification Desk choices (batch: tools/desk-batch.oui)'];
    choices.forEach((choice, i)=>{
      const li = document.createElement('li');
      li.textContent = choice.message + (choice.fields.length ? ` [${choice.fields.join('; ')}]` : '');
      list.appendChild(li);
      lines.push(`${i + 1}. ${li.textContent}`);
    });
    if(!choices.length) lines.push('(no choices yet)');
    summary.value = lines.join('\n');
  }

  function onAction(event){
    const message = (event && (event.params && event.params.message)) || (event && event.humanFriendlyMessage) || '(unnamed action)';
    choices.push({ message: String(message), fields: formValues(event && event.formState) });
    renderChoices();
  }

  document.getElementById('deskCopy').addEventListener('click', ()=>{
    summary.select();
    const done = () => { status.classList.remove('error'); status.textContent = 'Summary copied. Paste it back to Claude.'; };
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(summary.value).then(done, () => { document.execCommand('copy'); done(); });
    }else{
      document.execCommand('copy');
      done();
    }
  });
  document.getElementById('deskClear').addEventListener('click', ()=>{ choices.length = 0; renderChoices(); });
  renderChoices();

  if(!window.__OpenUI){
    status.classList.add('error');
    status.textContent = "The OpenUI bundle didn't load (expected at assets/openui-0.1.4/).";
    return;
  }
  const { React, createRoot, Renderer, openuiChatLibrary } = window.__OpenUI;
  fetch('desk-batch.oui', { cache: 'no-store' })
    .then(res => res.ok ? res.text() : Promise.reject(new Error(`HTTP ${res.status}`)))
    .then(code=>{
      status.textContent = '';
      createRoot(document.getElementById('deskBatch')).render(React.createElement(Renderer, {
        response: code,
        library: openuiChatLibrary,
        onAction,
        onError: errors=>{
          const real = (errors || []).filter(e => e.severity !== 'warning');
          if(!real.length) return;
          status.classList.add('error');
          status.textContent = 'desk-batch.oui has errors: ' + real.map(e => e.message || e.code || String(e)).join(' | ');
        }
      }));
    })
    .catch(err=>{
      status.classList.add('error');
      status.textContent = `Couldn't read tools/desk-batch.oui (${err.message}). Open this page through the local server, not file://.`;
    });
})();
