<template>
  <div class="totp-counter" v-if="totpInfo.isValid">
    <!-- TOTP Code -->
    <div class="totp-code-container">
      <div class="totp-code" :class="{ 'expiring': totpInfo.expiring }">
        {{ totpInfo.formattedCode || '--- ---' }}
      </div>
      <div class="totp-actions">
        <ClipboardButton 
          v-if="totpInfo.code" 
          :copy="totpInfo.code" 
          class="totp-copy"
        />
      </div>
    </div>

    <!-- Progress Bar and Countdown -->
    <div class="totp-timer">
      <div class="progress-bar">
        <div 
          class="progress-fill" 
          :style="{ width: totpInfo.progress + '%' }"
          :class="{ 'expiring': totpInfo.expiring }"
        ></div>
      </div>
      <div class="timer-text" :class="{ 'expiring': totpInfo.expiring }">
        {{ totpInfo.remaining }}s
      </div>
    </div>
  </div>
  <div v-else class="totp-error">
    <span class="error-message">Invalid TOTP secret</span>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted } from 'vue'
import totpService from '@/utils/totp'

export default {
  name: 'TOTPCounter',
  props: {
    secret: {
      type: String,
      required: true
    }
  },
  setup(props) {
    const totpInfo = ref({
      code: null,
      formattedCode: null,
      remaining: 30,
      progress: 100,
      expiring: false,
      isValid: false
    })

    let intervalId = null

    const updateTotpInfo = () => {
      if (props.secret) {
        totpInfo.value = totpService.getTotpInfo(props.secret)
      }
    }

    onMounted(() => {
      // Update initial value immediately
      updateTotpInfo()

      // Update every second
      intervalId = setInterval(updateTotpInfo, 1000)
    })

    onUnmounted(() => {
      // Clear interval
      if (intervalId) {
        clearInterval(intervalId)
      }
    })

    return {
      totpInfo
    }
  }
}
</script>

<style scoped lang="scss">
.totp-counter {
  padding: 12px;
  background: var(--color-background-light, #f5f5f5);
  border-radius: 8px;
  margin: 8px 0;
}

.totp-code-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.totp-code {
  font-family: 'Courier New', monospace;
  font-size: 24px;
  font-weight: bold;
  letter-spacing: 4px;
  color: var(--color-text-primary, #333);
  transition: color 0.3s ease;
  
  &.expiring {
    color: #e74c3c;
    animation: pulse 0.5s ease-in-out infinite;
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

.totp-actions {
  display: flex;
  gap: 8px;
}

.totp-copy {
  cursor: pointer;
}

.totp-timer {
  display: flex;
  align-items: center;
  gap: 8px;
}

.progress-bar {
  flex: 1;
  height: 6px;
  background: var(--color-background-darker, #e0e0e0);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #3498db;
  transition: width 1s linear, background-color 0.3s ease;
  border-radius: 3px;
  
  &.expiring {
    background: #e74c3c;
  }
}

.timer-text {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-secondary, #666);
  min-width: 32px;
  text-align: right;
  transition: color 0.3s ease;
  
  &.expiring {
    color: #e74c3c;
  }
}

.totp-error {
  padding: 12px;
  background: #fee;
  border-radius: 8px;
  margin: 8px 0;
}

.error-message {
  color: #c33;
  font-size: 14px;
}
</style>

