<template>
  <div id="app">
    <h3>Welcome to Your Vue.js + TypeScript App</h3>
  </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';

// violates no-empty-interface
interface Foo {}

@Component
export default class App extends Vue {}
</script>

<style>
#app {
  font-family: 'Avenir', Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
</style>
