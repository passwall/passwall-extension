module.exports = {
  presets: ["@vue/cli-plugin-babel/preset"],
  plugins: [
    [
      "module-resolver",
      {
        root: ["./src"],
        alias: {
          "@p": "./src/popup",
          "@": "./src",
        },
      },
    ],
  ],
};
