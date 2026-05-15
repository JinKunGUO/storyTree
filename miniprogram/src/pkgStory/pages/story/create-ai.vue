<template>
  <view class="create-ai-page" :style="{ '--status-bar-height': statusBarHeight + 'px' }">
    <!-- 顶部导航栏 -->
    <view class="toolbar">
      <view class="toolbar-left">
        <view class="back-btn" @tap="handleBack">
          <text class="back-icon">←</text>
        </view>
        <text class="toolbar-title">AI 辅助创作</text>
      </view>
    </view>

    <scroll-view scroll-y class="content-scroll">
      <!-- 步骤条 -->
      <view class="steps-container">
        <view class="step" :class="{ active: currentStep === 1, completed: currentStep > 1 }">
          <view class="step-number">{{ currentStep > 1 ? '✓' : '1' }}</view>
          <text class="step-label">选择方式</text>
        </view>
        <view class="step-line" :class="{ active: currentStep > 1 }"></view>
        <view class="step" :class="{ active: currentStep === 2, completed: currentStep > 2 }">
          <view class="step-number">{{ currentStep > 2 ? '✓' : '2' }}</view>
          <text class="step-label">填写信息</text>
        </view>
        <view class="step-line" :class="{ active: currentStep > 2 }"></view>
        <view class="step" :class="{ active: currentStep === 3 }">
          <view class="step-number">3</view>
          <text class="step-label">AI 生成</text>
        </view>
      </view>

      <!-- 步骤 1：选择方式 -->
      <view v-if="currentStep === 1" class="step-content">
        <view class="method-list">
          <view
            v-for="method in methods"
            :key="method.value"
            class="method-item"
            :class="{ active: selectedMethod === method.value }"
            @tap="selectMethod(method.value)"
          >
            <view class="method-icon">{{ method.icon }}</view>
            <view class="method-info">
              <text class="method-name">{{ method.label }}</text>
              <text class="method-desc">{{ method.desc }}</text>
            </view>
            <view class="method-arrow">
              <text>›</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 步骤 2：填写信息 -->
      <view v-if="currentStep === 2" class="step-content">
        <!-- 智能导入立项 -->
        <view v-if="selectedMethod === 'project'" class="method-form">
          <view class="form-group">
            <text class="form-label">你的故事想法</text>
            <textarea
              v-model="formData.storyIdea"
              class="form-textarea"
              placeholder="例如：我想写一个关于现代人穿越到古代成为商人的故事..."
              :maxlength="1000"
              :auto-height="true"
            />
            <text class="char-count">{{ formData.storyIdea.length }}/1000</text>
          </view>

          <view class="form-group">
            <text class="form-label">故事类型（可选）</text>
            <scroll-view scroll-x class="genre-scroll" show-scrollbar>
              <view class="genre-list">
                <view
                  v-for="genre in genres"
                  :key="genre"
                  class="genre-tag"
                  :class="{ selected: formData.genre === genre }"
                  @tap="formData.genre = genre"
                >
                  {{ genre }}
                </view>
              </view>
            </scroll-view>
          </view>

          <view class="form-group">
            <text class="form-label">目标读者（可选）</text>
            <input
              v-model="formData.targetAudience"
              class="form-input"
              placeholder="如：18-35 岁男性读者"
            />
          </view>

          <view class="form-group">
            <text class="form-label">期望文风（可选）</text>
            <input
              v-model="formData.writingStyle"
              class="form-input"
              placeholder="如：轻松幽默/严肃沉重"
            />
          </view>
        </view>

        <!-- AI 辅助大纲 -->
        <view v-if="selectedMethod === 'outline'" class="method-form">
          <view class="form-group">
            <text class="form-label">故事类型</text>
            <scroll-view scroll-x class="genre-scroll" show-scrollbar>
              <view class="genre-list">
                <view
                  v-for="genre in genres"
                  :key="genre"
                  class="genre-tag"
                  :class="{ selected: formData.outlineGenre === genre }"
                  @tap="formData.outlineGenre = genre"
                >
                  {{ genre }}
                </view>
              </view>
            </scroll-view>
          </view>

          <view class="form-group">
            <text class="form-label">核心想法</text>
            <input
              v-model="formData.coreIdea"
              class="form-input"
              placeholder="一句话梗概，如：现代人穿越到古代当皇帝"
            />
          </view>
        </view>

        <!-- 经典仿写 -->
        <view v-if="selectedMethod === 'pastiche'" class="method-form">
          <view class="form-group">
            <text class="form-label">目标书名</text>
            <input
              v-model="formData.bookName"
              class="form-input"
              placeholder="如：三国演义、红楼梦"
            />
          </view>

          <view class="form-group">
            <text class="form-label">仿写类型</text>
            <picker :range="pasticheTypes" @change="onPasticheTypeChange">
              <view class="picker-value">
                {{ pasticheTypes[pasticheTypeIndex] }}
              </view>
            </picker>
          </view>

          <view class="form-group">
            <text class="form-label">创新点（可选）</text>
            <textarea
              v-model="formData.innovation"
              class="form-textarea"
              placeholder="简述你的创新想法，如：将三国背景移到科幻世界"
              :maxlength="500"
              :auto-height="true"
            />
            <text class="char-count">{{ formData.innovation.length }}/500</text>
          </view>
        </view>

        <!-- 故事模板 -->
        <view v-if="selectedMethod === 'template'" class="method-form">
          <scroll-view scroll-x class="template-scroll" show-scrollbar>
            <view class="template-list">
              <view
                v-for="tpl in templates"
                :key="tpl.id"
                class="template-card"
                :class="{ selected: formData.templateId === tpl.id }"
                @tap="selectTemplate(tpl.id)"
              >
                <text class="template-name">{{ tpl.name }}</text>
                <text class="template-desc">{{ tpl.description }}</text>
              </view>
            </view>
          </scroll-view>

          <view v-if="formData.templateId" class="form-group">
            <text class="form-label">主角姓名</text>
            <input
              v-model="formData.protagonistName"
              class="form-input"
              placeholder="主角名字"
            />
          </view>

          <view v-if="formData.templateId" class="form-group">
            <text class="form-label">核心冲突（可选）</text>
            <input
              v-model="formData.coreConflict"
              class="form-input"
              placeholder="如：家族恩怨、身份认同"
            />
          </view>
        </view>

        <!-- 操作按钮 -->
        <view class="form-actions">
          <button class="btn-generate" @tap="handleGenerate">
            <text class="btn-icon">✨</text>
            <text>开始生成</text>
          </button>
        </view>
      </view>

      <!-- 步骤 3：生成结果 -->
      <view v-if="currentStep === 3 && generatedData" class="step-content">
        <!-- 加载状态 -->
        <view v-if="loading" class="loading-container">
          <view class="spinner"></view>
          <text class="loading-text">AI 正在思考中...</text>
        </view>

        <!-- 生成结果 -->
        <view v-else class="result-container">
          <!-- 立项书预览 -->
          <view v-if="selectedMethod === 'project'" class="result-card">
            <view class="result-section">
              <text class="result-title">📋 项目立项书</text>
            </view>
            <view class="result-item">
              <text class="result-label">故事标题</text>
              <text class="result-value">{{ generatedData.title || '未指定' }}</text>
            </view>
            <view class="result-item">
              <text class="result-label">故事梗概</text>
              <text class="result-value">{{ generatedData.synopsis || '暂无内容' }}</text>
            </view>
            <view class="result-item">
              <text class="result-label">核心创意</text>
              <text class="result-value">{{ generatedData.coreIdea || '暂无内容' }}</text>
            </view>
          </view>

          <!-- 大纲预览 -->
          <view v-if="selectedMethod === 'outline'" class="result-card">
            <view class="result-section">
              <text class="result-title">📝 故事大纲</text>
            </view>
            <view class="result-item">
              <text class="result-label">世界观</text>
              <text class="result-value">{{ generatedData.worldBuilding || '暂无内容' }}</text>
            </view>
            <view v-if="generatedData.chapterOutlines" class="result-item">
              <text class="result-label">章节大纲</text>
              <text class="result-value">共{{ generatedData.chapterOutlines.length }}章</text>
            </view>
          </view>

          <!-- 经典仿写预览 -->
          <view v-if="selectedMethod === 'pastiche'" class="result-card">
            <view class="result-section">
              <text class="result-title">📚 经典仿写分析</text>
            </view>
            <view class="result-item">
              <text class="result-label">原作分析</text>
              <text class="result-value">{{ generatedData.analysis?.summary || generatedData.analysis || '暂无内容' }}</text>
            </view>
            <view class="result-item">
              <text class="result-label">立项书标题</text>
              <text class="result-value">{{ generatedData.projectBrief?.title || '暂无内容' }}</text>
            </view>
            <view class="result-item">
              <text class="result-label">故事梗概</text>
              <text class="result-value">{{ generatedData.projectBrief?.synopsis || '暂无内容' }}</text>
            </view>
            <view class="result-item">
              <text class="result-label">大纲章节</text>
              <text class="result-value">共{{ generatedData.outline?.chapterOutlines?.length || 0 }}章</text>
            </view>
          </view>

          <!-- 故事模板预览 -->
          <view v-if="selectedMethod === 'template'" class="result-card">
            <view class="result-section">
              <text class="result-title">🎯 故事模板生成</text>
            </view>
            <view class="result-item">
              <text class="result-label">立项书标题</text>
              <text class="result-value">{{ generatedData.projectBrief?.title || '暂无内容' }}</text>
            </view>
            <view class="result-item">
              <text class="result-label">故事梗概</text>
              <text class="result-value">{{ generatedData.projectBrief?.synopsis || '暂无内容' }}</text>
            </view>
            <view class="result-item">
              <text class="result-label">大纲章节</text>
              <text class="result-value">共{{ generatedData.outline?.chapterOutlines?.length || 0 }}章</text>
            </view>
          </view>

          <!-- 聊天反馈 -->
          <view class="chat-container">
            <view class="chat-history">
              <view
                v-for="(msg, index) in chatMessages"
                :key="index"
                class="chat-message"
                :class="msg.type"
              >
                <text class="chat-avatar">{{ msg.type === 'assistant' ? '🤖' : '👤' }}</text>
                <view class="chat-bubble">
                  <text>{{ msg.content }}</text>
                </view>
              </view>
            </view>
            <view class="chat-input-area">
              <input
                v-model="feedbackInput"
                class="chat-input"
                placeholder="请描述需要修改的地方..."
                @confirm="handleSendFeedback"
              />
              <button class="btn-send" @tap="handleSendFeedback" :disabled="!feedbackInput.trim()">
                发送
              </button>
            </view>
          </view>

          <!-- 确认按钮 -->
          <view class="confirm-actions">
            <button class="btn-back" @tap="handleBack">返回修改</button>
            <button class="btn-confirm" @tap="handleConfirm">确认创建故事</button>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import { ref } from 'vue';
import { createStory } from '../../../api/stories';
import {
  generateProjectBrief,
  generateOutline,
  reviseProjectBrief,
  reviseOutline,
  generatePastiche,
  generateFromTemplate
} from '../../../api/ai';

export default {
  name: 'CreateAI',
  setup() {
    const statusBarHeight = ref(uni.getSystemInfoSync().statusBarHeight || 20);
    const currentStep = ref(1);
    const selectedMethod = ref(null);
    const loading = ref(false);
    const sessionId = ref(null);
    const taskId = ref(null);
    const generatedData = ref(null);
    const feedbackInput = ref('');
    const chatMessages = ref([]);

    const methods = [
      { value: 'project', icon: '💡', label: '智能导入立项', desc: '将你的想法整理成规范立项书' },
      { value: 'outline', icon: '📝', label: 'AI 辅助大纲', desc: 'AI 帮你完善故事大纲' },
      { value: 'pastiche', icon: '📚', label: '经典仿写', desc: '基于已有作品进行仿写' },
      { value: 'template', icon: '🎯', label: '故事模板', desc: '使用预制模板快速开始' }
    ];

    const genres = ['玄幻', '奇幻', '武侠', '仙侠', '都市', '言情', '悬疑', '科幻', '历史', '军事', '游戏', '灵异', '同人', '短篇'];

    const pasticheTypes = ['仿写', '续写', '同人'];
    const pasticheTypeIndex = ref(0);

    const templates = [
      { id: 1, name: '都市逆袭', description: '普通人逆袭人生' },
      { id: 2, name: '玄幻修仙', description: '从凡人到仙帝' },
      { id: 3, name: '悬疑推理', description: '层层迷雾揭真相' },
      { id: 4, name: '甜宠言情', description: '甜蜜爱情温馨' },
      { id: 5, name: '科幻末世', description: '末日来临求生' },
      { id: 6, name: '历史穿越', description: '现代人改历史' }
    ];

    const formData = ref({
      storyIdea: '',
      genre: '',
      targetAudience: '',
      writingStyle: '',
      outlineGenre: '',
      coreIdea: '',
      bookName: '',
      innovation: '',
      templateId: null,
      protagonistName: '',
      coreConflict: ''
    });

    const selectMethod = (method) => {
      selectedMethod.value = method;
      currentStep.value = 2;
    };

    const selectTemplate = (id) => {
      formData.value.templateId = id;
    };

    const onPasticheTypeChange = (e) => {
      pasticheTypeIndex.value = e.detail.value;
    };

    const handleGenerate = async () => {
      // 验证表单
      if (!validateForm()) return;

      currentStep.value = 3;
      loading.value = true;

      try {
        let result;

        if (selectedMethod.value === 'project') {
          result = await generateProjectBrief({
            storyIdea: formData.value.storyIdea,
            genre: formData.value.genre,
            targetAudience: formData.value.targetAudience,
            writingStyle: formData.value.writingStyle
          });
        } else if (selectedMethod.value === 'outline') {
          result = await generateOutline({
            genre: formData.value.outlineGenre,
            coreIdea: formData.value.coreIdea
          });
        } else if (selectedMethod.value === 'pastiche') {
          result = await generatePastiche({
            bookName: formData.value.bookName,
            pasticheType: pasticheTypes[pasticheTypeIndex.value],
            innovation: formData.value.innovation
          });
        } else if (selectedMethod.value === 'template') {
          result = await generateFromTemplate({
            templateId: formData.value.templateId,
            protagonistName: formData.value.protagonistName,
            coreConflict: formData.value.coreConflict
          });
        }

        sessionId.value = result.sessionId;
        taskId.value = result.taskId;

        // 轮询任务状态
        pollTaskStatus(result.taskId);
      } catch (error) {
        uni.showToast({ title: error.message || '生成失败', icon: 'none' });
        loading.value = false;
      }
    };

    const pollTaskStatus = async (id) => {
      const poll = async () => {
        try {
          const { queryTaskStatus } = await import('../../../api/ai');
          const result = await queryTaskStatus(id);

          if (result.status === 'completed') {
            loading.value = false;
            // 根据不同方法提取对应的结果数据
            if (selectedMethod.value === 'project') {
              generatedData.value = result.result?.projectBrief;
            } else if (selectedMethod.value === 'outline') {
              generatedData.value = result.result?.outline;
            } else if (selectedMethod.value === 'pastiche') {
              // 经典仿写返回：{ analysis, projectBrief, outline }
              generatedData.value = result.result;
            } else if (selectedMethod.value === 'template') {
              // 模板生成返回：{ projectBrief, outline }
              generatedData.value = result.result;
            }

            chatMessages.value.push({
              type: 'assistant',
              content: '生成完成！如有不满意可以提出修改意见。'
            });
          } else if (result.status === 'failed') {
            throw new Error(result.errorMessage || '生成失败');
          } else {
            setTimeout(poll, 3000);
          }
        } catch (error) {
          uni.showToast({ title: error.message, icon: 'none' });
          loading.value = false;
        }
      };

      poll();
    };

    const handleSendFeedback = async () => {
      const feedback = feedbackInput.value.trim();
      if (!feedback) return;

      chatMessages.value.push({ type: 'user', content: feedback });
      feedbackInput.value = '';

      try {
        let result;

        if (selectedMethod.value === 'project') {
          result = await reviseProjectBrief({
            sessionId: sessionId.value,
            feedback
          });
        } else if (selectedMethod.value === 'outline') {
          result = await reviseOutline({
            sessionId: sessionId.value,
            feedback
          });
        } else if (selectedMethod.value === 'pastiche') {
          // 经典仿写修改：复用 reviseOutline（修改大纲）
          result = await reviseOutline({
            sessionId: sessionId.value,
            feedback
          });
        } else if (selectedMethod.value === 'template') {
          // 模板生成修改：复用 reviseOutline（修改大纲）
          result = await reviseOutline({
            sessionId: sessionId.value,
            feedback
          });
        }

        chatMessages.value.push({ type: 'assistant', content: '正在修改中...' });
        pollTaskStatus(result.taskId);
      } catch (error) {
        uni.showToast({ title: error.message, icon: 'none' });
      }
    };

    const handleConfirm = async () => {
      if (!generatedData.value) return;

      try {
        let projectBrief, outline;

        if (selectedMethod.value === 'project' || selectedMethod.value === 'outline') {
          projectBrief = generatedData.value;
          outline = generatedData.value;
        } else if (selectedMethod.value === 'pastiche' || selectedMethod.value === 'template') {
          projectBrief = generatedData.value.projectBrief;
          outline = generatedData.value.outline;
        }

        const storyData = {
          title: projectBrief?.title || '新故事',
          description: projectBrief?.synopsis || '',
          project_brief: JSON.stringify(projectBrief),
          ai_assisted_created: true,
          ai_creation_method: selectedMethod.value
        };

        const result = await createStory(storyData);
        const storyId = result.id || result.story?.id;

        uni.showToast({ title: '创建成功', icon: 'success' });

        setTimeout(() => {
          uni.redirectTo({
            url: `/pkgWrite/pages/write/editor?id=${storyId}`
          });
        }, 1500);
      } catch (error) {
        uni.showToast({ title: error.message || '创建失败', icon: 'none' });
      }
    };

    const handleBack = () => {
      if (currentStep.value === 3) {
        currentStep.value = 2;
      } else if (currentStep.value === 2) {
        currentStep.value = 1;
        selectedMethod.value = null;
      } else {
        uni.navigateBack();
      }
    };

    const validateForm = () => {
      switch (selectedMethod.value) {
        case 'project':
          if (!formData.value.storyIdea.trim()) {
            uni.showToast({ title: '请输入故事想法', icon: 'none' });
            return false;
          }
          break;
        case 'outline':
          if (!formData.value.coreIdea.trim()) {
            uni.showToast({ title: '请输入核心想法', icon: 'none' });
            return false;
          }
          break;
        case 'pastiche':
          if (!formData.value.bookName.trim()) {
            uni.showToast({ title: '请输入书名', icon: 'none' });
            return false;
          }
          break;
        case 'template':
          if (!formData.value.templateId) {
            uni.showToast({ title: '请选择模板', icon: 'none' });
            return false;
          }
          break;
      }
      return true;
    };

    return {
      statusBarHeight,
      currentStep,
      selectedMethod,
      loading,
      generatedData,
      feedbackInput,
      chatMessages,
      methods,
      genres,
      pasticheTypes,
      pasticheTypeIndex,
      templates,
      formData,
      selectMethod,
      selectTemplate,
      onPasticheTypeChange,
      handleGenerate,
      handleSendFeedback,
      handleConfirm,
      handleBack
    };
  }
};
</script>

<style scoped>
.create-ai-page {
  min-height: 100vh;
  background: #f5f6f7;
  padding-top: var(--status-bar-height);
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 44px;
  background: #fff;
  border-bottom: 1px solid #eee;
  position: sticky;
  top: 0;
  z-index: 100;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.back-btn {
  padding: 8px;
}

.back-icon {
  font-size: 20px;
  color: #333;
}

.toolbar-title {
  font-size: 17px;
  font-weight: 600;
  color: #333;
}

.content-scroll {
  height: calc(100vh - 44px);
}

.steps-container {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: #fff;
}

.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.step-number {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #e5e7eb;
  color: #9ca3af;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
}

.step.active .step-number {
  background: #7c6af7;
  color: #fff;
}

.step.completed .step-number {
  background: #10b981;
  color: #fff;
}

.step-label {
  font-size: 12px;
  color: #9ca3af;
}

.step.active .step-label {
  color: #333;
  font-weight: 600;
}

.step-line {
  width: 40px;
  height: 2px;
  background: #e5e7eb;
  margin: 0 8px;
}

.step-line.active {
  background: #7c6af7;
}

.step-content {
  padding: 16px;
}

.method-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.method-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: #fff;
  border-radius: 12px;
  border: 2px solid transparent;
  transition: all 0.2s;
}

.method-item.active {
  border-color: #7c6af7;
  background: linear-gradient(135deg, rgba(124, 106, 247, 0.1), rgba(124, 106, 247, 0.05));
}

.method-icon {
  font-size: 36px;
}

.method-info {
  flex: 1;
}

.method-name {
  display: block;
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin-bottom: 4px;
}

.method-desc {
  display: block;
  font-size: 13px;
  color: #9ca3af;
}

.method-arrow {
  font-size: 24px;
  color: #d1d5db;
}

.method-form {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
}

.form-group {
  margin-bottom: 24px;
}

.form-label {
  display: block;
  font-size: 15px;
  font-weight: 600;
  color: #333;
  margin-bottom: 12px;
}

.form-textarea {
  width: 100%;
  min-height: 140px;
  padding: 14px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  font-size: 15px;
  line-height: 1.6;
  box-sizing: border-box;
  background: #fafbfc;
}

.form-input {
  width: 100%;
  height: 48px;
  padding: 0 14px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  font-size: 15px;
  box-sizing: border-box;
  background: #fafbfc;
}

.form-textarea:focus,
.form-input:focus {
  border-color: #7c6af7;
  background: #fff;
  outline: none;
}

.char-count {
  display: block;
  text-align: right;
  font-size: 12px;
  color: #9ca3af;
  margin-top: 4px;
}

.genre-scroll {
  white-space: nowrap;
}

.genre-list {
  display: inline-flex;
  gap: 8px;
}

.genre-tag {
  padding: 8px 16px;
  background: #f3f4f6;
  border-radius: 20px;
  font-size: 14px;
  color: #6b7280;
  white-space: nowrap;
}

.genre-tag.selected {
  background: rgba(124, 106, 247, 0.1);
  color: #7c6af7;
  border: 1px solid #7c6af7;
}

.template-scroll {
  white-space: nowrap;
  margin-bottom: 16px;
}

.template-list {
  display: inline-flex;
  gap: 12px;
}

.template-card {
  width: 140px;
  padding: 16px;
  background: #f3f4f6;
  border-radius: 12px;
  border: 2px solid transparent;
  transition: all 0.2s;
}

.template-card.selected {
  border-color: #7c6af7;
  background: linear-gradient(135deg, rgba(124, 106, 247, 0.1), rgba(124, 106, 247, 0.05));
}

.template-name {
  display: block;
  font-size: 15px;
  font-weight: 600;
  color: #333;
  margin-bottom: 6px;
}

.template-desc {
  display: block;
  font-size: 12px;
  color: #9ca3af;
}

.form-actions {
  margin-top: 24px;
}

.btn-generate {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: linear-gradient(135deg, #7c6af7, #667eea);
  color: #fff;
  border: none;
  border-radius: 12px;
  padding: 14px 32px;
  font-size: 16px;
  font-weight: 600;
}

.btn-icon {
  font-size: 18px;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60px 20px;
}

.spinner {
  width: 50px;
  height: 50px;
  border: 4px solid #e5e7eb;
  border-top-color: #7c6af7;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-text {
  font-size: 14px;
  color: #6b7280;
}

.result-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.result-card {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
}

.result-section {
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e5e7eb;
}

.result-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.result-item {
  margin-bottom: 12px;
}

.result-label {
  display: block;
  font-size: 13px;
  color: #9ca3af;
  margin-bottom: 4px;
}

.result-value {
  display: block;
  font-size: 14px;
  color: #333;
  line-height: 1.6;
}

.chat-container {
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
}

.chat-history {
  max-height: 200px;
  overflow-y: auto;
  padding: 12px;
  background: #f9fafb;
}

.chat-message {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 12px;
}

.chat-message.user {
  flex-direction: row-reverse;
}

.chat-avatar {
  font-size: 20px;
  flex-shrink: 0;
}

.chat-bubble {
  max-width: 80%;
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.5;
}

.chat-message.assistant .chat-bubble {
  background: #f3f4f6;
  color: #333;
}

.chat-message.user .chat-bubble {
  background: #7c6af7;
  color: #fff;
}

.chat-input-area {
  display: flex;
  gap: 8px;
  padding: 12px;
  border-top: 1px solid #e5e7eb;
}

.chat-input {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 20px;
  font-size: 14px;
}

.btn-send {
  padding: 10px 20px;
  background: #7c6af7;
  color: #fff;
  border: none;
  border-radius: 20px;
  font-size: 14px;
}

.btn-send:disabled {
  opacity: 0.5;
}

.confirm-actions {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}

.btn-back,
.btn-confirm {
  flex: 1;
  padding: 14px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
}

.btn-back {
  background: #fff;
  border: 1px solid #e5e7eb;
  color: #333;
}

.btn-confirm {
  background: linear-gradient(135deg, #10b981, #059669);
  color: #fff;
  border: none;
}
</style>