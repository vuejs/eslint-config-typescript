import { Component, Prop, Vue } from 'vue-property-decorator';

@Component
export default class HelloWorld extends Vue {
  @Prop() private msg!: string;

  render(): JSX.Element {
    return (
      <div class="hello">
        <h1>{ this.msg }</h1>
      </div>
    )
  }
}
