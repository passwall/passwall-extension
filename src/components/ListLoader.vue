<template>
  <div>
    <div
      v-for="(item, index) in items"
      :key="index"
      class="d-flex flex-justify-between flex-content-center py-3 c-pointer item"
    >
      <vue-skeleton-loader
        type="rect"
        :width="40"
        :height="40"
        animation="fade"
        color="rgba(255,255,255,0.12)"
        rounded
        radius="8"
      />
      <div class="flex-auto ml-3">
        <vue-skeleton-loader
          type="rect"
          :width="43"
          :height="15"
          animation="fade"
          color="rgba(255,255,255,0.12)"
        />
        <vue-skeleton-loader
          class="mt-2"
          type="rect"
          :width="90"
          :height="15"
          animation="fade"
          color="rgba(255,255,255,0.12)"
        />
      </div>
    </div>
  </div>
</template>

<script>
import VueSkeletonLoader from 'skeleton-loader-vue'
export default {
  name: 'ListLoader',
  components: { VueSkeletonLoader },
  data() {
    return {
      items: Array.from({ length: 10 })
    }
  }
}
</script>

<style></style>
