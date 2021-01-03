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
          @click="clickItem(item.id)"
        />
      </ul>
    </div>
  </div>
</template>

<script>
import { mapState } from "vuex";

export default {
  computed: {
    ...mapState("Logins", ["items"]),
  },
  methods: {
    clickItem(id) {
      this.$router.push({ name: "LoginDetail", params: { id } });
    },
  },
};
</script>

<style scoped lang="scss"></style>
