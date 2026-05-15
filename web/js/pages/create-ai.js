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

    // 轮询任务状态
    pollTaskStatus(state.taskId);

  } catch (error) {
    console.error('生成失败:', error);
    alert('生成失败：' + error.message);
    loadingContainer.classList.remove('active');
    methodContent.classList.add('show');
  }
}

// 轮询任务状态
async function pollTaskStatus(taskId) {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');

  const poll = async () => {
    try {
      const response = await fetch(`/api/ai/v2/tasks/${taskId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.status === 'completed') {
        // 任务完成
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
        addChatMessage('assistant', '生成完成！如有不满意的地方，可以提出修改意见。');

      } else if (data.status === 'failed') {
        throw new Error(data.errorMessage || '生成失败');
      } else {
        // 继续轮询
        setTimeout(poll, 3000);
      }

    } catch (error) {
      console.error('轮询失败:', error);
      alert('获取结果失败：' + error.message);
      loadingContainer.classList.remove('active');
      methodContent.classList.add('show');
    }
  };

  poll();
}

// 渲染立项书预览
function renderProjectBrief(brief) {
  if (!brief) {
    previewContent.innerHTML = '<p>未获取到立项书内容</p>';
    return;
  }

  previewContent.innerHTML = `
    <div class="preview-section">
      <h4><i class="fas fa-bookmark"></i> 故事标题</h4>
      <p>${brief.title || '未指定'}</p>
    </div>

    <div class="preview-section">
      <h4><i class="fas fa-align-left"></i> 故事梗概</h4>
      <p>${brief.synopsis || '暂无内容'}</p>
    </div>

    <div class="preview-section">
      <h4><i class="fas fa-lightbulb"></i> 核心创意/卖点</h4>
      <p>${brief.coreIdea || '暂无内容'}</p>
    </div>

    <div class="preview-section">
      <h4><i class="fas fa-users"></i> 目标读者群体</h4>
      <p>${brief.targetAudience || '暂无内容'}</p>
    </div>

    <div class="preview-section">
      <h4><i class="fas fa-tags"></i> 类型标签</h4>
      <p>${brief.genre || '暂无内容'}</p>
    </div>

    ${brief.highlights ? `
    <div class="preview-section">
      <h4><i class="fas fa-star"></i> 作品亮点</h4>
      <ul>
        ${brief.highlights.map(h => `<li>${h}</li>`).join('')}
      </ul>
    </div>
    ` : ''}
  `;
}

// 渲染大纲预览
function renderOutline(outline) {
  if (!outline) {
    previewContent.innerHTML = '<p>未获取到大纲内容</p>';
    return;
  }

  previewContent.innerHTML = `
    <div class="preview-section">
      <h4><i class="fas fa-globe"></i> 世界观设定</h4>
      <p>${outline.worldBuilding || '暂无内容'}</p>
    </div>

    ${outline.characters && outline.characters.length > 0 ? `
    <div class="preview-section">
      <h4><i class="fas fa-users"></i> 主要角色</h4>
      ${outline.characters.map(c => `
        <div style="margin-bottom: 15px; padding: 15px; background: var(--st-bg-primary); border-radius: var(--st-radius-lg);">
          <strong>${c.name}</strong>
          <span style="margin-left: 10px; padding: 2px 8px; background: var(--st-primary-100); color: var(--st-primary-700); border-radius: var(--st-radius-full); font-size: 12px;">
            ${c.role === 'protagonist' ? '主角' : c.role === 'antagonist' ? '反派' : '配角'}
          </span>
          <p style="margin-top: 8px;">${c.description || ''}</p>
        </div>
      `).join('')}
    </div>
    ` : ''}

    ${outline.plotStructure ? `
    <div class="preview-section">
      <h4><i class="fas fa-chart-pie"></i> 情节结构</h4>
      <p><strong>第一幕：</strong>${outline.plotStructure.act1 || '暂无内容'}</p>
      <p><strong>第二幕：</strong>${outline.plotStructure.act2 || '暂无内容'}</p>
      <p><strong>第三幕：</strong>${outline.plotStructure.act3 || '暂无内容'}</p>
    </div>
    ` : ''}

    ${outline.chapterOutlines && outline.chapterOutlines.length > 0 ? `
    <div class="preview-section">
      <h4><i class="fas fa-list-ol"></i> 分章大纲（前 10 章）</h4>
      <div style="max-height: 400px; overflow-y: auto;">
        ${outline.chapterOutlines.slice(0, 10).map(c => `
          <div style="margin-bottom: 10px; padding: 10px; background: var(--st-bg-primary); border-radius: var(--st-radius-lg);">
            <strong>第${c.chapter}章：${c.title || '无题'}</strong>
            <p style="margin-top: 5px; font-size: 13px;">${c.summary || '暂无内容'}</p>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}
  `;
}

// 渲染经典仿写结果
function renderPasticheResult(pastiche) {
  if (!pastiche) {
    previewContent.innerHTML = '<p>未获取到仿写内容</p>';
    return;
  }

  // 后端返回的格式：{ analysis, projectBrief, outline }
  const analysis = pastiche.analysis || pastiche;
  const projectBrief = pastiche.projectBrief;
  const outline = pastiche.outline;

  previewContent.innerHTML = `
    <div class="preview-section">
      <h4><i class="fas fa-book-open"></i> 原作分析</h4>
      <p>${analysis.style || analysis.originalAnalysis || '暂无内容'}</p>
    </div>

    ${projectBrief ? `
    <div class="preview-section">
      <h4><i class="fas fa-file-alt"></i> 新作立项书</h4>
      <p>${projectBrief.synopsis || projectBrief.title || '暂无内容'}</p>
    </div>
    ` : ''}

    ${outline ? `
    <div class="preview-section">
      <h4><i class="fas fa-list-ul"></i> 后续大纲</h4>
      <div style="max-height: 400px; overflow-y: auto;">
        ${outline.chapterOutlines && outline.chapterOutlines.length > 0 ?
          outline.chapterOutlines.map(c => `
            <div style="margin-bottom: 15px; padding: 15px; background: var(--st-bg-primary); border-radius: var(--st-radius-lg);">
              <strong>第${c.chapter}章：${c.title || '无题'}</strong>
              <p style="margin-top: 8px; font-size: 14px; line-height: 1.6;">${c.summary || '暂无内容'}</p>
            </div>
          `).join('') :
          (typeof outline === 'string' ? outline : '暂无内容')
        }
      </div>
    </div>
    ` : ''}
  `;
}

// 渲染模板结果
function renderTemplateResult(template) {
  if (!template) {
    previewContent.innerHTML = '<p>未获取到模板内容</p>';
    return;
  }

  // 后端返回的格式：{ projectBrief, outline: { worldBuilding, characters, plotStructure, chapterOutlines } }
  const projectBrief = template.projectBrief || template;
  const outline = template.outline || template;

  previewContent.innerHTML = `
    ${projectBrief ? `
    <div class="preview-section">
      <h4><i class="fas fa-file-alt"></i> 项目立项书</h4>
      <p>${projectBrief.synopsis || projectBrief.title || '暂无内容'}</p>
    </div>
    ` : ''}

    ${outline.worldBuilding ? `
    <div class="preview-section">
      <h4><i class="fas fa-globe"></i> 世界观设定</h4>
      <p>${outline.worldBuilding}</p>
    </div>
    ` : ''}

    ${outline.characters && outline.characters.length > 0 ? `
    <div class="preview-section">
      <h4><i class="fas fa-users"></i> 角色设定</h4>
      ${outline.characters.map(c => `
        <div style="margin-bottom: 15px; padding: 15px; background: var(--st-bg-primary); border-radius: var(--st-radius-lg);">
          <strong>${c.name}</strong>
          <span style="margin-left: 10px; padding: 2px 8px; background: var(--st-primary-100); color: var(--st-primary-700); border-radius: var(--st-radius-full); font-size: 12px;">
            ${c.role === 'protagonist' ? '主角' : c.role === 'antagonist' ? '反派' : '配角'}
          </span>
          <p style="margin-top: 8px;">${c.description || ''}</p>
        </div>
      `).join('')}
    </div>
    ` : ''}

    ${outline.plotStructure ? `
    <div class="preview-section">
      <h4><i class="fas fa-chart-pie"></i> 情节结构</h4>
      <p><strong>第一幕：</strong>${outline.plotStructure.act1 || '暂无内容'}</p>
      <p><strong>第二幕：</strong>${outline.plotStructure.act2 || '暂无内容'}</p>
      <p><strong>第三幕：</strong>${outline.plotStructure.act3 || '暂无内容'}</p>
    </div>
    ` : ''}

    ${outline.chapterOutlines && outline.chapterOutlines.length > 0 ? `
    <div class="preview-section">
      <h4><i class="fas fa-list-ol"></i> 分章大纲（前 10 章）</h4>
      <div style="max-height: 400px; overflow-y: auto;">
        ${outline.chapterOutlines.slice(0, 10).map(c => `
          <div style="margin-bottom: 10px; padding: 10px; background: var(--st-bg-primary); border-radius: var(--st-radius-lg);">
            <strong>第${c.chapter}章：${c.title || '无题'}</strong>
            <p style="margin-top: 5px; font-size: 13px;">${c.summary || '暂无内容'}</p>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}
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

// 轮询修改状态
async function pollRevisionStatus(taskId) {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');

  const poll = async () => {
    try {
      const response = await fetch(`/api/ai/v2/tasks/${taskId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.status === 'completed') {
        // 修改完成
        if (state.selectedMethod === 'project') {
          state.generatedData = data.result?.projectBrief;
          renderProjectBrief(data.result?.projectBrief);
        } else if (state.selectedMethod === 'outline') {
          state.generatedData = data.result?.outline;
          renderOutline(data.result?.outline);
        }

        addChatMessage('assistant', '修改完成！请查看更新后的内容。');
        btnSend.disabled = false;

      } else if (data.status === 'failed') {
        throw new Error(data.errorMessage || '修改失败');
      } else {
        // 继续轮询
        setTimeout(poll, 3000);
      }

    } catch (error) {
      console.error('轮询失败:', error);
      addChatMessage('assistant', '获取结果失败：' + error.message);
      btnSend.disabled = false;
    }
  };

  poll();
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

    // 首先创建故事
    const storyResponse = await fetch('/api/stories', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: state.generatedData.title || '新故事',
        description: state.generatedData.synopsis || '',
        project_brief: JSON.stringify(state.generatedData),
        ai_assisted_created: true,
        ai_creation_method: state.selectedMethod
      })
    });

    const storyData = await storyResponse.json();

    if (!storyResponse.ok) {
      throw new Error(storyData.error || '创建故事失败');
    }

    const storyId = storyData.id || storyData.story?.id;

    // 如果有大纲，创建大纲记录
    if (state.generatedData.chapterOutlines && state.selectedMethod === 'outline') {
      await fetch(`/api/stories/${storyId}/outlines`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          outline: state.generatedData,
          changeNote: 'AI 生成初始版本'
        })
      });
    }

    // 跳转到创作台
    window.location.href = `/write.html?storyId=${storyId}`;

  } catch (error) {
    console.error('创建失败:', error);
    alert('创建失败：' + error.message);
  }
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