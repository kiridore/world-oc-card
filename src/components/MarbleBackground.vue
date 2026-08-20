<template>
  <!-- 程序化大理石纹理层（DESIGN.md §5.3）：单一 fixed 装饰层，feTurbulence 石纹 + 冷光泽，
       纹理参数走 token，两主题各一组；正文区/时间轴/画布/输入控件不叠加纹理（在各自组件内用纯 surface 覆盖）。 -->
  <div
    class="marble-bg"
    aria-hidden="true"
  />
</template>

<style scoped>
.marble-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}
.marble-bg::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: var(--texture-url);
  background-size: 1400px 900px;
  opacity: var(--texture-opacity);
}
.marble-bg::after {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--texture-sheen-gradient);
  opacity: var(--texture-sheen);
}
</style>
