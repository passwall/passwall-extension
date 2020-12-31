<template>
  <div :class="[{ fancy: pro }, 'avatar']">
    <div
      :class="[{ 'fancy-content': pro }, 'avatar-content', 'h6']"
      v-text="firstLettersOfName"
    />
  </div>
</template>

<script>
export default {
  name: "VAvatar",
  props: {
    name: String,
    pro: Boolean,
  },
  computed: {
    firstLettersOfName() {
      const [firstName, lastName] = this.name.split(" ");
      return `${firstName[0]}${(lastName || " ")[0]}`;
    },
  },
};
</script>

<style lang="scss">
.avatar {
  width: 48px;
  height: 48px;
  min-width: 40px;
  min-height: 40px;
  border-radius: 50%;

  &-content {
    display: flex;
    width: 100%;
    height: 100%;
    justify-content: center;
    align-items: center;
    border-radius: 50%;
    background-color: $color-primary;
    font-weight: 700;
    color: #fff;
  }
}

.fancy {
  background-origin: border-box;
  background-clip: content-box, border-box;
  border: double 2px transparent;

  background-image: linear-gradient(black, black),
    linear-gradient(45deg, $color-secondary, $color-primary);
}

.fancy-content {
  background: black;
}
</style>
