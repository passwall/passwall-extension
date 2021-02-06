<template>
  <div class="container">
    <div class="mx-3">
      <div class="py-3 head">
        <span class="fw-bold h5">Credit Cards</span>
      </div>

      <EmptyState v-if="items.length <= 0" />

      <ul class="items" v-else>
        <ListItem
          v-for="item in items"
          :key="item.id"
          :url="item.title"
          :title="item.title"
          :subtitle="item.number"
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
    ...mapState("CreditCards", ["items"]),
  },
  
  methods: {
    clickItem(id) {
      this.$store.dispatch("CreditCards/setDetail", id);
      this.$router.push({ name: "CreditCardDetail", params: { id } });
    },
  },
};
</script>

<style lang="scss"></style>
