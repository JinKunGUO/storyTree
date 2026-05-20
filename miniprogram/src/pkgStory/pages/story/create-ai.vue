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
      <view v-if="currentStep === 3" class="step-content">
        <!-- 加载状态：AI 正在生成中 -->
        <view v-if="loading" class="loading-container">
          <view class="spinner"></view>
          <text class="loading-text">AI 正在生成中，请稍候...</text>
          <text class="loading-hint">这可能需要几秒钟时间</text>
        </view>

        <!-- 生成结果（可编辑） -->
        <view v-else-if="generatedData" class="result-container">
          <!-- 提示信息 -->
          <view class="edit-hint">
            <text class="edit-hint-icon">✏️</text>
            <text class="edit-hint-text">点击任意内容可直接编辑</text>
          </view>

          <!-- ═══ 智能导入立项 ═══ -->
          <view v-if="selectedMethod === 'project'" class="result-card">
            <view class="result-section">
              <text class="result-title">📋 项目立项书</text>
            </view>
            <view class="result-item">
              <text class="result-label">故事标题</text>
              <input
                v-model="generatedData.title"
                class="editable-field"
                placeholder="请输入标题"
              />
            </view>
            <view class="result-item">
              <text class="result-label">故事梗概</text>
              <text v-if="!isFieldEditing('synopsis')" class="editable-text" @tap="startEdit('synopsis')">{{ generatedData.synopsis || '点击编辑' }}</text>
              <textarea
                v-else
                v-model="generatedData.synopsis"
                class="editable-textarea"
                placeholder="请输入梗概"
                :auto-height="true"
                :maxlength="2000"
                :focus="true"
                @blur="endEdit"
              />
            </view>
            <view class="result-item">
              <text class="result-label">核心创意</text>
              <text v-if="!isFieldEditing('coreIdea')" class="editable-text" @tap="startEdit('coreIdea')">{{ generatedData.coreIdea || '点击编辑' }}</text>
              <textarea
                v-else
                v-model="generatedData.coreIdea"
                class="editable-textarea"
                placeholder="请输入核心创意"
                :auto-height="true"
                :maxlength="1000"
                :focus="true"
                @blur="endEdit"
              />
            </view>
            <view v-if="generatedData.targetAudience" class="result-item">
              <text class="result-label">目标读者</text>
              <input
                v-model="generatedData.targetAudience"
                class="editable-field"
                placeholder="目标读者"
              />
            </view>
            <view v-if="generatedData.genre" class="result-item">
              <text class="result-label">故事类型</text>
              <input
                v-model="generatedData.genre"
                class="editable-field"
                placeholder="故事类型"
              />
            </view>
            <view v-if="generatedData.writingStyle" class="result-item">
              <text class="result-label">期望文风</text>
              <input
                v-model="generatedData.writingStyle"
                class="editable-field"
                placeholder="期望文风"
              />
            </view>
            <view v-if="generatedData.highlights && generatedData.highlights.length" class="result-item">
              <text class="result-label">作品亮点</text>
              <view class="highlight-list">
                <view v-for="(h, i) in generatedData.highlights" :key="i" class="highlight-item">
                  <input
                    :value="h"
                    class="editable-field highlight-input"
                    placeholder="亮点"
                    @input="generatedData.highlights[i] = $event.detail.value"
                  />
                  <view class="highlight-remove" @tap="generatedData.highlights.splice(i, 1)">
                    <text>✕</text>
                  </view>
                </view>
                <view class="highlight-add" @tap="generatedData.highlights.push('')">
                  <text>+ 添加亮点</text>
                </view>
              </view>
            </view>
            <!-- 立项书附带的大纲信息 -->
            <view v-if="generatedData.worldBuilding || generatedData.characters || generatedData.chapterOutlines" class="result-section" style="margin-top: 16px;">
              <text class="result-title">📝 附带大纲</text>
            </view>
            <view v-if="generatedData.worldBuilding" class="result-item">
              <text class="result-label">世界观</text>
              <text v-if="!isFieldEditing('worldBuilding')" class="editable-text" @tap="startEdit('worldBuilding')">{{ generatedData.worldBuilding || '点击编辑' }}</text>
              <textarea
                v-else
                v-model="generatedData.worldBuilding"
                class="editable-textarea"
                placeholder="世界观设定"
                :auto-height="true"
                :maxlength="3000"
                :focus="true"
                @blur="endEdit"
              />
            </view>
            <view v-if="generatedData.characters && generatedData.characters.length" class="result-item">
              <text class="result-label">角色设定</text>
              <view class="character-list">
                <view v-for="(char, i) in generatedData.characters" :key="i" class="character-card">
                  <view class="character-header">
                    <input
                      :value="char.name"
                      class="editable-field character-name"
                      placeholder="角色名"
                      @input="generatedData.characters[i].name = $event.detail.value"
                    />
                    <picker :range="roleOptionLabels" @change="onCharRoleChange($event, i, 'project')">
                      <view class="editable-field character-role picker-field">
                        {{ getRoleText(char.role) || '选择角色类型' }}
                      </view>
                    </picker>
                  </view>
                  <text v-if="!isFieldEditing(`project.char.${i}`)" class="editable-text" @tap="startEdit(`project.char.${i}`)">{{ char.description || '点击编辑' }}</text>
                  <textarea
                    v-else
                    :value="char.description"
                    class="editable-textarea"
                    placeholder="角色描述"
                    :auto-height="true"
                    :maxlength="500"
                    :focus="true"
                    @input="generatedData.characters[i].description = $event.detail.value"
                    @blur="endEdit"
                  />
                </view>
              </view>
            </view>
            <view v-if="generatedData.chapterOutlines && generatedData.chapterOutlines.length" class="result-item">
              <text class="result-label">章节大纲（{{ generatedData.chapterOutlines.length }}章）</text>
              <view class="chapter-list">
                <view v-for="(ch, i) in generatedData.chapterOutlines" :key="i" class="chapter-card">
                  <view class="chapter-header">
                    <text class="chapter-number">第{{ ch.chapter || (i + 1) }}章</text>
                    <input
                      :value="ch.title"
                      class="editable-field chapter-title"
                      placeholder="章节标题"
                      @input="generatedData.chapterOutlines[i].title = $event.detail.value"
                    />
                  </view>
                  <text v-if="!isFieldEditing(`project.ch.${i}`)" class="editable-text" @tap="startEdit(`project.ch.${i}`)">{{ ch.summary || '点击编辑' }}</text>
                  <textarea
                    v-else
                    :value="ch.summary"
                    class="editable-textarea chapter-summary"
                    placeholder="章节摘要"
                    :auto-height="true"
                    :maxlength="500"
                    :focus="true"
                    @input="generatedData.chapterOutlines[i].summary = $event.detail.value"
                    @blur="endEdit"
                  />
                </view>
              </view>
            </view>
            <view v-if="generatedData.plotStructure" class="result-item">
              <text class="result-label">故事结构</text>
              <view v-if="generatedData.plotStructure.act1" class="plot-item">
                <text class="plot-label">第一幕</text>
                <text v-if="!isFieldEditing('plotStructure.act1')" class="editable-text" @tap="startEdit('plotStructure.act1')">{{ generatedData.plotStructure.act1 || '点击编辑' }}</text>
                <textarea v-else v-model="generatedData.plotStructure.act1" class="editable-textarea" :auto-height="true" :maxlength="1000" :focus="true" @blur="endEdit" />
              </view>
              <view v-if="generatedData.plotStructure.act2" class="plot-item">
                <text class="plot-label">第二幕</text>
                <text v-if="!isFieldEditing('plotStructure.act2')" class="editable-text" @tap="startEdit('plotStructure.act2')">{{ generatedData.plotStructure.act2 || '点击编辑' }}</text>
                <textarea v-else v-model="generatedData.plotStructure.act2" class="editable-textarea" :auto-height="true" :maxlength="1000" :focus="true" @blur="endEdit" />
              </view>
              <view v-if="generatedData.plotStructure.act3" class="plot-item">
                <text class="plot-label">第三幕</text>
                <text v-if="!isFieldEditing('plotStructure.act3')" class="editable-text" @tap="startEdit('plotStructure.act3')">{{ generatedData.plotStructure.act3 || '点击编辑' }}</text>
                <textarea v-else v-model="generatedData.plotStructure.act3" class="editable-textarea" :auto-height="true" :maxlength="1000" :focus="true" @blur="endEdit" />
              </view>
            </view>
          </view>

          <!-- ═══ AI 辅助大纲 ═══ -->
          <view v-if="selectedMethod === 'outline'" class="result-card">
            <view class="result-section">
              <text class="result-title">📝 故事大纲</text>
            </view>
            <view v-if="generatedData.worldBuilding" class="result-item">
              <text class="result-label">世界观</text>
              <text v-if="!isFieldEditing('outline.worldBuilding')" class="editable-text" @tap="startEdit('outline.worldBuilding')">{{ generatedData.worldBuilding || '点击编辑' }}</text>
              <textarea v-else v-model="generatedData.worldBuilding" class="editable-textarea" placeholder="世界观设定" :auto-height="true" :maxlength="3000" :focus="true" @blur="endEdit" />
            </view>
            <view v-if="generatedData.characters && generatedData.characters.length" class="result-item">
              <text class="result-label">角色设定</text>
              <view class="character-list">
                <view v-for="(char, i) in generatedData.characters" :key="i" class="character-card">
                  <view class="character-header">
                    <input :value="char.name" class="editable-field character-name" placeholder="角色名" @input="generatedData.characters[i].name = $event.detail.value" />
                    <picker :range="roleOptionLabels" @change="onCharRoleChange($event, i, 'outline')">
                      <view class="editable-field character-role picker-field">{{ getRoleText(char.role) || '选择角色类型' }}</view>
                    </picker>
                  </view>
                  <text v-if="!isFieldEditing(`outline.char.${i}`)" class="editable-text" @tap="startEdit(`outline.char.${i}`)">{{ char.description || '点击编辑' }}</text>
                  <textarea v-else :value="char.description" class="editable-textarea" placeholder="角色描述" :auto-height="true" :maxlength="500" :focus="true" @input="generatedData.characters[i].description = $event.detail.value" @blur="endEdit" />
                </view>
              </view>
            </view>
            <view v-if="generatedData.plotStructure" class="result-item">
              <text class="result-label">故事结构</text>
              <view v-if="generatedData.plotStructure.act1" class="plot-item">
                <text class="plot-label">第一幕</text>
                <text v-if="!isFieldEditing('outline.act1')" class="editable-text" @tap="startEdit('outline.act1')">{{ generatedData.plotStructure.act1 || '点击编辑' }}</text>
                <textarea v-else v-model="generatedData.plotStructure.act1" class="editable-textarea" :auto-height="true" :maxlength="1000" :focus="true" @blur="endEdit" />
              </view>
              <view v-if="generatedData.plotStructure.act2" class="plot-item">
                <text class="plot-label">第二幕</text>
                <text v-if="!isFieldEditing('outline.act2')" class="editable-text" @tap="startEdit('outline.act2')">{{ generatedData.plotStructure.act2 || '点击编辑' }}</text>
                <textarea v-else v-model="generatedData.plotStructure.act2" class="editable-textarea" :auto-height="true" :maxlength="1000" :focus="true" @blur="endEdit" />
              </view>
              <view v-if="generatedData.plotStructure.act3" class="plot-item">
                <text class="plot-label">第三幕</text>
                <text v-if="!isFieldEditing('outline.act3')" class="editable-text" @tap="startEdit('outline.act3')">{{ generatedData.plotStructure.act3 || '点击编辑' }}</text>
                <textarea v-else v-model="generatedData.plotStructure.act3" class="editable-textarea" :auto-height="true" :maxlength="1000" :focus="true" @blur="endEdit" />
              </view>
            </view>
            <view v-if="generatedData.chapterOutlines && generatedData.chapterOutlines.length" class="result-item">
              <text class="result-label">章节大纲（{{ generatedData.chapterOutlines.length }}章）</text>
              <view class="chapter-list">
                <view v-for="(ch, i) in generatedData.chapterOutlines" :key="i" class="chapter-card">
                  <view class="chapter-header">
                    <text class="chapter-number">第{{ ch.chapter || (i + 1) }}章</text>
                    <input :value="ch.title" class="editable-field chapter-title" placeholder="章节标题" @input="generatedData.chapterOutlines[i].title = $event.detail.value" />
                  </view>
                  <text v-if="!isFieldEditing(`outline.ch.${i}`)" class="editable-text" @tap="startEdit(`outline.ch.${i}`)">{{ ch.summary || '点击编辑' }}</text>
                  <textarea v-else :value="ch.summary" class="editable-textarea chapter-summary" placeholder="章节摘要" :auto-height="true" :maxlength="500" :focus="true" @input="generatedData.chapterOutlines[i].summary = $event.detail.value" @blur="endEdit" />
                </view>
              </view>
            </view>
          </view>

          <!-- ═══ 经典仿写 ═══ -->
          <view v-if="selectedMethod === 'pastiche'" class="result-card">
            <view class="result-section">
              <text class="result-title">📚 经典仿写分析</text>
            </view>
            <!-- 原作分析详情 -->
            <view v-if="generatedData.analysis?.style" class="result-item">
              <text class="result-label">风格特点</text>
              <text class="editable-text">{{ generatedData.analysis.style }}</text>
            </view>
            <view v-if="generatedData.analysis?.characters" class="result-item">
              <text class="result-label">主要角色</text>
              <text class="editable-text">{{ generatedData.analysis.characters }}</text>
            </view>
            <view v-if="generatedData.analysis?.plotStructure" class="result-item">
              <text class="result-label">情节结构</text>
              <text class="editable-text">{{ generatedData.analysis.plotStructure }}</text>
            </view>
            <!-- 仿写立项书 -->
            <view class="result-section" style="margin-top: 16px;">
              <text class="result-title">📋 仿写立项书</text>
            </view>
            <view v-if="generatedData.projectBrief" class="result-item">
              <text class="result-label">标题</text>
              <input v-model="generatedData.projectBrief.title" class="editable-field" placeholder="故事标题" />
            </view>
            <view v-if="generatedData.projectBrief" class="result-item">
              <text class="result-label">梗概</text>
              <text v-if="!isFieldEditing('pastiche.synopsis')" class="editable-text" @tap="startEdit('pastiche.synopsis')">{{ generatedData.projectBrief.synopsis || '点击编辑' }}</text>
              <textarea v-else v-model="generatedData.projectBrief.synopsis" class="editable-textarea" placeholder="故事梗概" :auto-height="true" :maxlength="2000" :focus="true" @blur="endEdit" />
            </view>
            <!-- 仿写大纲 -->
            <view v-if="generatedData.outline" class="result-section" style="margin-top: 16px;">
              <text class="result-title">📝 仿写大纲</text>
            </view>
            <view v-if="generatedData.outline?.worldBuilding" class="result-item">
              <text class="result-label">世界观</text>
              <text v-if="!isFieldEditing('pastiche.worldBuilding')" class="editable-text" @tap="startEdit('pastiche.worldBuilding')">{{ generatedData.outline.worldBuilding || '点击编辑' }}</text>
              <textarea v-else v-model="generatedData.outline.worldBuilding" class="editable-textarea" :auto-height="true" :maxlength="3000" :focus="true" @blur="endEdit" />
            </view>
            <view v-if="generatedData.outline?.chapterOutlines && generatedData.outline.chapterOutlines.length" class="result-item">
              <text class="result-label">章节大纲（{{ generatedData.outline.chapterOutlines.length }}章）</text>
              <view class="chapter-list">
                <view v-for="(ch, i) in generatedData.outline.chapterOutlines" :key="i" class="chapter-card">
                  <view class="chapter-header">
                    <text class="chapter-number">第{{ ch.chapter || (i + 1) }}章</text>
                    <input :value="ch.title" class="editable-field chapter-title" placeholder="章节标题" @input="generatedData.outline.chapterOutlines[i].title = $event.detail.value" />
                  </view>
                  <text v-if="!isFieldEditing(`pastiche.ch.${i}`)" class="editable-text" @tap="startEdit(`pastiche.ch.${i}`)">{{ ch.summary || '点击编辑' }}</text>
                  <textarea v-else :value="ch.summary" class="editable-textarea chapter-summary" placeholder="章节摘要" :auto-height="true" :maxlength="500" :focus="true" @input="generatedData.outline.chapterOutlines[i].summary = $event.detail.value" @blur="endEdit" />
                </view>
              </view>
            </view>
          </view>

          <!-- ═══ 故事模板 ═══ -->
          <view v-if="selectedMethod === 'template'" class="result-card">
            <view class="result-section">
              <text class="result-title">🎯 故事模板生成</text>
            </view>
            <view v-if="generatedData.projectBrief" class="result-item">
              <text class="result-label">标题</text>
              <input v-model="generatedData.projectBrief.title" class="editable-field" placeholder="故事标题" />
            </view>
            <view v-if="generatedData.projectBrief" class="result-item">
              <text class="result-label">梗概</text>
              <text v-if="!isFieldEditing('template.synopsis')" class="editable-text" @tap="startEdit('template.synopsis')">{{ generatedData.projectBrief.synopsis || '点击编辑' }}</text>
              <textarea v-else v-model="generatedData.projectBrief.synopsis" class="editable-textarea" placeholder="故事梗概" :auto-height="true" :maxlength="2000" :focus="true" @blur="endEdit" />
            </view>
            <view v-if="generatedData.projectBrief?.coreIdea" class="result-item">
              <text class="result-label">核心创意</text>
              <text v-if="!isFieldEditing('template.coreIdea')" class="editable-text" @tap="startEdit('template.coreIdea')">{{ generatedData.projectBrief.coreIdea || '点击编辑' }}</text>
              <textarea v-else v-model="generatedData.projectBrief.coreIdea" class="editable-textarea" :auto-height="true" :maxlength="1000" :focus="true" @blur="endEdit" />
            </view>
            <!-- 模板大纲 -->
            <view v-if="generatedData.outline" class="result-section" style="margin-top: 16px;">
              <text class="result-title">📝 故事大纲</text>
            </view>
            <view v-if="generatedData.outline?.worldBuilding" class="result-item">
              <text class="result-label">世界观</text>
              <text v-if="!isFieldEditing('template.worldBuilding')" class="editable-text" @tap="startEdit('template.worldBuilding')">{{ generatedData.outline.worldBuilding || '点击编辑' }}</text>
              <textarea v-else v-model="generatedData.outline.worldBuilding" class="editable-textarea" :auto-height="true" :maxlength="3000" :focus="true" @blur="endEdit" />
            </view>
            <view v-if="generatedData.outline?.characters && generatedData.outline.characters.length" class="result-item">
              <text class="result-label">角色设定</text>
              <view class="character-list">
                <view v-for="(char, i) in generatedData.outline.characters" :key="i" class="character-card">
                  <view class="character-header">
                    <input :value="char.name" class="editable-field character-name" placeholder="角色名" @input="generatedData.outline.characters[i].name = $event.detail.value" />
                    <picker :range="roleOptionLabels" @change="onCharRoleChange($event, i, 'template')">
                      <view class="editable-field character-role picker-field">{{ getRoleText(char.role) || '选择角色类型' }}</view>
                    </picker>
                  </view>
                  <text v-if="!isFieldEditing(`template.char.${i}`)" class="editable-text" @tap="startEdit(`template.char.${i}`)">{{ char.description || '点击编辑' }}</text>
                  <textarea v-else :value="char.description" class="editable-textarea" placeholder="角色描述" :auto-height="true" :maxlength="500" :focus="true" @input="generatedData.outline.characters[i].description = $event.detail.value" @blur="endEdit" />
                </view>
              </view>
            </view>
            <view v-if="generatedData.outline?.chapterOutlines && generatedData.outline.chapterOutlines.length" class="result-item">
              <text class="result-label">章节大纲（{{ generatedData.outline.chapterOutlines.length }}章）</text>
              <view class="chapter-list">
                <view v-for="(ch, i) in generatedData.outline.chapterOutlines" :key="i" class="chapter-card">
                  <view class="chapter-header">
                    <text class="chapter-number">第{{ ch.chapter || (i + 1) }}章</text>
                    <input :value="ch.title" class="editable-field chapter-title" placeholder="章节标题" @input="generatedData.outline.chapterOutlines[i].title = $event.detail.value" />
                  </view>
                  <text v-if="!isFieldEditing(`template.ch.${i}`)" class="editable-text" @tap="startEdit(`template.ch.${i}`)">{{ ch.summary || '点击编辑' }}</text>
                  <textarea v-else :value="ch.summary" class="editable-textarea chapter-summary" placeholder="章节摘要" :auto-height="true" :maxlength="500" :focus="true" @input="generatedData.outline.chapterOutlines[i].summary = $event.detail.value" @blur="endEdit" />
                </view>
              </view>
            </view>
          </view>

          <!-- 聊天反馈 -->
          <view class="chat-container">
            <view class="chat-header">
              <text class="chat-title">💬 AI 对话修改</text>
              <text class="chat-desc">也可以通过对话让 AI 修改</text>
            </view>
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

<script lang="ts">
import { ref, onUnmounted, nextTick } from 'vue';
import { createStory } from '../../../api/stories';
import { createNode } from '../../../api/nodes';
import {
  generateProjectBrief,
  generateOutline,
  reviseProjectBrief,
  reviseOutline,
  generatePastiche,
  generateFromTemplate,
  getAiTaskStatus
} from '../../../api/ai';
import { http } from '@/utils/request';
import { mpWsClient } from '@/utils/ws-client';

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
    // 当前正在编辑的字段路径，格式如 'synopsis' | 'worldBuilding' | 'characters.0.description' | 'chapterOutlines.1.summary' | 'plotStructure.act1'
    // 为 null 时所有字段为阅读模式，点击 text 切换为编辑模式
    const editingField = ref<string | null>(null);

    // 点击文本进入编辑模式
    const startEdit = (fieldPath: string) => {
      editingField.value = fieldPath;
    };

    // textarea 失去焦点时退出编辑模式
    const endEdit = () => {
      editingField.value = null;
    };

    // 判断某字段是否处于编辑模式
    const isFieldEditing = (fieldPath: string) => editingField.value === fieldPath;

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

        // 监听任务状态（WebSocket 优先，降级轮询兜底）
        watchCreationTask(result.taskId, false);
      } catch (error) {
        uni.showToast({ title: error.message || '生成失败', icon: 'none' });
        loading.value = false;
      }
    };

    // ========== 任务状态监听（WebSocket 优先，降级轮询兜底） ==========

    // 当前活跃的轮询定时器，用于清理
    let activePollTimer: ReturnType<typeof setTimeout> | null = null;
    // 当前活跃的 WS 取消监听函数
    let activeUnwatch: (() => void) | null = null;
    // 任务是否已结束（防止重复触发）
    let taskAlreadyResolved = false;

    /**
     * 监听 AI 创作任务状态
     * - 优先使用 WebSocket 实时推送
     * - WS 未连接时启动指数退避轮询
     * - 首次调用时做一次 API 查询，防止任务在 WS 监听注册前已完成（竞态条件）
     */
    function watchCreationTask(id: number, isRevision: boolean) {
      // 清理上一次的监听
      cleanupWatchers();
      taskAlreadyResolved = false;

      // 任务完成回调
      function onTaskCompleted(data: any) {
        loading.value = false;

        // 先设为 null，让 textarea 先渲染为空（清除旧高度）
        generatedData.value = null;

        // 在下一个 tick 设置真实数据，让 textarea 根据内容重新计算 auto-height
        nextTick(() => {
          // 根据不同方法提取对应的结果数据
          if (selectedMethod.value === 'project') {
            generatedData.value = data.result?.projectBrief;
          } else if (selectedMethod.value === 'outline') {
            generatedData.value = data.result?.outline;
          } else if (selectedMethod.value === 'pastiche') {
            generatedData.value = data.result?.pastiche || data.result;
          } else if (selectedMethod.value === 'template') {
            generatedData.value = data.result?.template || data.result;
          }

          chatMessages.value.push({
            type: 'assistant',
            content: isRevision ? '修改完成！请查看更新后的内容。' : '生成完成！如有不满意可以提出修改意见。'
          });
        });
      }

      // 任务失败回调
      function onTaskFailed(errorMessage: string) {
        const msg = errorMessage || (isRevision ? '修改失败' : '生成失败');
        if (isRevision) {
          chatMessages.value.push({ type: 'assistant', content: '修改失败：' + msg });
        } else {
          uni.showToast({ title: msg, icon: 'none' });
          loading.value = false;
        }
      }

      // 防重复触发的包装回调
      function onTaskCompletedOnce(data: any) {
        if (taskAlreadyResolved) return;
        taskAlreadyResolved = true;
        cleanupWatchers();
        onTaskCompleted(data);
      }

      function onTaskFailedOnce(errorMessage: string) {
        if (taskAlreadyResolved) return;
        taskAlreadyResolved = true;
        cleanupWatchers();
        onTaskFailed(errorMessage);
      }

      // 1. 首先做一次 API 查询，检查任务是否已完成（防竞态）
      checkTaskOnce(id, onTaskCompletedOnce, onTaskFailedOnce);

      // 2. 注册 WebSocket 监听
      const unwatch = mpWsClient.watchTask(id, (wsData: any) => {
        if (wsData.status === 'completed') {
          // WS 推送的 result 可能是简化版，通过 API 获取完整结果
          fetchTaskResult(id, onTaskCompletedOnce, onTaskFailedOnce);
        } else if (wsData.status === 'failed') {
          onTaskFailedOnce(wsData.errorMessage || '任务失败');
        }
      });
      activeUnwatch = unwatch;

      // 3. 启动降级轮询兜底（WS 断连时仍能获取结果）
      const pollInterval = mpWsClient.isConnected() ? 5000 : 2000;
      const maxInterval = 15000;
      const maxAttempts = 120; // 最多轮询 120 次（约 10 分钟）
      let currentInterval = pollInterval;
      let attempts = 0;

      function poll() {
        if (taskAlreadyResolved) return;
        attempts++;
        if (attempts > maxAttempts) {
          onTaskFailedOnce('生成超时，请稍后在创作台查看结果');
          return;
        }

        getAiTaskStatus(id).then((result: any) => {
          if (taskAlreadyResolved) return;
          if (result.status === 'completed') {
            onTaskCompletedOnce(result);
          } else if (result.status === 'failed') {
            onTaskFailedOnce(result.errorMessage || '生成失败');
          } else {
            // 继续轮询，指数退避
            currentInterval = Math.min(currentInterval * 1.2, maxInterval);
            activePollTimer = setTimeout(poll, currentInterval);
          }
        }).catch(() => {
          // 网络错误不中断，继续轮询
          currentInterval = Math.min(currentInterval * 1.2, maxInterval);
          activePollTimer = setTimeout(poll, currentInterval);
        });
      }

      // 延迟启动轮询（首次查询已由 checkTaskOnce 完成）
      activePollTimer = setTimeout(poll, currentInterval);

      console.log(`[AI 创作] 任务 ${id} 已注册 WebSocket 监听 + 轮询兜底`);
    }

    /** 一次性查询任务状态（防竞态：任务可能在 WS 监听注册前已完成） */
    async function checkTaskOnce(taskId: number, onSuccess: (data: any) => void, onFailed: (msg: string) => void) {
      try {
        const result = await getAiTaskStatus(taskId);
        if (result.status === 'completed') {
          console.log(`[AI 创作] 任务 ${taskId} 已完成（首次查询命中）`);
          onSuccess(result);
        } else if (result.status === 'failed') {
          console.log(`[AI 创作] 任务 ${taskId} 已失败（首次查询命中）`);
          onFailed(result.errorMessage || '任务失败');
        }
        // pending/processing 状态不做处理，交给 WS + 轮询
      } catch (error) {
        console.warn('[AI 创作] 首次任务状态查询失败:', error);
      }
    }

    /** 从 API 获取任务完整结果（WS 推送的 result 可能是简化版） */
    async function fetchTaskResult(taskId: number, onSuccess: (data: any) => void, onFailed: (msg: string) => void) {
      try {
        const result = await getAiTaskStatus(taskId);
        if (result.status === 'completed') {
          onSuccess(result);
        } else if (result.status === 'failed') {
          onFailed(result.errorMessage || '任务失败');
        } else {
          // 不应出现此情况，但保险起见继续轮询
          console.warn('[AI 创作] WS 推送 completed 但 API 返回非完成状态，继续轮询');
        }
      } catch (error) {
        console.error('[AI 创作] 获取任务结果失败:', error);
        onFailed(error.message || '获取结果失败');
      }
    }

    /** 清理所有监听器和定时器 */
    function cleanupWatchers() {
      if (activeUnwatch) {
        activeUnwatch();
        activeUnwatch = null;
      }
      if (activePollTimer) {
        clearTimeout(activePollTimer);
        activePollTimer = null;
      }
    }

    // 组件销毁时清理
    onUnmounted(() => {
      cleanupWatchers();
    });

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
        watchCreationTask(result.taskId, true);
      } catch (error) {
        uni.showToast({ title: error.message, icon: 'none' });
      }
    };

    const handleConfirm = async () => {
      if (!generatedData.value) return;

      try {
        let projectBriefData: any = null;
        let outlineData: any = null;
        let storyTitle = '新故事';
        let storySynopsis = '';

        // 根据不同方式归一化数据结构
        if (selectedMethod.value === 'project') {
          // 智能导入立项：generatedData 同时包含立项书和大纲字段
          projectBriefData = {
            title: generatedData.value.title,
            synopsis: generatedData.value.synopsis,
            coreIdea: generatedData.value.coreIdea,
            targetAudience: generatedData.value.targetAudience,
            genre: generatedData.value.genre,
            writingStyle: generatedData.value.writingStyle,
            chapterStructure: generatedData.value.chapterStructure,
            highlights: generatedData.value.highlights
          };
          outlineData = (generatedData.value.worldBuilding || generatedData.value.characters || generatedData.value.chapterOutlines)
            ? {
                worldBuilding: generatedData.value.worldBuilding,
                characters: generatedData.value.characters,
                plotStructure: generatedData.value.plotStructure,
                chapterOutlines: generatedData.value.chapterOutlines
              }
            : null;
          storyTitle = generatedData.value.title || '新故事';
          storySynopsis = generatedData.value.synopsis || '';
        } else if (selectedMethod.value === 'outline') {
          // AI 辅助大纲：generatedData 是大纲，需反向生成立项书摘要
          outlineData = {
            worldBuilding: generatedData.value.worldBuilding,
            characters: generatedData.value.characters,
            plotStructure: generatedData.value.plotStructure,
            chapterOutlines: generatedData.value.chapterOutlines
          };
          projectBriefData = {
            title: formData.value.coreIdea ? formData.value.coreIdea.substring(0, 30) : '新故事',
            synopsis: generatedData.value.plotStructure
              ? `${generatedData.value.plotStructure.act1 || ''} ${generatedData.value.plotStructure.act2 || ''}`.substring(0, 200)
              : '',
            coreIdea: formData.value.coreIdea || '',
            genre: formData.value.outlineGenre || '',
            highlights: []
          };
          storyTitle = projectBriefData.title;
          storySynopsis = projectBriefData.synopsis;
        } else if (selectedMethod.value === 'pastiche') {
          // 经典仿写：generatedData = { analysis, projectBrief, outline }
          projectBriefData = generatedData.value.projectBrief || {
            title: formData.value.bookName ? `${formData.value.bookName}·仿写` : '仿写作品',
            synopsis: generatedData.value.analysis?.style || '',
            coreIdea: '',
            genre: '',
            highlights: []
          };
          outlineData = generatedData.value.outline || null;
          storyTitle = projectBriefData.title || '仿写作品';
          storySynopsis = projectBriefData.synopsis || '';
        } else if (selectedMethod.value === 'template') {
          // 故事模板：generatedData = { projectBrief, outline }
          projectBriefData = generatedData.value.projectBrief || {
            title: '模板故事',
            synopsis: '',
            coreIdea: '',
            genre: '',
            highlights: []
          };
          outlineData = generatedData.value.outline || null;
          storyTitle = projectBriefData.title || '模板故事';
          storySynopsis = projectBriefData.synopsis || '';
        }

        // 创建故事（含立项书）
        const storyData = {
          title: storyTitle,
          description: storySynopsis,
          project_brief: JSON.stringify(projectBriefData),
          ai_assisted_created: true,
          ai_creation_method: selectedMethod.value
        };

        const result = await createStory(storyData as any);
        const storyId = result.id || result.story?.id;

        // 创建大纲记录
        if (outlineData && (outlineData.chapterOutlines || outlineData.worldBuilding || outlineData.characters)) {
          try {
            await http.post(`/api/ai/creation/stories/${storyId}/outlines`, {
              outline: outlineData,
              changeNote: 'AI 生成初始版本'
            });
          } catch (e) {
            console.error('创建大纲记录失败:', e);
          }
        }

        // 自动创建第一章节点
        let firstNodeId: number | null = null;
        if (outlineData && outlineData.chapterOutlines && outlineData.chapterOutlines.length > 0) {
          const firstChapter = outlineData.chapterOutlines[0];
          try {
            const nodeRes = await createNode({
              story_id: storyId,
              title: firstChapter.title || '第一章',
              content: firstChapter.summary || '',
              isPublished: false
            });
            firstNodeId = nodeRes?.node?.id || null;
          } catch (e) {
            console.warn('自动创建第一章失败:', e);
          }
        }

        uni.showToast({ title: '创建成功', icon: 'success' });

        setTimeout(() => {
          // 优先跳转到已创建的第一章编辑页，否则以 storyId 新建模式进入
          if (firstNodeId) {
            uni.redirectTo({
              url: `/pkgWrite/pages/write/editor?nodeId=${firstNodeId}&storyId=${storyId}`
            });
          } else {
            uni.redirectTo({
              url: `/pkgWrite/pages/write/editor?storyId=${storyId}&storyTitle=${encodeURIComponent(storyTitle)}`
            });
          }
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

    // 编辑仿写分析内容（兼容 analysis 为字符串或对象的情况）
    const handleEditAnalysis = (e: any) => {
      const value = e.detail.value;
      if (typeof generatedData.value.analysis === 'string') {
        generatedData.value.analysis = value;
      } else if (generatedData.value.analysis) {
        generatedData.value.analysis.summary = value;
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

    // 角色类型选项
    const roleOptions = [
      { value: 'protagonist', label: '主角' },
      { value: 'antagonist', label: '反派' },
      { value: 'supporting', label: '配角' },
      { value: 'love_interest', label: '感情线' },
    ];
    const roleOptionLabels = roleOptions.map(r => r.label);

    function getRoleText(role: string): string {
      const roleMap: Record<string, string> = {
        protagonist: '主角',
        antagonist: '反派',
        supporting: '配角',
        love_interest: '感情线',
      };
      return roleMap[role] || role || '未知';
    }

    function onCharRoleChange(e: any, index: number, section: string) {
      const selectedLabel = roleOptionLabels[e.detail.value];
      const selectedRole = roleOptions.find(r => r.label === selectedLabel);
      if (!selectedRole) return;
      if (section === 'project' || section === 'outline') {
        if (generatedData.value?.characters) {
          generatedData.value.characters[index].role = selectedRole.value;
        }
      } else if (section === 'template') {
        if (generatedData.value?.outline?.characters) {
          generatedData.value.outline.characters[index].role = selectedRole.value;
        }
      } else if (section === 'pastiche') {
        if (generatedData.value?.outline?.characters) {
          generatedData.value.outline.characters[index].role = selectedRole.value;
        }
      }
    }

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
      handleBack,
      handleEditAnalysis,
      roleOptionLabels,
      getRoleText,
      onCharRoleChange,
      editingField,
      startEdit,
      endEdit,
      isFieldEditing
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
  margin-bottom: 16px;
}

.form-label {
  display: block;
  font-size: 15px;
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
}

.form-textarea {
  width: 100%;
  min-height: 60px;
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  font-size: 15px;
  line-height: 1.5;
  box-sizing: border-box;
  background: #fafbfc;
  height: auto;
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
  font-weight: 500;
}

.loading-hint {
  font-size: 12px;
  color: #9ca3af;
  margin-top: 8px;
}

.result-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.result-card {
  background: #fff;
  border-radius: 12px;
  padding: 12px;
}

.result-section {
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e5e7eb;
}

.result-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.result-item {
  margin-bottom: 10px;
}

.result-label {
  display: block;
  font-size: 13px;
  color: #6b7280;
  font-weight: 500;
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

/* 可编辑字段样式 */
.edit-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  background: linear-gradient(135deg, rgba(124, 106, 247, 0.08), rgba(102, 126, 234, 0.05));
  border-radius: 10px;
  margin-bottom: 4px;
}

.edit-hint-icon {
  font-size: 14px;
}

.edit-hint-text {
  font-size: 13px;
  color: #7c6af7;
}

/* 通用可编辑输入框 - 单行 */
.editable-field {
  width: 100%;
  height: 40px;
  padding: 0 12px;
  border: 1.5px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  line-height: 40px;
  color: #333;
  background: #fafbfc;
  box-sizing: border-box;
  transition: border-color 0.2s, background-color 0.2s;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 小程序 input 组件需要覆盖内联样式 */
input.editable-field {
  height: 40px;
  line-height: normal;
  padding: 8px 12px;
}

.editable-field:focus {
  border-color: #7c6af7;
  background: #fff;
  outline: none;
  box-shadow: 0 0 0 3px rgba(124, 106, 247, 0.1);
}

/* 通用可编辑文本域 - 多行自动高度 */
.editable-textarea {
  width: 100%;
  padding: 8px 10px;
  border: 1.5px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.5;
  color: #333;
  background: #fafbfc;
  box-sizing: border-box;
  min-height: 36px;
  height: auto;
  transition: border-color 0.2s, background-color 0.2s;
}

/* 阅读模式下的可编辑文本（点击进入编辑模式） */
.editable-text {
  display: block;
  font-size: 14px;
  line-height: 1.6;
  color: #333;
  padding: 8px 10px;
  border: 1.5px solid #e5e7eb;
  border-radius: 8px;
  background: #fafbfc;
  min-height: 20px;
  word-break: break-word;
  white-space: pre-wrap;
}

.editable-textarea:focus {
  border-color: #7c6af7;
  background: #fff;
  outline: none;
  box-shadow: 0 0 0 3px rgba(124, 106, 247, 0.1);
}

.highlight-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.highlight-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.highlight-input {
  flex: 1;
}

.highlight-remove {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ef4444;
  font-size: 16px;
  flex-shrink: 0;
}

.highlight-add {
  padding: 8px 12px;
  color: #7c6af7;
  font-size: 14px;
  font-weight: 500;
}

.character-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.character-card {
  padding: 10px;
  background: #f9fafb;
  border-radius: 10px;
  border: 1.5px solid #e5e7eb;
  transition: border-color 0.2s ease;
}

.character-header {
  display: flex;
  gap: 8px;
  margin-bottom: 6px;
  align-items: center;
}

.character-name {
  flex: 2;
  min-width: 0;
}

.character-role {
  flex: 1;
  min-width: 0;
}

.picker-field {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  height: 40px;
  padding: 0 8px;
  cursor: pointer;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
  /* 覆盖 editable-field 的 input 特定样式，picker 用 view 展示 */
  line-height: normal;
  height: auto;
  min-height: 40px;
  padding: 8px;
}

.chapter-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chapter-card {
  padding: 10px;
  background: #f9fafb;
  border-radius: 10px;
  border: 1.5px solid #e5e7eb;
  transition: border-color 0.2s ease;
}

.chapter-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  flex-wrap: nowrap;
}

.chapter-number {
  font-size: 13px;
  color: #7c6af7;
  font-weight: 600;
  flex-shrink: 0;
  white-space: nowrap;
}

.chapter-title {
  flex: 1;
  min-width: 0;
}

.chapter-summary {
  min-height: 36px;
}

.plot-item {
  margin-bottom: 12px;
}

.plot-label {
  display: block;
  font-size: 12px;
  color: #7c6af7;
  font-weight: 600;
  margin-bottom: 6px;
}

.chat-header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 12px 16px 0;
}

.chat-title {
  font-size: 15px;
  font-weight: 600;
  color: #333;
}

.chat-desc {
  font-size: 12px;
  color: #9ca3af;
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