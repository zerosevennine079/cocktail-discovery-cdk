import * as cdk from 'aws-cdk-lib';
import {Construct} from 'constructs';

import { DynamoTables } from "./dynamoTables";
import {BackendConstruct} from "./backendConstruct";
import {FrontendConstruct} from "./frontendConstruct";


export class CocktailDiscoveryCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const tables = new DynamoTables(this, "DynamoTables");

    const backend = new BackendConstruct(this, 'BackendConstruct');

    tables.grantReadToAll(backend.getDrinksFromIngredientsLambda);
    tables.grantReadToAll(backend.getIngredientsFromDrinkLambda);
    tables.grantReadToAll(backend.listDrinksLambda);
    tables.grantReadToAll(backend.listIngredientsLambda);

    const apiOriginName = `${backend.apiId}.execute-api.${this.region}.amazonaws.com`

    const frontend = new FrontendConstruct(this, 'FrontendConstruct', apiOriginName);

    /*
      Since I'm not using a custom domain name in Route53, this outputs the domain name that is
      automatically assigned by CloudFront.
     */
    new cdk.CfnOutput(this, 'CloudFrontURL', {
      value: frontend.distribution.distributionDomainName,
    });
  }
}