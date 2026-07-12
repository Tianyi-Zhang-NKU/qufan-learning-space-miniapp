const state = {
  session: null,
  packages: [],
  editingPackage: null
};

const $ = (selector) => document.querySelector(selector);

async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.message || '请求失败');
  return body;
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[character]));
}

function statusText(status) {
  return status === 'published' ? '已发布' : '草稿';
}

function notify(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  window.setTimeout(() => toast.remove(), 2800);
}

function renderPackages() {
  const grid = $('#packageGrid');
  const empty = $('#packageEmpty');
  grid.innerHTML = state.packages.map((item) => `
    <article class="package-card">
      <div class="package-card-head">
        <span class="status-pill ${item.status}">${statusText(item.status)}</span>
        <span class="version-label">v${item.version}</span>
      </div>
      <h3>${escapeHtml(item.title)}</h3>
      <p class="package-meta">${escapeHtml(item.grade)} · ${escapeHtml(item.subject)} · ${escapeHtml(item.term || '未设置学期')}</p>
      <div class="package-stats"><span>${item.units.length} 个题目单元</span><span>${item.publishedScopeCount} 个发布范围</span></div>
      <div class="package-units">${item.units.slice(0, 3).map((unit) => `<span>${escapeHtml(unit.title)}</span>`).join('') || '<span>尚未建立题目单元</span>'}</div>
      <div class="package-actions">
        <button class="secondary-button edit-package" data-id="${item.id}">编辑为新版本</button>
        ${item.status === 'draft' ? `<button class="primary-button publish-package" data-id="${item.id}">发布</button>` : ''}
      </div>
    </article>
  `).join('');
  grid.classList.toggle('hidden', !state.packages.length);
  empty.classList.toggle('hidden', state.packages.length > 0);
  grid.querySelectorAll('.edit-package').forEach((button) => button.addEventListener('click', () => openEditor(state.packages.find((item) => item.id === button.dataset.id))));
  grid.querySelectorAll('.publish-package').forEach((button) => button.addEventListener('click', () => publishMaterialPackage(button.dataset.id)));
}

async function loadPackages() {
  const params = new URLSearchParams();
  ['grade', 'subject', 'status'].forEach((key) => {
    const value = $(`#${key}Filter`).value;
    if (value) params.set(key, value);
  });
  const result = await request(`/api/research/material-packages?${params}`);
  state.packages = result.packages || [];
  renderPackages();
}

function addUnit(unit = {}) {
  const fragment = $('#unitTemplate').content.cloneNode(true);
  const row = fragment.querySelector('.unit-row');
  row.querySelector('.unit-title').value = unit.title || '';
  row.querySelector('.unit-type').value = unit.unitType || 'standalone';
  row.querySelector('.remove-unit').addEventListener('click', () => {
    row.remove();
    refreshUnitIndexes();
  });
  $('#unitList').appendChild(fragment);
  refreshUnitIndexes();
}

function refreshUnitIndexes() {
  [...document.querySelectorAll('.unit-row')].forEach((row, index) => {
    row.querySelector('.unit-index').textContent = String(index + 1);
  });
}

function openEditor(materialPackage = null) {
  state.editingPackage = materialPackage;
  $('#editorTitle').textContent = materialPackage ? `修订 ${materialPackage.title}` : '新建资料包';
  $('#packageTitle').value = materialPackage ? materialPackage.title : '';
  $('#packageTerm').value = materialPackage ? materialPackage.term || '' : '';
  $('#packageGrade').value = materialPackage ? materialPackage.grade : '';
  $('#packageSubject').value = materialPackage ? materialPackage.subject : '';
  $('#unitList').innerHTML = '';
  (materialPackage && materialPackage.units.length ? materialPackage.units : [{}]).forEach(addUnit);
  $('#editorDialog').showModal();
}

function closeEditor() {
  $('#editorDialog').close();
  state.editingPackage = null;
}

function collectPackagePayload() {
  const units = [...document.querySelectorAll('.unit-row')].map((row, index) => ({
    title: row.querySelector('.unit-title').value.trim(),
    unitType: row.querySelector('.unit-type').value,
    selectable: true,
    order: index + 1
  })).filter((unit) => unit.title);
  return {
    id: state.editingPackage ? state.editingPackage.id : '',
    title: $('#packageTitle').value.trim(),
    term: $('#packageTerm').value.trim(),
    grade: $('#packageGrade').value,
    subject: $('#packageSubject').value,
    units
  };
}

async function saveDraft() {
  const materialPackage = await request('/api/research/material-packages', { method: 'POST', body: JSON.stringify(collectPackagePayload()) });
  state.editingPackage = materialPackage;
  notify('草稿已保存', 'success');
  await loadPackages();
  return materialPackage;
}

async function publishMaterialPackage(packageId) {
  await request('/api/research/material-packages/publish', { method: 'POST', body: JSON.stringify({ packageId }) });
  notify('资料包已发布', 'success');
  await loadPackages();
}

async function submitPackage(event) {
  event.preventDefault();
  try {
    const materialPackage = await saveDraft();
    await publishMaterialPackage(materialPackage.id);
    const courseId = $('#bindCourseId').value.trim();
    const courseSessionId = $('#bindSessionId').value.trim();
    if (courseId && courseSessionId) {
      await request('/api/research/material-bindings', { method: 'POST', body: JSON.stringify({ courseId, courseSessionId, packageId: materialPackage.id }) });
      notify('资料包已发布并绑定课次', 'success');
    }
    closeEditor();
  } catch (error) {
    notify(error.message || '资料包保存失败', 'error');
  }
}

async function login(event) {
  event.preventDefault();
  try {
    state.session = await request('/api/auth/phone-login', { method: 'POST', body: JSON.stringify({ phone: $('#phoneInput').value.trim() }) });
    if (state.session.role !== 'admin' && state.session.role !== 'researcher') throw new Error('该手机号没有教研或管理员身份。');
    $('#accountName').textContent = state.session.displayName;
    $('#loginView').classList.add('hidden');
    $('#appView').classList.remove('hidden');
    await loadPackages();
  } catch (error) {
    notify(error.message || '登录失败', 'error');
  }
}

$('#loginForm').addEventListener('submit', login);
$('#logoutButton').addEventListener('click', async () => {
  await request('/api/auth/logout', { method: 'POST', body: '{}' });
  $('#appView').classList.add('hidden');
  $('#loginView').classList.remove('hidden');
});
$('#newPackageButton').addEventListener('click', () => openEditor());
$('#closeEditorButton').addEventListener('click', closeEditor);
$('#addUnitButton').addEventListener('click', () => addUnit());
$('#saveDraftButton').addEventListener('click', () => saveDraft().catch((error) => notify(error.message, 'error')));
$('#packageForm').addEventListener('submit', submitPackage);
['gradeFilter', 'subjectFilter', 'statusFilter'].forEach((id) => $( `#${id}`).addEventListener('change', () => loadPackages().catch((error) => notify(error.message, 'error'))));
