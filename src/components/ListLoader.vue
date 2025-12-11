<template>
  <div>
    <div
      v-for="(item, index) in items"
      :key="index"
      class="d-flex flex-justify-between flex-content-center py-3 item"
    >
      <div class="skeleton skeleton-avatar"></div>
      <div class="flex-auto ml-3">
        <div class="skeleton skeleton-line" style="width: 43%;"></div>
        <div class="skeleton skeleton-line mt-2" style="width: 90%;"></div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ListLoader',
  data() {
    return {
      items: Array.from({ length: 10 })
    }
  }
}
</script>

<style lang="scss" scoped>
.skeleton {
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.12) 25%,
    rgba(255, 255, 255, 0.18) 50%,
    rgba(255, 255, 255, 0.12) 75%
  );
  background-size: 200% 100%;
  animation: loading 1.5s ease-in-out infinite;
}

.skeleton-avatar {
  width: 40px;
  height: 40px;
  border-radius: 8px;
}

.skeleton-line {
  height: 15px;
  border-radius: 4px;
}

@keyframes loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>
