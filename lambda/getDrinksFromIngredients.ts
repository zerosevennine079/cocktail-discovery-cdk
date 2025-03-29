import { APIGatewayProxyEvent, Context, APIGatewayProxyResult } from 'aws-lambda';
import * as AWS from "aws-sdk";
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const drinksTableName = process.env.DRINKS_TABLE_NAME!;
const ingredientsTableName = process.env.INGREDIENTS_TABLE_NAME!;
const recipesTableName = process.env.RECIPES_TABLE_NAME!;

export async function getDrinks(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {

    // invoke like /api/getDrinks?ingredients=4,5,15 should be Kamikaze

    const ingredientParam = event.queryStringParameters?.ingredients;
    if (!ingredientParam) return { statusCode: 400, body: 'Missing ingredients parameter' };

    try {
        const ingredientList = ingredientParam.split(',').map(Number).filter(n => !isNaN(n));
        console.log('Looking for drinks with ingredients:', ingredientList);

        // Scan Recipe Table to collect drink-ingredient-amount mappings
        const recipeData = await dynamoDB.scan({TableName: recipesTableName}).promise();

        // Group recipe entries by drink_id
        const recipeMap = new Map<number, { ingredient_id: number, quantity: string }[]>();
        recipeData.Items?.forEach(item => {
            const drinkId = item.drink_id;
            if (!recipeMap.has(drinkId)) recipeMap.set(drinkId, []);
            recipeMap.get(drinkId)?.push({ingredient_id: item.ingredient_id, quantity: item.quantity});
        });

        // Filter drinks where ALL their ingredients are in the provided ingredient list
        const matchingDrinks = Array.from(recipeMap.entries()).filter(([_, ingredients]) => {
            const requiredIngredients = new Set(ingredients.map(i => i.ingredient_id)); // Ingredients needed for this drink
            const providedIngredients = new Set(ingredientList); // Ingredients user has

            // Check if ALL required ingredients exist in the provided ingredients list
            return [...requiredIngredients].every(id => providedIngredients.has(id));
        });

        // If no matching drinks, return an empty response early
        if (matchingDrinks.length === 0) {
            return {
                statusCode: 200,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ drinks: [] })  // Return empty drinks list
            };
        }

        const matchingDrinkIds = matchingDrinks.map(([drinkId]) => drinkId);
        console.log('Matching drink IDs:', matchingDrinkIds);

        // Batch get drink names
        const drinkBatch = await dynamoDB.batchGet({
            RequestItems: {
                [drinksTableName]: {Keys: matchingDrinkIds.map(id => ({drink_id: id}))}
            }
        }).promise();

        const drinksNameMap = new Map<number, string>();
        drinkBatch.Responses?.[drinksTableName]?.forEach(drink => {
            drinksNameMap.set(drink.drink_id, drink.name);
        });

        // Collect all unique ingredient IDs to fetch their names
        const allIngredientIds = new Set<number>();
        matchingDrinks.forEach(([_, ingredients]) => ingredients.forEach(i => allIngredientIds.add(i.ingredient_id)));

        const ingredientBatch = await dynamoDB.batchGet({
            RequestItems: {
                [ingredientsTableName]: {Keys: Array.from(allIngredientIds).map(id => ({ingredient_id: id}))}
            }
        }).promise();

        const ingredientNameMap = new Map<number, string>();
        ingredientBatch.Responses?.[ingredientsTableName]?.forEach(ing => {
            ingredientNameMap.set(ing.ingredient_id, ing.name);
        });

        // Build response
        const drinks = matchingDrinks.map(([drinkId, ingredients]) => ({
            drink_id: drinkId,
            drink_name: drinksNameMap.get(drinkId) || 'Unknown',
            ingredients: ingredients.map(ing => ({
                ingredient_id: ing.ingredient_id,
                name: ingredientNameMap.get(ing.ingredient_id) || 'Unknown',
                amount: ing.quantity
            }))
        }));

        return {
            statusCode: 200,
            body: JSON.stringify({drinks})
        };
    }catch (err) {
        console.error('Error fetching drinks from ingredients:', err);
        return { statusCode: 500, body: 'Internal Server Error' };
    }

}