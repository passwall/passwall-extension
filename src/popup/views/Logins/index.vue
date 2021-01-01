<template>
  <div class="p-3 head">
    <span class="fw-bold h5">Logins</span>
  </div>
</template>

<script>
import { mapState } from "vuex";
export default {
  created() {
    console.log(this.items);
  },
  computed: {
    ...mapState("Logins", ["items"]),
  },
};
</script>

<style scoped lang="scss">
.head {
  border-bottom: 2px solid $color-black;
}
</style>
