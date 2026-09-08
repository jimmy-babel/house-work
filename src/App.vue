<script>
export default {
  onLaunch() {
    console.log('Housework Helper Launch')
  },
}
</script>

<style lang="scss">
@import "uview-plus/index.scss";

page {
  min-height: 100%;
  background:
    radial-gradient(circle at top left, rgba(244, 194, 160, 0.25), transparent 30%),
    radial-gradient(circle at top right, rgba(133, 171, 138, 0.18), transparent 28%),
    linear-gradient(180deg, #fffdf8 0%, #f6efe5 100%);
  color: #221d18;
  font-family: 'Source Han Serif SC', 'Noto Serif SC', 'PingFang SC', 'Hiragino Sans GB',
    'Microsoft YaHei', serif;
}

view,
text,
button,
input,
textarea,
picker {
  box-sizing: border-box;
}
</style>
