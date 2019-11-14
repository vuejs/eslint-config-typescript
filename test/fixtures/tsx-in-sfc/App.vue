<script lang="tsx">
import { Component, Vue } from 'vue-property-decorator';

@Component
export default class App extends Vue {
  render () {
    return (
      <div>
        <span>hello</span>
      </div>
    )
  }
}

interface Foo {}

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
