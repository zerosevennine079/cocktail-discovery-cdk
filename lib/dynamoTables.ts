import {DRINKS_TABLE_NAME, INGREDIENTS_TABLE_NAME, RECIPES_TABLE_NAME} from './constants';
import {Construct} from "constructs";
import {AttributeType, TableV2} from "aws-cdk-lib/aws-dynamodb";
import {IGrantable} from "aws-cdk-lib/aws-iam";
import {RemovalPolicy} from "aws-cdk-lib";
import {Runtime} from "aws-cdk-lib/aws-lambda";
import * as path from "path";
import {NodejsFunction} from "aws-cdk-lib/aws-lambda-nodejs";
import {CustomResource, Duration} from "aws-cdk-lib";
import {randomUUID} from "node:crypto";

export class DynamoTables extends Construct {
    private drinks: TableV2;
    private ingredients: TableV2;
    private recipes: TableV2;

    constructor(scope: Construct, id: string) {
        super(scope, id);

        this.drinks = new TableV2(this, 'Drinks', {
            tableName: DRINKS_TABLE_NAME,
            partitionKey: { name: 'drink_id', type: AttributeType.NUMBER },
            removalPolicy: RemovalPolicy.DESTROY
        });

        this.ingredients = new TableV2(this, 'Ingredients', {
            tableName: INGREDIENTS_TABLE_NAME,
            partitionKey: { name: 'ingredient_id', type: AttributeType.NUMBER },
            removalPolicy: RemovalPolicy.DESTROY
        });

        this.recipes = new TableV2(this, 'Recipes', {
            tableName: RECIPES_TABLE_NAME,
            partitionKey: { name: 'drink_id', type: AttributeType.NUMBER },
            sortKey: { name: 'ingredient_id', type: AttributeType.NUMBER },
            removalPolicy: RemovalPolicy.DESTROY
        });

        this.populateDrinks()
    }

    public grantReadToAll(resource: IGrantable) {
        this.drinks.grantReadData(resource);
        this.ingredients.grantReadData(resource);
        this.recipes.grantReadData(resource);
    }

    private populateDrinks() {
        const seedFunction = new NodejsFunction(this, "SeedFunction", {
            runtime: Runtime.NODEJS_LATEST,
            handler: "handler",
            timeout: Duration.seconds(60),
            memorySize: 512,
            entry: path.join(__dirname, "..", "lambda", "seedDynamo.ts"),
            environment: {
                DRINKS_TABLE_NAME: this.drinks.tableName,
                INGREDIENTS_TABLE_NAME: this.ingredients.tableName,
                RECIPES_TABLE_NAME: this.recipes.tableName
            },
        });

        // Grant write permissions
        this.drinks.grantWriteData(seedFunction);
        this.ingredients.grantWriteData(seedFunction);
        this.recipes.grantWriteData(seedFunction);

        // Trigger the function at deployment time
        new CustomResource(this, "InvokeSeedFunction", {
            serviceToken: seedFunction.functionArn,
            properties: {
                RequestId: randomUUID().toString(),  // Forces execution on each deploy
            },
        });
    }
}