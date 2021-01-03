<template>
  <div
    class="d-flex flex-row-reverse flex-items-end fab"
    v-click-outside="closeMenu"
  >
    <button
      class=" d-flex flex-justify-center flex-items-center fab-btn"
      v-bind="$attrs"
      @click="toggleMenu"
      ref="fab_btn"
    >
      <VIcon
        ref="fab_icon"
        :class="[{ open: isOpen }, 'fab-icon']"
        name="plus"
      />
    </button>
    <slot>
      <div v-if="isOpen" class="fab-menu mr-3 px-3 py-1 bg-black">
        <ul>
          <li
            v-for="(item, index) in tabs"
            :key="index"
            class="d-flex flex-justify-between flex-items-center my-3"
          >
            <VIcon
              class="mr-2"
              :name="item.iconName"
              width="20px"
              height="20px"
            />
            <p class="fs-medium flex-auto ml-1">{{ item.name }}</p>
            <VIcon name="star" width="16px" height="16px" />
          </li>
        </ul>
      </div>
    </slot>
  </div>
</template>

<script>
export default {
  name: "FABButton",
  data() {
    return {
      isOpen: false,
    };
  },
  methods: {
    toggleMenu() {
      this.isOpen = !this.isOpen;
    },
    closeMenu() {
      this.isOpen = false;
    },
  },

  computed: {
    tabs() {
      return this.$c.TABS;
    },
  },
  events: {},
};
</script>

<style lang="scss">
.open {
  transform: rotate(75deg);
}

.fab {
  &-btn {
    height: 48px;
    width: 48px;
    background-color: $color-primary;
    border-radius: 999px;
    z-index: 99;
  }

  &-icon {
    transition: 0.2s;
  }

  &-menu {
    min-width: 215px;
    z-index: 99;
    border: 1px solid #10161f;
    border-radius: 8px;
  }
}
</style>
