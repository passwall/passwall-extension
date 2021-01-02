<template>
  <div class="container">
    <div class="mx-3">
      <div class="py-3 head">
        <span class="fw-bold h5">Logins</span>
      </div>

      <EmptyState v-if="items.length <= 0" />

      <ul class="items" v-else>
        <ListItem
          v-for="item in items"
          :key="item.id"
          :url="item.url"
          :title="item.title"
          :username="item.username"
        />
      </ul>
    </div>
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

.container {
  max-height: 350px;
}

.items {
  scrollbar-width: thin;
  scrollbar-color: $color-primary;
}
</style>
