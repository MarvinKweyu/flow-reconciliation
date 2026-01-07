import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class CreateTenantInput {
  @Field()
  name!: string;
}
