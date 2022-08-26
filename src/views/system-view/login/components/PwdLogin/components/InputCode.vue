<template>
  <n-modal
    v-model:show="showModal"
    preset="dialog"
    title="验证码"
    content="你确认"
    positive-text="确认"
    negative-text="算了"
    :show-icon="false"
    :closable="false"
    @positive-click="onPositiveClick"
    @negative-click="onNegativeClick"
  >
    <n-input-group>
      <n-input ref="inputRef" v-model:value="code" placeholder="验证码" autosize style="min-width: 50%" />
      <div class="w-18px"></div>
      <n-button size="large" :disabled="isCounting" :loading="smsLoading" @click="handleSmsCheckCode">
        {{ label }}
      </n-button>
    </n-input-group>
  </n-modal>
</template>

<script lang="ts" setup>
import { ref, computed, nextTick, watch } from 'vue';
import { useAuthStore } from '@/store';
import { useSmsCode } from '@/hooks';
const { label, isCounting, loading: smsLoading, getSmsCheckCode } = useSmsCode();

const code = ref('');
interface Props {
  showInput: boolean;
}

interface Emits {
  (e: 'showInputCode:value', val: boolean): void;
}

const auth = useAuthStore();

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const inputRef = ref<HTMLInputElement>();

const showModal = computed({
  get() {
    return props.showInput;
  },
  set(val: boolean) {
    // emit('showInputCode:value', val);
  }
});

watch(showModal, async val => {
  if (val) {
    /** 自动聚焦 */
    await nextTick();
    inputRef.value?.focus();
  }
});

function handleSmsCheckCode() {
  const mafId = auth.getMfaId;
  getSmsCheckCode(mafId, false);
}
function onNegativeClick() {
  // showModal = false;
  auth.setShowCodeInput(false);
}
function onPositiveClick() {
  // showInput = false;
  const mafId = auth.getMfaId;
  auth.loginByCode(code.value, mafId);
  auth.setShowCodeInput(false);
}
</script>
