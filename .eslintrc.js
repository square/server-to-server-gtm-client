module.exports = {
  plugins: ['square'],
  extends: ['plugin:square/base'],
  env: {
    node: true,
    browser: true,
  },
  rules: {
    'prettier/prettier': 0,
  },
};
