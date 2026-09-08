<template>
  <AppShell
    label="Family Helper"
    :badge="isLoggedIn ? '已登录' : '邮箱登录'"
    :show-nav="false"
  >
    <view class="page">
      <StateBlock
        v-if="sessionState.loading && !sessionState.initialized"
        title="正在恢复登录状态"
        description="稍等一下，我们正在同步你的家庭与家务记录。"
      />

      <StateBlock
        v-else-if="sessionState.configError"
        title="缺少 Supabase 配置"
        :description="sessionState.configError"
      />

      <StateBlock
        v-else-if="sessionState.sessionError"
        title="恢复登录状态失败"
        :description="sessionState.sessionError"
      >
        <template #actions>
          <up-button type="primary" shape="circle" @click="reloadPage">刷新页面</up-button>
        </template>
      </StateBlock>

      <view v-else-if="isLoggedIn && hasProfile" class="stack">
        <view class="summary-grid">
          <view class="summary-card card summary-card--link" @tap="goToFamily">
            <text class="summary-label">家庭名称</text>
            <text class="summary-value">{{ familyName }}</text>
          </view>
          <view class="summary-card card summary-card--link" @tap="goToFamily">
            <text class="summary-label">家庭码</text>
            <text class="summary-value">{{ joinCode }}</text>
          </view>
          <view class="summary-card card summary-card--link" @tap="goToDashboard('chores')">
            <text class="summary-label">快捷入口</text>
            <text class="summary-value">家务记录</text>
          </view>
          <view class="summary-card card summary-card--link" @tap="goToItems">
            <text class="summary-label">快捷入口</text>
            <text class="summary-value">物品记录</text>
          </view>
        </view>

        <view v-if="createdFamilyCode" class="card code-card">
          <text class="card-title">家庭创建成功</text>
          <text class="card-subtitle">把这串家庭码分享给家人，他们注册后就能加入同一个家庭。</text>
          <view class="code-row">
            <text class="code-value">{{ createdFamilyCode }}</text>
            <view class="copy-button" @tap="copyCode">
              <text>复制</text>
            </view>
          </view>
          <up-button plain shape="circle" @click="goToDashboard('chores')">
            现在开始记录家务
          </up-button>
        </view>
      </view>

      <view v-else class="stack">
        <StateBlock
          v-if="isLoggedIn && sessionState.profileMissing"
          title="家庭初始化未完成"
          description="你的账号已经登录，但还没有加入任何家庭。请继续完成家庭初始化。"
        />

        <view class="panel-switch">
          <view
            class="switch-item"
            :class="{ 'switch-item--active': activePanel === 'login' }"
            @tap="activePanel = 'login'"
          >
            <text>登录</text>
          </view>
          <view
            class="switch-item"
            :class="{ 'switch-item--active': activePanel === 'register' }"
            @tap="activePanel = 'register'"
          >
            <text>{{ isLoggedIn && sessionState.profileMissing ? '继续初始化' : '注册' }}</text>
          </view>
        </view>

        <view v-if="activePanel === 'login' && !isLoggedIn" class="card auth-card">
          <text class="card-title">已有家庭成员账号</text>
          <text class="card-subtitle">直接用邮箱和密码登录，继续你的记录。</text>
          <view class="field">
            <text class="field-label">邮箱</text>
            <input v-model.trim="loginForm.email" class="field-input" placeholder="family@example.com" />
          </view>
          <view class="field">
            <text class="field-label">密码</text>
            <input
              v-model="loginForm.password"
              class="field-input"
              placeholder="请输入密码"
              password
            />
          </view>
          <up-button
            type="primary"
            shape="circle"
            :loading="submitting"
            @click="handleLogin"
          >
            登录
          </up-button>
        </view>

        <view v-else class="card auth-card">
          <text class="card-title">
            {{ isLoggedIn && sessionState.profileMissing ? '继续初始化当前账号' : '创建家庭成员账号' }}
          </text>
          <text class="card-subtitle">
            {{ isLoggedIn && sessionState.profileMissing ? '只差一步，就可以把当前账号加入家庭。' : '注册后即可创建家庭，或者使用家庭码加入。' }}
          </text>

          <view class="mode-switch">
            <view
              class="mode-chip"
              :class="{ 'mode-chip--active': registerMode === 'create' }"
              @tap="registerMode = 'create'"
            >
              <text>创建家庭</text>
            </view>
            <view
              class="mode-chip"
              :class="{ 'mode-chip--active': registerMode === 'join' }"
              @tap="registerMode = 'join'"
            >
              <text>加入家庭</text>
            </view>
          </view>

          <view v-if="!isLoggedIn" class="field">
            <text class="field-label">邮箱</text>
            <input v-model.trim="registerForm.email" class="field-input" placeholder="family@example.com" />
          </view>

          <view v-if="!isLoggedIn" class="field">
            <text class="field-label">密码</text>
            <input
              v-model="registerForm.password"
              class="field-input"
              placeholder="至少 6 位密码"
              password
            />
          </view>

          <view class="field">
            <text class="field-label">昵称</text>
            <input v-model.trim="registerForm.displayName" class="field-input" placeholder="比如：阿杰 / 妈妈 / 室友A" />
          </view>

          <view v-if="registerMode === 'create'" class="field">
            <text class="field-label">家庭名称</text>
            <input v-model.trim="registerForm.familyName" class="field-input" placeholder="比如：我们的小家" />
          </view>

          <view v-else class="field">
            <text class="field-label">家庭码</text>
            <input v-model.trim="registerForm.joinCode" class="field-input" placeholder="输入 6 位家庭码" />
          </view>

          <up-button
            type="primary"
            shape="circle"
            :loading="submitting"
            @click="handleRegister"
          >
            {{ registerMode === 'create' ? '创建并进入家庭' : '加入家庭' }}
          </up-button>
        </view>
      </view>
    </view>
  </AppShell>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppShell from '@/components/common/AppShell.vue'
import StateBlock from '@/components/common/StateBlock.vue'
import {
  createFamilyForCurrentUser,
  joinFamilyForCurrentUser,
  signInWithPassword,
  signUpAndCreateFamily,
  signUpAndJoinFamily,
} from '@/services/auth'
import { refreshProfile, useSession } from '@/composables/useSession'
import { copyText, showError, showSuccess } from '@/utils/feedback'
import { getRememberedCredentials, saveRememberedCredentials } from '@/utils/rememberedCredentials'

const { state: sessionState, isLoggedIn, hasProfile } = useSession()
// const { state: sessionState, hasProfile } = useSession()
// const isLoggedIn = false;

const activePanel = ref('login')
const registerMode = ref('create')
const submitting = ref(false)
const createdFamilyCode = ref('')

const loginForm = reactive({
  email: '',
  password: '',
})

const registerForm = reactive({
  email: '',
  password: '',
  displayName: '',
  familyName: '',
  joinCode: '',
})

const profileFamily = computed(() => {
  const family = sessionState.profile?.family
  return Array.isArray(family) ? family[0] : family
})

const displayName = computed(() => sessionState.profile?.display_name || '家庭成员')
const familyName = computed(() => profileFamily.value?.name || '未加入家庭')
const joinCode = computed(() => profileFamily.value?.join_code || '--')

function applyRememberedCredentials() {
  if (isLoggedIn.value) {
    return
  }

  const remembered = getRememberedCredentials()
  if (!remembered) {
    return
  }

  if (!loginForm.email) {
    loginForm.email = remembered.email
  }

  if (!loginForm.password) {
    loginForm.password = remembered.password
  }
}

onShow(() => {
  if (isLoggedIn.value && hasProfile.value) {
    activePanel.value = 'login'
  } else if (isLoggedIn.value && sessionState.profileMissing) {
    activePanel.value = 'register'
  } else {
    activePanel.value = 'login'
    applyRememberedCredentials()
  }
})

applyRememberedCredentials()

function goTo(url) {
  uni.navigateTo({ url })
}

function goToDashboard(tab = 'chores') {
  goTo(`/pages/dashboard/index?tab=${tab}`)
}

function goToItems() {
  goTo('/pages/items/index')
}

function goToFamily() {
  goTo('/pages/family/index')
}

function reloadPage() {
  // #ifdef H5
  window.location.reload()
  // #endif

  // #ifndef H5
  uni.reLaunch({
    url: '/pages/index/index',
  })
  // #endif
}

function copyCode() {
  if (createdFamilyCode.value) {
    copyText(createdFamilyCode.value, '家庭码已复制')
  }
}

async function syncProfile() {
  await refreshProfile()
}

async function handleLogin() {
  if (!loginForm.email || !loginForm.password) {
    showError('请填写邮箱和密码')
    return
  }

  submitting.value = true
  try {
    await signInWithPassword(loginForm.email, loginForm.password)
    saveRememberedCredentials({
      email: loginForm.email,
      password: loginForm.password,
    })
    await syncProfile()
    showSuccess('登录成功')
    if (sessionState.profile?.family_id) {
      uni.navigateTo({
        url: '/pages/dashboard/index?tab=chores',
      })
    } else {
      activePanel.value = 'register'
    }
  } catch (error) {
    showError(error, '登录失败')
  } finally {
    submitting.value = false
  }
}

async function handleRegister() {
  if (!registerForm.displayName) {
    showError('请填写昵称')
    return
  }

  if (registerMode.value === 'create' && !registerForm.familyName) {
    showError('请填写家庭名称')
    return
  }

  if (registerMode.value === 'join' && !registerForm.joinCode) {
    showError('请输入家庭码')
    return
  }

  if (!isLoggedIn.value && (!registerForm.email || !registerForm.password)) {
    showError('请填写邮箱和密码')
    return
  }

  submitting.value = true
  try {
    let result
    if (isLoggedIn.value) {
      result =
        registerMode.value === 'create'
          ? await createFamilyForCurrentUser({
              displayName: registerForm.displayName,
              familyName: registerForm.familyName,
            })
          : await joinFamilyForCurrentUser({
              displayName: registerForm.displayName,
              joinCode: registerForm.joinCode,
            })
    } else {
      result =
        registerMode.value === 'create'
          ? await signUpAndCreateFamily({
              email: registerForm.email,
              password: registerForm.password,
              displayName: registerForm.displayName,
              familyName: registerForm.familyName,
            })
          : await signUpAndJoinFamily({
              email: registerForm.email,
              password: registerForm.password,
              displayName: registerForm.displayName,
              joinCode: registerForm.joinCode,
            })
    }

    if (!isLoggedIn.value) {
      saveRememberedCredentials({
        email: registerForm.email,
        password: registerForm.password,
      })
    }

    createdFamilyCode.value = result?.join_code || ''
    showSuccess(registerMode.value === 'create' ? '家庭创建成功' : '已加入家庭')
    await syncProfile()
    if (registerMode.value === 'join' && sessionState.profile?.family_id) {
      uni.navigateTo({
        url: '/pages/dashboard/index?tab=chores',
      })
    }
  } catch (error) {
    showError(error, '注册或加入家庭失败')
  } finally {
    submitting.value = false
  }
}
</script>

<style lang="scss" scoped>
.page,
.stack {
  display: flex;
  flex-direction: column;
  gap: 22rpx;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  padding: 30rpx;
  border-radius: 28rpx;
  background: rgba(255, 251, 245, 0.92);
  box-shadow: 0 16rpx 40rpx rgba(84, 54, 37, 0.08);
}

.card-title {
  font-size: 34rpx;
  font-weight: 700;
  color: #2d211a;
}

.card-subtitle {
  font-size: 26rpx;
  line-height: 1.7;
  color: #6c5c50;
}

.panel-switch,
.mode-switch,
.cta-row,
.summary-grid,
.code-row {
  display: flex;
  gap: 24rpx;
}

.cta-row{
  gap:40rpx;
}

.panel-switch {
  padding: 10rpx;
  border-radius: 999rpx;
  background: rgba(255, 248, 240, 0.9);
}

.switch-item,
.mode-chip {
  flex: 1;
  padding: 18rpx 22rpx;
  border-radius: 999rpx;
  text-align: center;
  color: #7a6454;
  background: transparent;
}

.switch-item--active,
.mode-chip--active {
  background: #2c221b;
  color: #fff8f1;
}

.auth-card,
.welcome-card,
.code-card {
  gap: 22rpx;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.field-label {
  font-size: 24rpx;
  color: #7b6658;
}

.field-input {
  width: 100%;
  min-height: 88rpx;
  padding: 0 24rpx;
  border: 2rpx solid rgba(153, 120, 93, 0.18);
  border-radius: 22rpx;
  background: #fffdf9;
  font-size: 28rpx;
  color: #2b211b;
}

.summary-grid {
  flex-wrap: wrap;
}

.summary-card {
  flex: 1;
  min-width: 220rpx;
}

.summary-card--link {
  cursor: pointer;
}

.summary-label {
  font-size: 24rpx;
  color: #8f7564;
}

.summary-value {
  font-size: 38rpx;
  font-weight: 700;
  color: #33251d;
}

.code-row {
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 24rpx;
  border-radius: 24rpx;
  background: #f7efe4;
}

.code-value {
  font-size: 42rpx;
  font-weight: 700;
  letter-spacing: 0.18em;
  color: #c96a3d;
}

.copy-button {
  padding: 12rpx 20rpx;
  border-radius: 999rpx;
  background: #2f241d;
  color: #fff8f2;
  font-size: 24rpx;
}

@media screen and (min-width: 900px) {
  .summary-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
