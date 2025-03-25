import {DRINKS_TABLE_NAME, INGREDIENTS_TABLE_NAME, RECIPES_TABLE_NAME} from './constants';
import { Construct } from "constructs";
import {NodejsFunction} from "aws-cdk-lib/aws-lambda-nodejs";
import {Runtime} from "aws-cdk-lib/aws-lambda";
import * as path from 'path';
import {HttpLambdaIntegration} from "aws-cdk-lib/aws-apigatewayv2-integrations";
import {ServicePrincipal} from "aws-cdk-lib/aws-iam";
import {CfnDeployment, CfnStage, HttpApi, HttpMethod} from "aws-cdk-lib/aws-apigatewayv2";
import {randomUUID} from "node:crypto";

export class BackendConstruct extends Construct {
    public getIngredientsFromDrinkLambda: NodejsFunction;
    public getDrinksFromIngredientsLambda: NodejsFunction;
    public listDrinksLambda: NodejsFunction;
    public listIngredientsLambda: NodejsFunction;
    public apiId: string;

    constructor(scope: Construct, id: string) {
        super(scope, id);

        const httpApi = new HttpApi(this, "CocktailDiscoveryServiceApiGateway");

        /* getIngredientsFromDrink Lambda */
        this.getIngredientsFromDrinkLambda = new NodejsFunction(this, "getIngredientsFromDrink", {
            runtime: Runtime.NODEJS_LATEST,
            handler: "getIngredients",
            functionName: "GetIngredients",
            environment: {
                DRINKS_TABLE_NAME: DRINKS_TABLE_NAME,
                INGREDIENTS_TABLE_NAME: INGREDIENTS_TABLE_NAME,
                RECIPES_TABLE_NAME: RECIPES_TABLE_NAME,
            },
            entry: path.join(__dirname, "..", "lambda", "getIngredientsFromDrink.ts"),
        });
        const getIngredientsLambdaIntegration = new HttpLambdaIntegration(
            'getIngredientsLambdaProxy',
            this.getIngredientsFromDrinkLambda,
        );
        this.getIngredientsFromDrinkLambda.grantInvoke(new ServicePrincipal('apigateway.amazonaws.com'));
        httpApi.addRoutes({
            path: "/api/getIngredients",
            methods: [HttpMethod.GET],
            integration: getIngredientsLambdaIntegration,
        });

        /* getDrinksFromIngredients Lambda */
        this.getDrinksFromIngredientsLambda = new NodejsFunction(this, "getDrinksFromIngredients", {
            runtime: Runtime.NODEJS_LATEST,
            handler: "getDrinks",
            functionName: "GetDrinks",
            environment: {
                DRINKS_TABLE_NAME: DRINKS_TABLE_NAME,
                INGREDIENTS_TABLE_NAME: INGREDIENTS_TABLE_NAME,
                RECIPES_TABLE_NAME: RECIPES_TABLE_NAME,
            },
            entry: path.join(__dirname, "..", "lambda", "getDrinksFromIngredients.ts"),
        });
        const getDrinksLambdaIntegration = new HttpLambdaIntegration(
            'getDrinksLambdaProxy',
            this.getDrinksFromIngredientsLambda,
        );
        this.getDrinksFromIngredientsLambda.grantInvoke(new ServicePrincipal('apigateway.amazonaws.com'));
        httpApi.addRoutes({
            path: "/api/getDrinks",
            methods: [HttpMethod.GET],
            integration: getDrinksLambdaIntegration,
        });

        /* listDrinks Lambda */
        this.listDrinksLambda = new NodejsFunction(this, "listDrinks", {
            runtime: Runtime.NODEJS_LATEST,
            handler: "listDrinks",
            functionName: "ListDrinks",
            environment: {
                DRINKS_TABLE_NAME: DRINKS_TABLE_NAME,
            },
            entry: path.join(__dirname, "..", "lambda", "listDrinks.ts"),
        });
        const listDrinksLambdaIntegration = new HttpLambdaIntegration(
            'listDrinksLambdaProxy',
            this.listDrinksLambda,
        );
        this.listDrinksLambda.grantInvoke(new ServicePrincipal('apigateway.amazonaws.com'));
        httpApi.addRoutes({
            path: "/api/listDrinks",
            methods: [HttpMethod.GET],
            integration: listDrinksLambdaIntegration,
        });

        /* listIngredients Lambda */
        this.listIngredientsLambda = new NodejsFunction(this, "listIngredients", {
            runtime: Runtime.NODEJS_LATEST,
            handler: "listIngredients",
            functionName: "ListIngredients",
            environment: {
                INGREDIENTS_TABLE_NAME: INGREDIENTS_TABLE_NAME,
            },
            entry: path.join(__dirname, "..", "lambda", "listIngredients.ts"),
        });
        const listIngredientsLambdaIntegration = new HttpLambdaIntegration(
            'listIngredientsLambdaProxy',
            this.listIngredientsLambda,
        );
        this.listIngredientsLambda.grantInvoke(new ServicePrincipal('apigateway.amazonaws.com'));
        httpApi.addRoutes({
            path: "/api/listIngredients",
            methods: [HttpMethod.GET],
            integration: listIngredientsLambdaIntegration,
        });

        /* API Deployment */
        const httpApiDeployment = new CfnDeployment(this, "CocktailDiscoveryServiceApigDeployment", {
            apiId: httpApi.apiId,
            description: randomUUID().toString(),
        });

        httpApiDeployment.node.addDependency(httpApi);

        /* API Stage */
        new CfnStage(this, "ProdStage", {
            apiId: httpApi.apiId,
            deploymentId: httpApiDeployment.ref,
            stageName: "prod",
        });

        this.apiId = httpApi.apiId;
    }
}
