import { APIGatewayProxyEvent, Context, APIGatewayProxyResult } from 'aws-lambda';
import * as AWS from "aws-sdk";
const dynamoDB = new AWS.DynamoDB.DocumentClient();

export async function getIngredients(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
    const ingredientsTableName = process.env.INGREDIENTS_TABLE_NAME!;
    const recipesTableName = process.env.RECIPES_TABLE_NAME!;
    const drinksTableName = process.env.DRINKS_TABLE_NAME!;
    // invoke like /api/getIngredients?drink_id=1 should be Long Island Iced Tea

    const drinkId = Number(event.queryStringParameters?.drink_id);
    if (isNaN(drinkId)) {
        return { statusCode: 400, body: 'Invalid or missing drink_id' };
    }

    try {
        const drinkResult = await dynamoDB.query({
            TableName: drinksTableName,
            KeyConditionExpression: 'drink_id = :drinkId',
            ExpressionAttributeValues: { ':drinkId': drinkId }
        }).promise();

        if (!drinkResult.Items || drinkResult.Items.length === 0) {
            return { statusCode: 404, body: 'No drink found for this drink_id' };
        }

        const instructions = drinkResult.Items.map(item => item.instructions)[0];

        const recipeResult = await dynamoDB.query({
            TableName: recipesTableName,
            KeyConditionExpression: 'drink_id = :drinkId',
            ExpressionAttributeValues: { ':drinkId': drinkId }
        }).promise();

        if (!recipeResult.Items || recipeResult.Items.length === 0) {
            return { statusCode: 404, body: 'No recipe found for this drink_id' };
        }

        const ingredientIds = recipeResult.Items.map(item => item.ingredient_id);

        const ingredientBatch = await dynamoDB.batchGet({
            RequestItems: {
                [ingredientsTableName]: { Keys: ingredientIds.map(id => ({ ingredient_id: id })) }
            }
        }).promise();

        const ingredientNameMap = new Map<number, string>();
        ingredientBatch.Responses?.[ingredientsTableName]?.forEach(ing => {
            ingredientNameMap.set(ing.ingredient_id, ing.name);
        });

        const ingredients = recipeResult.Items.map(item => ({
            ingredient_id: item.ingredient_id,
            name: ingredientNameMap.get(item.ingredient_id) || 'Unknown',
            quantity: item.quantity
        }));

        return {
            statusCode: 200,
            body: JSON.stringify({ drink_id: drinkId, instructions, ingredients })
        };

    } catch (err) {
        console.error('Error fetching ingredients from drink:', err);
        return { statusCode: 500, body: 'Internal Server Error' };
    }
}