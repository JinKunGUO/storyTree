/**
 * AI 辅助创作页面逻辑
 */

// 状态管理
const state = {
  selectedMethod: null,
  currentStep: 1,
  sessionId: null,
  taskId: null,
  generatedData: null,
  formData: {
    // 智能导入立项
    storyIdea: '',
    genre: '',
    targetAudience: '',
    writingStyle: '',
    // AI 辅助大纲
    outlineGenre: '',
    coreIdea: '',
    // 经典仿写
    bookName: '',
    // 故事模板
    templateId: ''
  }
};

// 类型选项
const GENRES = [
  '玄幻', '奇幻', '武侠', '仙侠', '都市', '言情',
  '悬疑', '科幻', '历史', '军事', '游戏', '体育',
  '灵异', '同人', '短篇'
];

// 故事模板
const TEMPLATES = [
  { id: 1, name: '都市逆袭', description: '普通人逆袭人生，走向巅峰', genre: '都市' },
  { id: 2, name: '玄幻修仙', description: '从凡人到仙帝的修行之路', genre: '玄幻' },
  { id: 3, name: '悬疑推理', description: '层层迷雾，揭开真相', genre: '悬疑' },
  { id: 4, name: '甜宠言情', description: '甜蜜爱情，温馨日常', genre: '言情' },
  { id: 5, name: '科幻末世', description: '末日来临，人类求生', genre: '科幻' },
  { id: 6, name: '历史穿越', description: '现代人穿越古代，改变历史', genre: '历史' }
];

// DOM 元素（在 init 函数中获取，确保 DOM 已加载）
let methodCards, methodContent, loadingContainer, loadingText, resultContainer;
let previewContent, chatContainer, chatHistory, chatInput, btnSend, btnBack, btnConfirm;

// 检查登录状态
function checkAuth() {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  if (!token) {
    window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.pathname);
    return false;
  }
  return true;
}

// 初始化 DOM 元素引用
function initDOMReferences() {
  methodCards = document.getElementById('methodCards');
  methodContent = document.getElementById('methodContent');
  loadingContainer = document.getElementById('loadingContainer');
  loadingText = document.getElementById('loadingText');
  resultContainer = document.getElementById('resultContainer');
  previewContent = document.getElementById('previewContent');
  chatContainer = document.getElementById('chatContainer');
  chatHistory = document.getElementById('chatHistory');
  chatInput = document.getElementById('chatInput');
  btnSend = document.getElementById('btnSend');
  btnBack = document.getElementById('btnBack');
  btnConfirm = document.getElementById('btnConfirm');

  // 调试日志
  console.log('DOM References initialized:', {
    methodCards: !!methodCards,
    methodContent: !!methodContent
  });
}

// 绑定事件
function bindEvents() {
  initMethodCards();
  if (btnBack) btnBack.addEventListener('click', handleBack);
  if (btnConfirm) btnConfirm.addEventListener('click', handleConfirm);
  if (btnSend) btnSend.addEventListener('click', handleSendFeedback);
  if (chatInput) chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSendFeedback();
  });
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  // 检查登录状态
  if (!checkAuth()) {
    return;
  }

  // 初始化 WebSocket 连接
  if (window.StoryTreeWS) {
    window.StoryTreeWS.connect();
  }

  // 初始化 DOM 引用和事件
  initDOMReferences();
  bindEvents();
});

// 初始化方法卡片（使用事件委托）
function initMethodCards() {
  if (!methodCards) {
    console.error('methodCards element not found!');
    return;
  }

  methodCards.addEventListener('click', (e) => {
    const card = e.target.closest('.method-card');
    if (card && methodCards.contains(card)) {
      const method = card.dataset.method;
      console.log('Method selected:', method);
      selectMethod(method);
    }
  });
}

// 选择方法
function selectMethod(method) {
  state.selectedMethod = method;

  // 更新卡片选中状态
  methodCards.querySelectorAll('.method-card').forEach(card => {
    card.classList.toggle('selected', card.dataset.method === method);
  });

  // 显示对应表单
  renderMethodForm(method);

  // 滚动到表单区域
  setTimeout(() => {
    methodContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

// 渲染方法表单
function renderMethodForm(method) {
  let html = '';

  switch (method) {
    case 'project':
      html = renderProjectForm();
      break;
    case 'outline':
      html = renderOutlineForm();
      break;
    case 'pastiche':
      html = renderPasticheForm();
      break;
    case 'template':
      html = renderTemplateForm();
      break;
    case 'manual':
      html = renderManualForm();
      break;
  }

  methodContent.innerHTML = html;
  methodContent.classList.add('show');

  // 绑定表单事件
  bindFormEvents(method);
}

// 渲染智能导入立项表单
function renderProjectForm() {
  return `
    <h2 style="margin-bottom: 25px; font-size: 24px;">智能导入立项</h2>

    <div class="form-group">
      <label>你的故事想法 <span class="label-hint">（尽可能详细描述）</span></label>
      <textarea
        class="form-textarea"
        id="storyIdea"
        placeholder="例如：我想写一个关于现代人穿越到古代成为商人的故事。主角利用现代商业知识在古代建立商业帝国，同时卷入朝堂斗争。希望有商战、有权谋、也有爱情线..."
        maxlength="2000"
      ></textarea>
      <div class="char-count">0/2000</div>
    </div>

    <div class="form-group">
      <label>故事类型 <span class="label-hint">（可选）</span></label>
      <div class="genre-selector" id="genreSelector">
        ${GENRES.map(g => `<span class="genre-tag" data-genre="${g}">${g}</span>`).join('')}
      </div>
    </div>

    <div class="form-group">
      <label>目标读者 <span class="label-hint">（可选，如：男性向/女性向、年龄段）</span></label>
      <input type="text" class="form-input" id="targetAudience" placeholder="例如：18-35 岁男性读者，喜欢商战和权谋题材">
    </div>

    <div class="form-group">
      <label>期望文风 <span class="label-hint">（可选）</span></label>
      <input type="text" class="form-input" id="writingStyle" placeholder="例如：轻松幽默 / 严肃沉重 / 热血激昂">
    </div>

    <button class="btn-generate" id="btnGenerate">
      <i class="fas fa-wand-magic"></i>
      AI 整理立项书
    </button>
  `;
}

// 渲染 AI 辅助大纲表单
function renderOutlineForm() {
  return `
    <h2 style="margin-bottom: 25px; font-size: 24px;">AI 辅助大纲</h2>

    <div class="form-group">
      <label>故事类型</label>
      <div class="genre-selector" id="genreSelector">
        ${GENRES.map(g => `<span class="genre-tag" data-genre="${g}">${g}</span>`).join('')}
      </div>
    </div>

    <div class="form-group">
      <label>核心想法 <span class="label-hint">（一句话梗概）</span></label>
      <input
        type="text"
        class="form-input"
        id="coreIdea"
        placeholder="例如：现代人穿越到古代当皇帝，用现代理念治理国家"
        maxlength="500"
      >
      <div class="char-count">0/500</div>
    </div>

    <button class="btn-generate" id="btnGenerate">
      <i class="fas fa-wand-magic"></i>
      AI 生成大纲
    </button>
  `;
}

// 渲染经典仿写表单
function renderPasticheForm() {
  return `
    <h2 style="margin-bottom: 25px; font-size: 24px;">经典仿写</h2>

    <div class="form-group">
      <label>目标书名</label>
      <input
        type="text"
        class="form-input"
        id="bookName"
        placeholder="例如：三国演义、红楼梦、哈利波特..."
      >
    </div>

    <div class="form-group">
      <label>仿写类型</label>
      <select class="form-select" id="pasticheType">
        <option value="pastiche">仿写（学习原作风格）</option>
        <option value="continuation">续写（延续原作剧情）</option>
        <option value="fanfic">同人（借用原作世界观）</option>
      </select>
    </div>

    <div class="form-group">
      <label>你的创新点 <span class="label-hint">（可选，想让故事有什么新元素）</span></label>
      <textarea
        class="form-textarea"
        id="innovation"
        placeholder="例如：想把三国故事搬到现代商战背景..."
        maxlength="1000"
      ></textarea>
      <div class="char-count">0/1000</div>
    </div>

    <button class="btn-generate" id="btnGenerate">
      <i class="fas fa-wand-magic"></i>
      AI 分析并生成
    </button>
  `;
}

// 渲染故事模板表单
function renderTemplateForm() {
  return `
    <h2 style="margin-bottom: 25px; font-size: 24px;">故事模板</h2>

    <div class="form-group">
      <label>选择模板</label>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px;">
        ${TEMPLATES.map(t => `
          <div class="genre-tag" data-template-id="${t.id}" style="cursor: pointer; border: 2px solid var(--st-gray-200);">
            <strong style="display: block; margin-bottom: 5px;">${t.name}</strong>
            <span style="font-size: 12px; color: var(--st-text-tertiary);">${t.description}</span>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="form-group" id="templateForm" style="display: none;">
      <label>主角姓名</label>
      <input type="text" class="form-input" id="protagonistName" placeholder="主角名字">
    </div>

    <div class="form-group" id="templateForm" style="display: none;">
      <label>核心冲突 <span class="label-hint">（可选）</span></label>
      <input type="text" class="form-input" id="coreConflict" placeholder="例如：家族恩怨、身份认同、理想与现实">
    </div>

    <button class="btn-generate" id="btnGenerate" style="display: none;">
      <i class="fas fa-wand-magic"></i>
      AI 生成故事
    </button>
  `;
}

// 渲染直接创建表单
function renderManualForm() {
  return `
    <h2 style="margin-bottom: 25px; font-size: 24px;">直接创建故事</h2>

    <div class="form-group">
      <label>故事标题 <span class="label-hint">（必填）</span></label>
      <input type="text" class="form-input" id="manualTitle" placeholder="给你的故事起一个吸引人的标题" maxlength="50">
      <div class="char-count">0/50</div>
    </div>

    <div class="form-group">
      <label>故事简介 <span class="label-hint">（必填）</span></label>
      <textarea
        class="form-textarea"
        id="manualDescription"
        placeholder="用几句话描述你的故事核心内容，让读者快速了解故事的主题和看点"
        maxlength="500"
      ></textarea>
      <div class="char-count">0/500</div>
    </div>

    <div class="form-group">
      <label>故事类型</label>
      <select class="form-select" id="manualGenre">
        <option value="">请选择类型</option>
        ${GENRES.map(g => `<option value="${g}">${g}</option>`).join('')}
      </select>
    </div>

    <button class="btn-generate" id="btnManualCreate">
      <i class="fas fa-rocket"></i>
      创建故事
    </button>
  `;
}

// 绑定表单事件
function bindFormEvents(method) {
  const genreSelector = document.getElementById('genreSelector');
  const btnGenerate = document.getElementById('btnGenerate');

  if (genreSelector) {
    genreSelector.querySelectorAll('.genre-tag').forEach(tag => {
      tag.addEventListener('click', () => {
        genreSelector.querySelectorAll('.genre-tag').forEach(t => t.classList.remove('selected'));
        tag.classList.add('selected');

        if (method === 'project') {
          state.formData.genre = tag.dataset.genre;
        } else if (method === 'outline') {
          state.formData.outlineGenre = tag.dataset.genre;
        }
      });
    });
  }

  // 经典仿写表单绑定
  if (method === 'pastiche') {
    const bookNameInput = document.getElementById('bookName');
    const pasticheTypeSelect = document.getElementById('pasticheType');
    const innovationTextarea = document.getElementById('innovation');

    if (bookNameInput) {
      bookNameInput.addEventListener('input', (e) => {
        state.formData.bookName = e.target.value.trim();
      });
    }

    if (pasticheTypeSelect) {
      pasticheTypeSelect.addEventListener('change', (e) => {
        state.formData.pasticheType = e.target.value;
      });
    }

    if (innovationTextarea) {
      innovationTextarea.addEventListener('input', (e) => {
        state.formData.innovation = e.target.value.trim();
        const countDiv = innovationTextarea.parentElement.querySelector('.char-count');
        if (countDiv) {
          countDiv.textContent = `${e.target.value.length}/${innovationTextarea.maxLength}`;
        }
      });
    }
  }

  // 故事模板表单绑定
  if (method === 'template') {
    const templateForm = document.getElementById('templateForm');
    const btnGenerate = document.getElementById('btnGenerate');

    methodContent.querySelectorAll('[data-template-id]').forEach(card => {
      card.addEventListener('click', () => {
        methodContent.querySelectorAll('[data-template-id]').forEach(t => {
          t.style.borderColor = 'var(--st-gray-200)';
        });
        card.style.borderColor = 'var(--st-primary-500)';
        state.formData.templateId = card.dataset.templateId;
        templateForm.style.display = 'block';
        btnGenerate.style.display = 'inline-flex';
      });
    });

    // 模板表单的其他字段绑定
    const protagonistName = document.getElementById('protagonistName');
    const coreConflict = document.getElementById('coreConflict');
    const setting = document.getElementById('setting');

    if (protagonistName) {
      protagonistName.addEventListener('input', (e) => {
        state.formData.protagonistName = e.target.value.trim();
      });
    }

    if (coreConflict) {
      coreConflict.addEventListener('input', (e) => {
        state.formData.coreConflict = e.target.value.trim();
      });
    }

    if (setting) {
      setting.addEventListener('input', (e) => {
        state.formData.setting = e.target.value.trim();
      });
    }
  }

  // 智能导入立项表单绑定
  if (method === 'project') {
    const storyIdea = document.getElementById('storyIdea');
    const targetAudience = document.getElementById('targetAudience');
    const writingStyle = document.getElementById('writingStyle');

    if (storyIdea) {
      storyIdea.addEventListener('input', (e) => {
        state.formData.storyIdea = e.target.value.trim();
        const countDiv = storyIdea.parentElement.querySelector('.char-count');
        if (countDiv) {
          countDiv.textContent = `${e.target.value.length}/${storyIdea.maxLength}`;
        }
      });
    }

    if (targetAudience) {
      targetAudience.addEventListener('input', (e) => {
        state.formData.targetAudience = e.target.value.trim();
      });
    }

    if (writingStyle) {
      writingStyle.addEventListener('input', (e) => {
        state.formData.writingStyle = e.target.value.trim();
      });
    }
  }

  // AI 辅助大纲表单绑定
  if (method === 'outline') {
    const coreIdea = document.getElementById('coreIdea');

    if (coreIdea) {
      coreIdea.addEventListener('input', (e) => {
        state.formData.coreIdea = e.target.value.trim();
        const countDiv = coreIdea.parentElement.querySelector('.char-count');
        if (countDiv) {
          countDiv.textContent = `${e.target.value.length}/${coreIdea.maxLength}`;
        }
      });
    }
  }

  // 生成按钮
  if (btnGenerate) {
    btnGenerate.addEventListener('click', handleGenerate);
  }

  // 直接创建表单绑定
  if (method === 'manual') {
    const manualTitle = document.getElementById('manualTitle');
    const manualDesc = document.getElementById('manualDescription');
    const btnManualCreate = document.getElementById('btnManualCreate');

    if (manualTitle) {
      manualTitle.addEventListener('input', (e) => {
        const countDiv = manualTitle.parentElement.querySelector('.char-count');
        if (countDiv) countDiv.textContent = `${e.target.value.length}/${manualTitle.maxLength}`;
      });
    }

    if (manualDesc) {
      manualDesc.addEventListener('input', (e) => {
        const countDiv = manualDesc.parentElement.querySelector('.char-count');
        if (countDiv) countDiv.textContent = `${e.target.value.length}/${manualDesc.maxLength}`;
      });
    }

    if (btnManualCreate) {
      btnManualCreate.addEventListener('click', handleManualCreate);
    }
  }
}

// 处理生成
async function handleGenerate() {
  // 验证表单
  if (!validateForm()) return;

  // 显示加载动画
  methodContent.classList.remove('show');
  loadingContainer.classList.add('active');

  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    let response;

    switch (state.selectedMethod) {
      case 'project':
        response = await fetch('/api/ai/creation/generate-project-brief', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            storyIdea: state.formData.storyIdea,
            genre: state.formData.genre,
            targetAudience: state.formData.targetAudience,
            writingStyle: state.formData.writingStyle
          })
        });
        break;

      case 'outline':
        response = await fetch('/api/ai/creation/generate-outline', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            genre: state.formData.outlineGenre,
            coreIdea: state.formData.coreIdea
          })
        });
        break;

      case 'pastiche':
        response = await fetch('/api/ai/creation/generate-pastiche', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            bookName: state.formData.bookName,
            pasticheType: state.formData.pasticheType,
            innovation: state.formData.innovation
          })
        });
        break;

      case 'template':
        response = await fetch('/api/ai/creation/generate-from-template', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            templateId: state.formData.templateId,
            protagonistName: state.formData.protagonistName,
            coreConflict: state.formData.coreConflict,
            setting: state.formData.setting
          })
        });
        break;
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '生成失败');
    }

    // 保存会话和任务 ID
    state.sessionId = data.sessionId;
    state.taskId = data.taskId;

    // 监听任务状态（WebSocket 优先，降级轮询兜底）
    watchCreationTask(state.taskId);

  } catch (error) {
    console.error('生成失败:', error);
    alert('生成失败：' + error.message);
    loadingContainer.classList.remove('active');
    methodContent.classList.add('show');
  }
}

// 监听 AI 创作任务状态（WebSocket 优先，降级轮询兜底）
function watchCreationTask(taskId, isRevision = false) {
  // 统一的任务完成回调
  function onTaskCompleted(data) {
    loadingContainer.classList.remove('active');
    resultContainer.classList.add('active');
    methodContent.classList.remove('show');

    // 解析并显示结果
    if (state.selectedMethod === 'project') {
      state.generatedData = data.result?.projectBrief;
      renderProjectBrief(data.result?.projectBrief);
    } else if (state.selectedMethod === 'outline') {
      state.generatedData = data.result?.outline;
      renderOutline(data.result?.outline);
    } else if (state.selectedMethod === 'pastiche') {
      state.generatedData = data.result?.pastiche;
      renderPasticheResult(data.result?.pastiche);
    } else if (state.selectedMethod === 'template') {
      state.generatedData = data.result?.template;
      renderTemplateResult(data.result?.template);
    }

    // 添加初始消息
    if (isRevision) {
      addChatMessage('assistant', '修改完成！请查看更新后的内容。');
      btnSend.disabled = false;
    } else {
      addChatMessage('assistant', '生成完成！如有不满意的地方，可以提出修改意见。');
    }
  }

  function onTaskFailed(errorMessage) {
    const msg = errorMessage || (isRevision ? '修改失败' : '生成失败');
    if (isRevision) {
      addChatMessage('assistant', '修改失败：' + msg);
      btnSend.disabled = false;
    } else {
      alert('获取结果失败：' + msg);
      loadingContainer.classList.remove('active');
      methodContent.classList.add('show');
    }
  }

  // 立即做一次 API 查询，检查任务是否已完成（防止竞态：任务可能在 WS 监听注册前就已完成）
  let taskAlreadyResolved = false;

  // 包装回调，防止重复触发
  function onTaskCompletedOnce(data) {
    if (taskAlreadyResolved) return;
    taskAlreadyResolved = true;
    // 取消 WS 监听
    if (window.StoryTreeWS) {
      window.StoryTreeWS.unwatchTask(taskId);
    }
    onTaskCompleted(data);
  }

  function onTaskFailedOnce(errorMessage) {
    if (taskAlreadyResolved) return;
    taskAlreadyResolved = true;
    if (window.StoryTreeWS) {
      window.StoryTreeWS.unwatchTask(taskId);
    }
    onTaskFailed(errorMessage);
  }

  checkTaskOnce(taskId, onTaskCompletedOnce, onTaskFailedOnce);

  // 使用 WebSocket 客户端的 watchTask（WebSocket 连接时实时推送，断开时自动降级轮询）
  if (window.StoryTreeWS) {
    window.StoryTreeWS.watchTask(taskId, (data) => {
      if (data.status === 'completed') {
        // WebSocket 推送的 result 可能是简化版，需要通过 API 获取完整结果
        fetchTaskResult(taskId, onTaskCompletedOnce, onTaskFailedOnce);
      } else if (data.status === 'failed') {
        onTaskFailedOnce(data.errorMessage);
      }
    });
    console.log(`[AI 创作] 任务 ${taskId} 已注册 WebSocket 监听`);
    return;
  }

  // WebSocket 客户端不可用，回退到独立轮询（已有 checkTaskOnce 做了首次查询，这里做持续轮询）
  console.log('[AI 创作] WebSocket 不可用，使用轮询');
  fallbackPoll(taskId, onTaskCompletedOnce, onTaskFailedOnce, true); // skipFirst=true
}

// 一次性查询任务状态（用于防止竞态条件）
async function checkTaskOnce(taskId, onSuccess, onFailed) {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  try {
    const response = await fetch(`/api/ai/v2/tasks/${taskId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    if (data.status === 'completed') {
      console.log(`[AI 创作] 任务 ${taskId} 已完成（首次查询命中）`);
      onSuccess(data);
      return true;
    } else if (data.status === 'failed') {
      console.log(`[AI 创作] 任务 ${taskId} 已失败（首次查询命中）`);
      onFailed(data.errorMessage || '任务失败');
      return true;
    }
  } catch (error) {
    console.warn('[AI 创作] 首次任务状态查询失败:', error);
  }
  return false;
}

// 从 API 获取任务完整结果
async function fetchTaskResult(taskId, onSuccess, onFailed) {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  try {
    const response = await fetch(`/api/ai/v2/tasks/${taskId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    if (data.status === 'completed') {
      onSuccess(data);
    } else if (data.status === 'failed') {
      onFailed(data.errorMessage || '任务失败');
    }
    // 其他状态（如 pending/processing）不应出现在已完成推送后，但保险起见继续轮询
    else {
      fallbackPoll(taskId, onSuccess, onFailed);
    }
  } catch (error) {
    console.error('获取任务结果失败:', error);
    onFailed(error.message);
  }
}

// 降级轮询
function fallbackPoll(taskId, onSuccess, onFailed, skipFirst = false) {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  let pollInterval = 2000; // 初始 2 秒
  const maxInterval = 10000; // 最大 10 秒
  let attempts = 0;
  const maxAttempts = 120; // 最多轮询 120 次（约 10 分钟）

  const poll = async () => {
    attempts++;
    if (attempts > maxAttempts) {
      onFailed('生成超时，请稍后在创作台查看结果');
      return;
    }

    try {
      const response = await fetch(`/api/ai/v2/tasks/${taskId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();

      if (data.status === 'completed') {
        onSuccess(data);
        return;
      } else if (data.status === 'failed') {
        onFailed(data.errorMessage || '生成失败');
        return;
      }

      // 继续轮询，逐步增加间隔
      pollInterval = Math.min(pollInterval * 1.2, maxInterval);
      setTimeout(poll, pollInterval);

    } catch (error) {
      console.error('轮询失败:', error);
      // 网络错误时继续轮询
      setTimeout(poll, pollInterval);
    }
  };

  // 如果 skipFirst 为 true，延迟执行（首次查询已由 checkTaskOnce 完成）
  if (skipFirst) {
    setTimeout(poll, pollInterval);
  } else {
    poll();
  }
}

// 渲染立项书预览（可编辑版本）
function renderProjectBrief(brief) {
  if (!brief) {
    previewContent.innerHTML = '<p>未获取到立项书内容</p>';
    return;
  }

  // 确保 state.generatedData 同步
  state.generatedData = brief;

  previewContent.innerHTML = `
    <div class="preview-section">
      <h4><i class="fas fa-bookmark"></i> 故事标题</h4>
      <input type="text" class="editable-field" data-field="title" value="${escapeHtml(brief.title || '')}" placeholder="输入故事标题">
    </div>

    <div class="preview-section">
      <h4><i class="fas fa-align-left"></i> 故事梗概</h4>
      <textarea class="editable-field" data-field="synopsis" rows="4" placeholder="输入故事梗概">${escapeHtml(brief.synopsis || '')}</textarea>
    </div>

    <div class="preview-section">
      <h4><i class="fas fa-lightbulb"></i> 核心创意/卖点</h4>
      <textarea class="editable-field" data-field="coreIdea" rows="3" placeholder="输入核心创意">${escapeHtml(brief.coreIdea || '')}</textarea>
    </div>

    <div class="preview-section">
      <h4><i class="fas fa-users"></i> 目标读者群体</h4>
      <input type="text" class="editable-field" data-field="targetAudience" value="${escapeHtml(brief.targetAudience || '')}" placeholder="输入目标读者">
    </div>

    <div class="preview-section">
      <h4><i class="fas fa-tags"></i> 类型标签</h4>
      <input type="text" class="editable-field" data-field="genre" value="${escapeHtml(brief.genre || '')}" placeholder="输入类型标签，如：玄幻、都市">
    </div>

    ${brief.highlights && brief.highlights.length > 0 ? `
    <div class="preview-section">
      <h4><i class="fas fa-star"></i> 作品亮点</h4>
      <div id="highlightsList">
        ${brief.highlights.map((h, i) => `
          <div class="editable-highlight">
            <input type="text" class="editable-field" data-field="highlights" data-index="${i}" value="${escapeHtml(h)}" placeholder="输入亮点">
            <button class="btn-remove-item" onclick="removeHighlight(${i})" title="删除"><i class="fas fa-times"></i></button>
          </div>
        `).join('')}
      </div>
      <button class="btn-add-item" onclick="addHighlight()"><i class="fas fa-plus"></i> 添加亮点</button>
    </div>
    ` : ''}

    ${brief.worldBuilding ? `
    <div class="preview-section">
      <h4><i class="fas fa-globe"></i> 世界观设定</h4>
      <textarea class="editable-field" data-field="worldBuilding" rows="4" placeholder="输入世界观设定">${escapeHtml(brief.worldBuilding || '')}</textarea>
    </div>
    ` : ''}

    ${brief.characters && brief.characters.length > 0 ? `
    <div class="preview-section">
      <h4><i class="fas fa-user-friends"></i> 主要角色</h4>
      <div id="charactersList">
        ${brief.characters.map((c, i) => `
          <div class="editable-character">
            <div class="editable-character-header">
              <input type="text" class="editable-field" data-field="characterName" data-index="${i}" value="${escapeHtml(c.name || '')}" placeholder="角色名" style="flex:1;">
              <select class="editable-field" data-field="characterRole" data-index="${i}" style="flex:0 0 auto; width: 90px; max-width: 100%; padding: 8px;">
                <option value="protagonist" ${c.role === 'protagonist' ? 'selected' : ''}>主角</option>
                <option value="antagonist" ${c.role === 'antagonist' ? 'selected' : ''}>反派</option>
                <option value="supporting" ${c.role === 'supporting' ? 'selected' : ''}>配角</option>
                <option value="love_interest" ${c.role === 'love_interest' ? 'selected' : ''}>感情线</option>
              </select>
              <button class="btn-remove-item" onclick="removeCharacter(${i})" title="删除角色"><i class="fas fa-times"></i></button>
            </div>
            <textarea class="editable-field" data-field="characterDesc" data-index="${i}" rows="2" placeholder="角色描述">${escapeHtml(c.description || '')}</textarea>
          </div>
        `).join('')}
      </div>
      <button class="btn-add-item" onclick="addCharacter()"><i class="fas fa-plus"></i> 添加角色</button>
    </div>
    ` : ''}

    ${brief.plotStructure ? `
    <div class="preview-section">
      <h4><i class="fas fa-chart-pie"></i> 情节结构</h4>
      <div style="margin-bottom: 10px;">
        <strong>第一幕</strong>
        <textarea class="editable-field" data-field="plotAct1" rows="3" placeholder="第一幕内容">${escapeHtml(brief.plotStructure.act1 || '')}</textarea>
      </div>
      <div style="margin-bottom: 10px;">
        <strong>第二幕</strong>
        <textarea class="editable-field" data-field="plotAct2" rows="3" placeholder="第二幕内容">${escapeHtml(brief.plotStructure.act2 || '')}</textarea>
      </div>
      <div style="margin-bottom: 10px;">
        <strong>第三幕</strong>
        <textarea class="editable-field" data-field="plotAct3" rows="3" placeholder="第三幕内容">${escapeHtml(brief.plotStructure.act3 || '')}</textarea>
      </div>
    </div>
    ` : ''}

    <div class="preview-section">
      <h4><i class="fas fa-list-ol"></i> 分章大纲</h4>
      <div id="chaptersList" style="max-height: 600px; overflow-y: auto;">
        ${(brief.chapterOutlines || []).map((c, i) => `
          <div class="editable-chapter" data-chapter-index="${i}">
            <div class="editable-chapter-title">
              第<input type="number" class="editable-field" data-field="chapterNum" data-index="${i}" value="${c.chapter || (i+1)}" min="1" style="width:60px; flex-shrink: 0;">章：
              <input type="text" class="editable-field" data-field="chapterTitle" data-index="${i}" value="${escapeHtml(c.title || '')}" placeholder="章节标题" style="flex: 1; min-width: 0; box-sizing: border-box;">
              <button class="btn-remove-item" onclick="removeChapter(${i})" title="删除章节" style="vertical-align: middle;"><i class="fas fa-times"></i></button>
            </div>
            <textarea class="editable-field" data-field="chapterSummary" data-index="${i}" rows="2" placeholder="章节摘要">${escapeHtml(c.summary || '')}</textarea>
          </div>
        `).join('')}
      </div>
      <button class="btn-add-item" onclick="addChapter()"><i class="fas fa-plus"></i> 添加章节</button>
    </div>
  `;
}

// 渲染大纲预览（可编辑版本）
function renderOutline(outline) {
  if (!outline) {
    previewContent.innerHTML = '<p>未获取到大纲内容</p>';
    return;
  }

  // 确保 state.generatedData 同步
  state.generatedData = outline;

  previewContent.innerHTML = `
    <div class="preview-section">
      <h4><i class="fas fa-globe"></i> 世界观设定</h4>
      <textarea class="editable-field" data-field="worldBuilding" rows="4" placeholder="输入世界观设定">${escapeHtml(outline.worldBuilding || '')}</textarea>
    </div>

    ${outline.characters && outline.characters.length > 0 ? `
    <div class="preview-section">
      <h4><i class="fas fa-users"></i> 主要角色</h4>
      <div id="charactersList">
        ${outline.characters.map((c, i) => `
          <div class="editable-character">
            <div class="editable-character-header">
              <input type="text" class="editable-field" data-field="characterName" data-index="${i}" value="${escapeHtml(c.name || '')}" placeholder="角色名" style="flex:1;">
              <select class="editable-field" data-field="characterRole" data-index="${i}" style="flex:0 0 auto; width: 90px; max-width: 100%; padding: 8px;">
                <option value="protagonist" ${c.role === 'protagonist' ? 'selected' : ''}>主角</option>
                <option value="antagonist" ${c.role === 'antagonist' ? 'selected' : ''}>反派</option>
                <option value="supporting" ${c.role === 'supporting' ? 'selected' : ''}>配角</option>
                <option value="love_interest" ${c.role === 'love_interest' ? 'selected' : ''}>感情线</option>
              </select>
              <button class="btn-remove-item" onclick="removeCharacter(${i})" title="删除角色"><i class="fas fa-times"></i></button>
            </div>
            <textarea class="editable-field" data-field="characterDesc" data-index="${i}" rows="2" placeholder="角色描述">${escapeHtml(c.description || '')}</textarea>
          </div>
        `).join('')}
      </div>
      <button class="btn-add-item" onclick="addCharacter()"><i class="fas fa-plus"></i> 添加角色</button>
    </div>
    ` : ''}

    ${outline.plotStructure ? `
    <div class="preview-section">
      <h4><i class="fas fa-chart-pie"></i> 情节结构</h4>
      <div style="margin-bottom: 10px;">
        <strong>第一幕</strong>
        <textarea class="editable-field" data-field="plotAct1" rows="3" placeholder="第一幕内容">${escapeHtml(outline.plotStructure.act1 || '')}</textarea>
      </div>
      <div style="margin-bottom: 10px;">
        <strong>第二幕</strong>
        <textarea class="editable-field" data-field="plotAct2" rows="3" placeholder="第二幕内容">${escapeHtml(outline.plotStructure.act2 || '')}</textarea>
      </div>
      <div style="margin-bottom: 10px;">
        <strong>第三幕</strong>
        <textarea class="editable-field" data-field="plotAct3" rows="3" placeholder="第三幕内容">${escapeHtml(outline.plotStructure.act3 || '')}</textarea>
      </div>
    </div>
    ` : ''}

    <div class="preview-section">
      <h4><i class="fas fa-list-ol"></i> 分章大纲</h4>
      <div id="chaptersList" style="max-height: 600px; overflow-y: auto;">
        ${(outline.chapterOutlines || []).map((c, i) => `
          <div class="editable-chapter" data-chapter-index="${i}">
            <div class="editable-chapter-title">
              第<input type="number" class="editable-field" data-field="chapterNum" data-index="${i}" value="${c.chapter || (i+1)}" min="1" style="width:60px; flex-shrink: 0;">章：
              <input type="text" class="editable-field" data-field="chapterTitle" data-index="${i}" value="${escapeHtml(c.title || '')}" placeholder="章节标题" style="flex: 1; min-width: 0; box-sizing: border-box;">
              <button class="btn-remove-item" onclick="removeChapter(${i})" title="删除章节" style="vertical-align: middle;"><i class="fas fa-times"></i></button>
            </div>
            <textarea class="editable-field" data-field="chapterSummary" data-index="${i}" rows="2" placeholder="章节摘要">${escapeHtml(c.summary || '')}</textarea>
          </div>
        `).join('')}
      </div>
      <button class="btn-add-item" onclick="addChapter()"><i class="fas fa-plus"></i> 添加章节</button>
    </div>
  `;
}

// 渲染经典仿写结果（可编辑版本）
function renderPasticheResult(pastiche) {
  if (!pastiche) {
    previewContent.innerHTML = '<p>未获取到仿写内容</p>';
    return;
  }

  // 确保 state.generatedData 同步
  state.generatedData = pastiche;

  // 后端返回的格式：{ analysis, projectBrief, outline }
  const analysis = pastiche.analysis || pastiche;
  const projectBrief = pastiche.projectBrief;
  const outline = pastiche.outline;

  previewContent.innerHTML = `
    <div class="preview-section">
      <h4><i class="fas fa-book-open"></i> 原作分析</h4>
      <textarea class="editable-field" data-field="analysisStyle" rows="4" placeholder="原作风格分析">${escapeHtml(analysis.style || analysis.originalAnalysis || '')}</textarea>
    </div>

    ${projectBrief ? `
    <div class="preview-section">
      <h4><i class="fas fa-file-alt"></i> 新作立项书</h4>
      <input type="text" class="editable-field" data-field="pasticheTitle" value="${escapeHtml(projectBrief.title || '')}" placeholder="故事标题" style="margin-bottom:8px;">
      <textarea class="editable-field" data-field="pasticheSynopsis" rows="3" placeholder="故事梗概">${escapeHtml(projectBrief.synopsis || '')}</textarea>
    </div>
    ` : ''}

    ${outline ? `
    ${outline.worldBuilding ? `
    <div class="preview-section">
      <h4><i class="fas fa-globe"></i> 世界观设定</h4>
      <textarea class="editable-field" data-field="worldBuilding" rows="3" placeholder="世界观设定">${escapeHtml(outline.worldBuilding || '')}</textarea>
    </div>
    ` : ''}

    ${outline.characters && outline.characters.length > 0 ? `
    <div class="preview-section">
      <h4><i class="fas fa-users"></i> 主要角色</h4>
      <div id="charactersList">
        ${outline.characters.map((c, i) => `
          <div class="editable-character">
            <div class="editable-character-header">
              <input type="text" class="editable-field" data-field="characterName" data-index="${i}" value="${escapeHtml(c.name || '')}" placeholder="角色名" style="flex:1;">
              <select class="editable-field" data-field="characterRole" data-index="${i}" style="flex:0 0 auto; width: 90px; max-width: 100%; padding: 8px;">
                <option value="protagonist" ${c.role === 'protagonist' ? 'selected' : ''}>主角</option>
                <option value="antagonist" ${c.role === 'antagonist' ? 'selected' : ''}>反派</option>
                <option value="supporting" ${c.role === 'supporting' ? 'selected' : ''}>配角</option>
                <option value="love_interest" ${c.role === 'love_interest' ? 'selected' : ''}>感情线</option>
              </select>
              <button class="btn-remove-item" onclick="removeCharacter(${i})" title="删除角色"><i class="fas fa-times"></i></button>
            </div>
            <textarea class="editable-field" data-field="characterDesc" data-index="${i}" rows="2" placeholder="角色描述">${escapeHtml(c.description || '')}</textarea>
          </div>
        `).join('')}
      </div>
      <button class="btn-add-item" onclick="addCharacter()"><i class="fas fa-plus"></i> 添加角色</button>
    </div>
    ` : ''}

    <div class="preview-section">
      <h4><i class="fas fa-list-ul"></i> 分章大纲</h4>
      <div id="chaptersList" style="max-height: 600px; overflow-y: auto;">
        ${(outline.chapterOutlines || []).map((c, i) => `
          <div class="editable-chapter" data-chapter-index="${i}">
            <div class="editable-chapter-title">
              第<input type="number" class="editable-field" data-field="chapterNum" data-index="${i}" value="${c.chapter || (i+1)}" min="1" style="width:60px; flex-shrink: 0;">章：
              <input type="text" class="editable-field" data-field="chapterTitle" data-index="${i}" value="${escapeHtml(c.title || '')}" placeholder="章节标题" style="flex: 1; min-width: 0; box-sizing: border-box;">
              <button class="btn-remove-item" onclick="removeChapter(${i})" title="删除章节" style="vertical-align: middle;"><i class="fas fa-times"></i></button>
            </div>
            <textarea class="editable-field" data-field="chapterSummary" data-index="${i}" rows="2" placeholder="章节摘要">${escapeHtml(c.summary || '')}</textarea>
          </div>
        `).join('')}
      </div>
      <button class="btn-add-item" onclick="addChapter()"><i class="fas fa-plus"></i> 添加章节</button>
    </div>
    ` : ''}
  `;
}

// 渲染模板结果（可编辑版本）
function renderTemplateResult(template) {
  if (!template) {
    previewContent.innerHTML = '<p>未获取到模板内容</p>';
    return;
  }

  // 确保 state.generatedData 同步
  state.generatedData = template;

  // 后端返回的格式：{ projectBrief, outline: { worldBuilding, characters, plotStructure, chapterOutlines } }
  const projectBrief = template.projectBrief || template;
  const outline = template.outline || template;

  previewContent.innerHTML = `
    ${projectBrief ? `
    <div class="preview-section">
      <h4><i class="fas fa-file-alt"></i> 项目立项书</h4>
      <input type="text" class="editable-field" data-field="templateTitle" value="${escapeHtml(projectBrief.title || '')}" placeholder="故事标题" style="margin-bottom:8px;">
      <textarea class="editable-field" data-field="templateSynopsis" rows="3" placeholder="故事梗概">${escapeHtml(projectBrief.synopsis || '')}</textarea>
    </div>
    ` : ''}

    ${outline.worldBuilding ? `
    <div class="preview-section">
      <h4><i class="fas fa-globe"></i> 世界观设定</h4>
      <textarea class="editable-field" data-field="worldBuilding" rows="4" placeholder="输入世界观设定">${escapeHtml(outline.worldBuilding || '')}</textarea>
    </div>
    ` : ''}

    ${outline.characters && outline.characters.length > 0 ? `
    <div class="preview-section">
      <h4><i class="fas fa-users"></i> 角色设定</h4>
      <div id="charactersList">
        ${outline.characters.map((c, i) => `
          <div class="editable-character">
            <div class="editable-character-header">
              <input type="text" class="editable-field" data-field="characterName" data-index="${i}" value="${escapeHtml(c.name || '')}" placeholder="角色名" style="flex:1;">
              <select class="editable-field" data-field="characterRole" data-index="${i}" style="flex:0 0 auto; width: 90px; max-width: 100%; padding: 8px;">
                <option value="protagonist" ${c.role === 'protagonist' ? 'selected' : ''}>主角</option>
                <option value="antagonist" ${c.role === 'antagonist' ? 'selected' : ''}>反派</option>
                <option value="supporting" ${c.role === 'supporting' ? 'selected' : ''}>配角</option>
                <option value="love_interest" ${c.role === 'love_interest' ? 'selected' : ''}>感情线</option>
              </select>
              <button class="btn-remove-item" onclick="removeCharacter(${i})" title="删除角色"><i class="fas fa-times"></i></button>
            </div>
            <textarea class="editable-field" data-field="characterDesc" data-index="${i}" rows="2" placeholder="角色描述">${escapeHtml(c.description || '')}</textarea>
          </div>
        `).join('')}
      </div>
      <button class="btn-add-item" onclick="addCharacter()"><i class="fas fa-plus"></i> 添加角色</button>
    </div>
    ` : ''}

    ${outline.plotStructure ? `
    <div class="preview-section">
      <h4><i class="fas fa-chart-pie"></i> 情节结构</h4>
      <div style="margin-bottom: 10px;">
        <strong>第一幕</strong>
        <textarea class="editable-field" data-field="plotAct1" rows="3" placeholder="第一幕内容">${escapeHtml(outline.plotStructure.act1 || '')}</textarea>
      </div>
      <div style="margin-bottom: 10px;">
        <strong>第二幕</strong>
        <textarea class="editable-field" data-field="plotAct2" rows="3" placeholder="第二幕内容">${escapeHtml(outline.plotStructure.act2 || '')}</textarea>
      </div>
      <div style="margin-bottom: 10px;">
        <strong>第三幕</strong>
        <textarea class="editable-field" data-field="plotAct3" rows="3" placeholder="第三幕内容">${escapeHtml(outline.plotStructure.act3 || '')}</textarea>
      </div>
    </div>
    ` : ''}

    <div class="preview-section">
      <h4><i class="fas fa-list-ol"></i> 分章大纲</h4>
      <div id="chaptersList" style="max-height: 600px; overflow-y: auto;">
        ${(outline.chapterOutlines || []).map((c, i) => `
          <div class="editable-chapter" data-chapter-index="${i}">
            <div class="editable-chapter-title">
              第<input type="number" class="editable-field" data-field="chapterNum" data-index="${i}" value="${c.chapter || (i+1)}" min="1" style="width:60px; flex-shrink: 0;">章：
              <input type="text" class="editable-field" data-field="chapterTitle" data-index="${i}" value="${escapeHtml(c.title || '')}" placeholder="章节标题" style="flex: 1; min-width: 0; box-sizing: border-box;">
              <button class="btn-remove-item" onclick="removeChapter(${i})" title="删除章节" style="vertical-align: middle;"><i class="fas fa-times"></i></button>
            </div>
            <textarea class="editable-field" data-field="chapterSummary" data-index="${i}" rows="2" placeholder="章节摘要">${escapeHtml(c.summary || '')}</textarea>
          </div>
        `).join('')}
      </div>
      <button class="btn-add-item" onclick="addChapter()"><i class="fas fa-plus"></i> 添加章节</button>
    </div>
  `;
}

// 添加聊天消息
function addChatMessage(type, content) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message ${type}`;

  const avatar = type === 'assistant' ? '🤖' : '👤';

  messageDiv.innerHTML = `
    <div class="chat-avatar">${avatar}</div>
    <div class="chat-bubble">${content}</div>
  `;

  chatHistory.appendChild(messageDiv);
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

// 处理发送反馈
async function handleSendFeedback() {
  const feedback = chatInput.value.trim();
  if (!feedback) return;

  // 添加用户消息
  addChatMessage('user', feedback);
  chatInput.value = '';

  // 禁用发送按钮
  btnSend.disabled = true;

  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    let response;

    if (state.selectedMethod === 'project') {
      response = await fetch('/api/ai/creation/revise-project-brief', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sessionId: state.sessionId,
          feedback
        })
      });
    } else if (state.selectedMethod === 'outline') {
      response = await fetch('/api/ai/creation/revise-outline', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sessionId: state.sessionId,
          feedback
        })
      });
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '修改失败');
    }

    // 轮询新结果
    addChatMessage('assistant', '正在修改中，请稍候...');
    pollRevisionStatus(data.taskId);

  } catch (error) {
    console.error('修改失败:', error);
    addChatMessage('assistant', '修改失败：' + error.message);
    btnSend.disabled = false;
  }
}

// 轮询修改状态（改为 WebSocket 优先）
async function pollRevisionStatus(taskId) {
  // 复用 watchCreationTask，标记为修改模式
  watchCreationTask(taskId, true);
}

// 处理直接创建故事
async function handleManualCreate() {
  const title = document.getElementById('manualTitle')?.value.trim();
  const description = document.getElementById('manualDescription')?.value.trim();
  const genre = document.getElementById('manualGenre')?.value || '';

  if (!title) {
    alert('请输入故事标题');
    return;
  }
  if (!description) {
    alert('请输入故事简介');
    return;
  }

  const btn = document.getElementById('btnManualCreate');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 创建中...';
  }

  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const response = await fetch('/api/stories', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ title, description, genre })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || '创建失败');
    }

    const storyId = data.story?.id || data.id;

    // 标记新手任务
    try {
      const progressStr = localStorage.getItem('st_onboarding_progress');
      let progress = progressStr ? JSON.parse(progressStr) : {};
      if (!progress.tasks) progress.tasks = {};
      if (!progress.tasks.createdStory) {
        progress.tasks.createdStory = true;
        localStorage.setItem('st_onboarding_progress', JSON.stringify(progress));
        fetch('/api/auth/onboarding-progress', {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ progress })
        }).catch(() => {});
        // 祝贺检查：页面即将跳转，设置 pending
        const requiredTasks = ['completedTour', 'browsedDiscover', 'viewedStoryTree', 'createdStory', 'publishedChapter'];
        const allDone = requiredTasks.every(key => progress.tasks[key] === true);
        if (allDone && !localStorage.getItem('st_celebration_shown')) {
          localStorage.setItem('st_celebration_pending', 'true');
        }
      }
    } catch (e) { /* ignore */ }

    // 跳转到写作页
    window.location.href = `/write.html?storyId=${storyId}&from=create`;

  } catch (error) {
    alert('创建失败：' + error.message);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-rocket"></i> 创建故事';
    }
  }
}

// 处理返回
function handleBack() {
  if (loadingContainer.classList.contains('active')) {
    // 从加载中返回
    loadingContainer.classList.remove('active');
    resultContainer.classList.remove('active');
    methodContent.classList.add('show');
  } else if (resultContainer.classList.contains('active')) {
    // 从结果页返回
    resultContainer.classList.remove('active');
    methodContent.classList.add('show');
  } else {
    // 从表单页返回选择页
    methodContent.classList.remove('show');
    methodContent.innerHTML = '';
    methodCards.querySelectorAll('.method-card').forEach(card => {
      card.classList.remove('selected');
    });
    state.selectedMethod = null;
  }
}

// 处理确认创建
async function handleConfirm() {
  if (!state.generatedData) return;

  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    // 从可编辑表单收集用户最新修改的数据
    const edited = collectEditedData();

    // 根据不同方式归一化数据结构，提取 projectBrief 和 outline
    let projectBriefData = null;
    let outlineData = null;
    let storyTitle = '新故事';
    let storySynopsis = '';

    switch (state.selectedMethod) {
      case 'project':
        // 智能导入立项：从编辑表单收集数据，合并 AI 原始数据
        projectBriefData = {
          title: edited.title || state.generatedData.title,
          synopsis: edited.synopsis || state.generatedData.synopsis,
          coreIdea: edited.coreIdea || state.generatedData.coreIdea,
          targetAudience: edited.targetAudience || state.generatedData.targetAudience,
          genre: edited.genre || state.generatedData.genre,
          writingStyle: state.generatedData.writingStyle,
          chapterStructure: state.generatedData.chapterStructure,
          highlights: edited.highlights || state.generatedData.highlights
        };
        outlineData = (edited.worldBuilding || edited.characters || edited.chapterOutlines || state.generatedData.worldBuilding || state.generatedData.characters || state.generatedData.chapterOutlines)
          ? {
              worldBuilding: edited.worldBuilding || state.generatedData.worldBuilding,
              characters: edited.characters || state.generatedData.characters,
              plotStructure: edited.plotStructure || state.generatedData.plotStructure,
              chapterOutlines: edited.chapterOutlines || state.generatedData.chapterOutlines
            }
          : null;
        storyTitle = projectBriefData.title || '新故事';
        storySynopsis = projectBriefData.synopsis || '';
        break;

      case 'outline':
        // AI 辅助大纲：从编辑表单收集数据
        outlineData = {
          worldBuilding: edited.worldBuilding || state.generatedData.worldBuilding,
          characters: edited.characters || state.generatedData.characters,
          plotStructure: edited.plotStructure || state.generatedData.plotStructure,
          chapterOutlines: edited.chapterOutlines || state.generatedData.chapterOutlines
        };
        projectBriefData = {
          title: state.formData.coreIdea ? state.formData.coreIdea.substring(0, 30) : '新故事',
          synopsis: outlineData.plotStructure
            ? `${outlineData.plotStructure.act1 || ''} ${outlineData.plotStructure.act2 || ''}`.substring(0, 200)
            : '',
          coreIdea: state.formData.coreIdea || '',
          genre: state.formData.outlineGenre || '',
          highlights: []
        };
        storyTitle = projectBriefData.title;
        storySynopsis = projectBriefData.synopsis;
        break;

      case 'pastiche':
        // 经典仿写：从编辑表单收集数据
        projectBriefData = {
          title: edited.pasticheTitle || state.generatedData.projectBrief?.title || (state.formData.bookName ? `${state.formData.bookName}·仿写` : '仿写作品'),
          synopsis: edited.pasticheSynopsis || state.generatedData.projectBrief?.synopsis || state.generatedData.analysis?.style || '',
          coreIdea: '',
          genre: '',
          highlights: []
        };
        outlineData = {
          worldBuilding: edited.worldBuilding || state.generatedData.outline?.worldBuilding,
          characters: edited.characters || state.generatedData.outline?.characters,
          plotStructure: edited.plotStructure || state.generatedData.outline?.plotStructure,
          chapterOutlines: edited.chapterOutlines || state.generatedData.outline?.chapterOutlines
        };
        storyTitle = projectBriefData.title || '仿写作品';
        storySynopsis = projectBriefData.synopsis || '';
        break;

      case 'template':
        // 故事模板：从编辑表单收集数据
        projectBriefData = {
          title: edited.templateTitle || state.generatedData.projectBrief?.title || '模板故事',
          synopsis: edited.templateSynopsis || state.generatedData.projectBrief?.synopsis || '',
          coreIdea: '',
          genre: '',
          highlights: []
        };
        outlineData = {
          worldBuilding: edited.worldBuilding || state.generatedData.outline?.worldBuilding,
          characters: edited.characters || state.generatedData.outline?.characters,
          plotStructure: edited.plotStructure || state.generatedData.outline?.plotStructure,
          chapterOutlines: edited.chapterOutlines || state.generatedData.outline?.chapterOutlines
        };
        storyTitle = projectBriefData.title || '模板故事';
        storySynopsis = projectBriefData.synopsis || '';
        break;
    }

    // 首先创建故事（含立项书）
    const storyResponse = await fetch('/api/stories', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: storyTitle,
        description: storySynopsis,
        project_brief: JSON.stringify(projectBriefData),
        ai_assisted_created: true,
        ai_creation_method: state.selectedMethod
      })
    });

    const storyData = await storyResponse.json();

    if (!storyResponse.ok) {
      throw new Error(storyData.error || '创建故事失败');
    }

    const storyId = storyData.story?.id || storyData.id;
    if (!storyId) {
      throw new Error('创建故事成功但未获取到故事ID');
    }
    console.log('故事创建成功, storyId:', storyId);

    // 如果有大纲数据，创建大纲记录
    if (outlineData && (outlineData.chapterOutlines || outlineData.worldBuilding || outlineData.characters)) {
      try {
        const outlineResponse = await fetch(`/api/ai/creation/stories/${storyId}/outlines`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            outline: outlineData,
            changeNote: 'AI 生成初始版本'
          })
        });
        if (!outlineResponse.ok) {
          const errData = await outlineResponse.json().catch(() => ({}));
          console.warn('创建大纲失败:', errData.error || outlineResponse.status);
        } else {
          console.log('大纲创建成功');
        }
      } catch (outlineErr) {
        console.warn('创建大纲请求异常:', outlineErr);
      }
    }

    // 如果大纲中有第一章信息，自动创建第一章节点
    let firstNodeId = null;
    if (outlineData && outlineData.chapterOutlines && outlineData.chapterOutlines.length > 0) {
      const firstChapter = outlineData.chapterOutlines[0];
      try {
        const nodeResponse = await fetch('/api/nodes', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            storyId: parseInt(storyId),
            title: firstChapter.title || '第一章',
            content: firstChapter.summary || '',
            parentId: null,
            path: '1',
            isPublished: false
          })
        });
        if (nodeResponse.ok) {
          const nodeData = await nodeResponse.json();
          firstNodeId = nodeData.node?.id || nodeData.id;
          console.log('已自动创建第一章节点，ID:', firstNodeId);
        } else {
          const errData = await nodeResponse.json().catch(() => ({}));
          console.warn('创建第一章节点失败:', errData.error || nodeResponse.status);
        }
      } catch (e) {
        console.warn('自动创建第一章失败，用户可手动创建:', e);
      }
    }

    // 标记新手任务：创建第一个故事
    try {
      const progressStr = localStorage.getItem('st_onboarding_progress');
      let progress = progressStr ? JSON.parse(progressStr) : {};
      if (!progress.tasks) progress.tasks = {};
      if (!progress.tasks.createdStory) {
        progress.tasks.createdStory = true;
        localStorage.setItem('st_onboarding_progress', JSON.stringify(progress));
        fetch('/api/auth/onboarding-progress', {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ progress })
        }).catch(() => {});
        // 祝贺检查：页面即将跳转，设置 pending
        const requiredTasks = ['completedTour', 'browsedDiscover', 'viewedStoryTree', 'createdStory', 'publishedChapter'];
        const allDone = requiredTasks.every(key => progress.tasks[key] === true);
        if (allDone && !localStorage.getItem('st_celebration_shown')) {
          localStorage.setItem('st_celebration_pending', 'true');
        }
      }
    } catch (e) { /* ignore */ }

    // 跳转到创作台：如果有第一章节点则进入编辑模式
    if (firstNodeId) {
      window.location.href = `/write.html?storyId=${storyId}&editMode=true&nodeId=${firstNodeId}`;
    } else {
      window.location.href = `/write.html?storyId=${storyId}`;
    }

  } catch (error) {
    console.error('创建失败:', error);
    alert('创建失败：' + error.message);
  }
}

// escapeHtml 已由 auth.js 全局提供

// 从可编辑字段收集当前表单数据
function collectEditedData() {
  const data = {};

  // 收集简单文本字段
  document.querySelectorAll('.editable-field[data-field]').forEach(el => {
    const field = el.dataset.field;
    const index = el.dataset.index !== undefined ? parseInt(el.dataset.index) : null;

    // 只处理非数组字段（数组字段在下面单独处理）
    if (index === null) {
      data[field] = el.value || '';
    }
  });

  // 收集角色数组
  const characters = [];
  document.querySelectorAll('[data-field="characterName"]').forEach((el, i) => {
    const idx = parseInt(el.dataset.index);
    const name = el.value || '';
    const roleEl = document.querySelector(`[data-field="characterRole"][data-index="${idx}"]`);
    const descEl = document.querySelector(`[data-field="characterDesc"][data-index="${idx}"]`);
    characters.push({
      name,
      role: roleEl ? roleEl.value : 'supporting',
      description: descEl ? descEl.value : ''
    });
  });
  if (characters.length > 0) data.characters = characters;

  // 收集亮点数组
  const highlights = [];
  document.querySelectorAll('[data-field="highlights"]').forEach(el => {
    const val = el.value || '';
    if (val.trim()) highlights.push(val);
  });
  if (highlights.length > 0) data.highlights = highlights;

  // 收集章节大纲
  const chapters = [];
  document.querySelectorAll('[data-field="chapterTitle"]').forEach((el, i) => {
    const idx = parseInt(el.dataset.index);
    const numEl = document.querySelector(`[data-field="chapterNum"][data-index="${idx}"]`);
    const summaryEl = document.querySelector(`[data-field="chapterSummary"][data-index="${idx}"]`);
    chapters.push({
      chapter: numEl ? parseInt(numEl.value) || (i + 1) : (i + 1),
      title: el.value || '',
      summary: summaryEl ? summaryEl.value || '' : ''
    });
  });
  if (chapters.length > 0) data.chapterOutlines = chapters;

  // 收集情节结构
  const act1 = data.plotAct1;
  const act2 = data.plotAct2;
  const act3 = data.plotAct3;
  if (act1 !== undefined || act2 !== undefined || act3 !== undefined) {
    data.plotStructure = {
      act1: act1 || '',
      act2: act2 || '',
      act3: act3 || ''
    };
  }
  delete data.plotAct1;
  delete data.plotAct2;
  delete data.plotAct3;

  return data;
}

// 删除亮点
function removeHighlight(index) {
  const items = document.querySelectorAll('#highlightsList .editable-highlight');
  if (items[index]) items[index].remove();
}

// 添加亮点
function addHighlight() {
  const list = document.getElementById('highlightsList');
  if (!list) return;
  const index = list.children.length;
  const div = document.createElement('div');
  div.className = 'editable-highlight';
  div.innerHTML = `
    <input type="text" class="editable-field" data-field="highlights" data-index="${index}" value="" placeholder="输入亮点">
    <button class="btn-remove-item" onclick="this.parentElement.remove()" title="删除"><i class="fas fa-times"></i></button>
  `;
  list.appendChild(div);
}

// 删除角色
function removeCharacter(index) {
  const items = document.querySelectorAll('#charactersList .editable-character');
  if (items[index]) items[index].remove();
}

// 添加角色
function addCharacter() {
  const list = document.getElementById('charactersList');
  if (!list) return;
  const index = list.children.length;
  const div = document.createElement('div');
  div.className = 'editable-character';
  div.innerHTML = `
    <div class="editable-character-header">
      <input type="text" class="editable-field" data-field="characterName" data-index="${index}" value="" placeholder="角色名" style="flex:1;">
      <select class="editable-field" data-field="characterRole" data-index="${index}" style="flex:0 0 auto; width: 90px; max-width: 100%; padding: 8px;">
        <option value="protagonist">主角</option>
        <option value="antagonist">反派</option>
        <option value="supporting" selected>配角</option>
        <option value="love_interest">感情线</option>
      </select>
      <button class="btn-remove-item" onclick="this.closest('.editable-character').remove()" title="删除角色"><i class="fas fa-times"></i></button>
    </div>
    <textarea class="editable-field" data-field="characterDesc" data-index="${index}" rows="2" placeholder="角色描述"></textarea>
  `;
  list.appendChild(div);
}

// 删除章节
function removeChapter(index) {
  const items = document.querySelectorAll('#chaptersList .editable-chapter');
  if (items[index]) items[index].remove();
}

// 添加章节
function addChapter() {
  let list = document.getElementById('chaptersList');
  // 如果 chaptersList 不存在，尝试在分章大纲 section 中创建它
  if (!list) {
    // 查找"添加章节"按钮所在的 section，在按钮前插入列表容器
    const addBtn = document.querySelector('.btn-add-item[onclick="addChapter()"]');
    if (addBtn && addBtn.parentElement) {
      list = document.createElement('div');
      list.id = 'chaptersList';
      list.style.cssText = 'max-height: 600px; overflow-y: auto;';
      addBtn.parentElement.insertBefore(list, addBtn);
    } else {
      return;
    }
  }
  const index = list.children.length;
  const div = document.createElement('div');
  div.className = 'editable-chapter';
  div.setAttribute('data-chapter-index', index);
  div.innerHTML = `
    <div class="editable-chapter-title">
      第<input type="number" class="editable-field" data-field="chapterNum" data-index="${index}" value="${index + 1}" min="1" style="width:60px; flex-shrink: 0;">章：
      <input type="text" class="editable-field" data-field="chapterTitle" data-index="${index}" value="" placeholder="章节标题" style="flex: 1; min-width: 0; box-sizing: border-box;">
      <button class="btn-remove-item" onclick="this.closest('.editable-chapter').remove()" title="删除章节" style="vertical-align: middle;"><i class="fas fa-times"></i></button>
    </div>
    <textarea class="editable-field" data-field="chapterSummary" data-index="${index}" rows="2" placeholder="章节摘要"></textarea>
  `;
  list.appendChild(div);
  // 滚动到新添加的章节
  div.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// 验证表单
function validateForm() {
  switch (state.selectedMethod) {
    case 'project':
      const storyIdea = document.getElementById('storyIdea')?.value.trim();
      if (!storyIdea) {
        alert('请输入故事想法');
        return false;
      }
      state.formData.storyIdea = storyIdea;
      state.formData.targetAudience = document.getElementById('targetAudience')?.value.trim();
      state.formData.writingStyle = document.getElementById('writingStyle')?.value.trim();
      break;

    case 'outline':
      const coreIdea = document.getElementById('coreIdea')?.value.trim();
      if (!coreIdea) {
        alert('请输入核心想法');
        return false;
      }
      state.formData.coreIdea = coreIdea;
      break;

    case 'pastiche':
      const bookName = document.getElementById('bookName')?.value.trim();
      if (!bookName) {
        alert('请输入书名');
        return false;
      }
      break;

    case 'template':
      if (!state.formData.templateId) {
        alert('请选择模板');
        return false;
      }
      break;
  }

  return true;
}