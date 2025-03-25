import { DynamoDB } from "aws-sdk";
import * as https from "https";
const db = new DynamoDB.DocumentClient();
const drinksTableName = process.env.DRINKS_TABLE_NAME!;
const ingredientsTableName = process.env.INGREDIENTS_TABLE_NAME!;
const recipesTableName = process.env.RECIPES_TABLE_NAME!;

async function sendResponse(event: any, context: any, status: string, reason?: string) {
    return new Promise((resolve, reject) => {
        const responseBody = JSON.stringify({
            Status: status,
            Reason: reason || "See CloudWatch logs for details",
            PhysicalResourceId: context.logStreamName,  // Required for tracking updates
            StackId: event.StackId,
            RequestId: event.RequestId,
            LogicalResourceId: event.LogicalResourceId,
        });

        const parsedUrl = new URL(event.ResponseURL);
        const options = {
            hostname: parsedUrl.hostname,
            port: 443,
            path: parsedUrl.pathname + parsedUrl.search,
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Content-Length": responseBody.length,
            },
        };

        const req = https.request(options, (res) => {
            console.log("CloudFormation Response Sent:", res.statusCode);
            resolve(true);
        });

        req.on("error", (error) => {
            console.error("Error sending CloudFormation response:", error);
            reject(error);
        });

        req.write(responseBody);
        req.end();
    });
}

export async function handler(event: any, context: any) {
    console.log("Event:", JSON.stringify(event));

    if (event.RequestType === "Delete") {
        console.log("Delete event received, sending success.");
        await sendResponse(event, context, "SUCCESS");
        return;
    }

    try {
        /* insert into drinks table */
        const drinks = [
            {drink_id: 1, name: "Long Island Iced Tea", instructions: "Garnish with Lemon"},
            {drink_id: 2, name: "Kamikaze", instructions: "Shake; Strain into chilled glass; Garnish with Lime"},
        ];

        for (const drink of drinks) {
            await db.put({TableName: drinksTableName, Item: drink}).promise();
        }

        /* insert into ingredients table */
        const ingredients = [
            {ingredient_id: 1, name: "Bourbon Whiskey"},
            {ingredient_id: 2, name: "Dark Rum"},
            {ingredient_id: 3, name: "Clear Rum"},
            {ingredient_id: 4, name: "Vodka"},
            {ingredient_id: 5, name: "Triple Sec"},
            {ingredient_id: 6, name: "Sloe Gin"},
            {ingredient_id: 7, name: "Southern Comfort"},
            {ingredient_id: 8, name: "Gin"},
            {ingredient_id: 9, name: "Scotch"},
            {ingredient_id: 10, name: "Silver Tequila"},
            {ingredient_id: 11, name: "Gold Tequila"},
            {ingredient_id: 12, name: "Coke"},
            {ingredient_id: 13, name: "Sprite"},
            {ingredient_id: 14, name: "Orange Juice"},
            {ingredient_id: 15, name: "Lime Juice"},
            {ingredient_id: 16, name: "Sour Mix"},
        ];

        for (const ingredient of ingredients) {
            await db.put({TableName: ingredientsTableName, Item: ingredient}).promise();
        }

        /* insert into drinks table */
        const recipes = [
            {drink_id: 1, ingredient_id: 3, quantity: "1/2 oz"},
            {drink_id: 1, ingredient_id: 4, quantity: "1/2 oz"},
            {drink_id: 1, ingredient_id: 8, quantity: "1/2 oz"},
            {drink_id: 1, ingredient_id: 10, quantity: "1/2 oz"},
            {drink_id: 1, ingredient_id: 5, quantity: "1/2 oz"},
            {drink_id: 1, ingredient_id: 16, quantity: "1 oz"},
            {drink_id: 1, ingredient_id: 12, quantity: "top off"},
            {drink_id: 2, ingredient_id: 4, quantity: "2 oz"},
            {drink_id: 2, ingredient_id: 5, quantity: "1/2 oz"},
            {drink_id: 2, ingredient_id: 15, quantity: "1 oz"},
        ];

        for (const recipe of recipes) {
            await db.put({TableName: recipesTableName, Item: recipe}).promise();
        }

        console.log("Completed data seeding...")
        await sendResponse(event, context, "SUCCESS");
    } catch (error: any) {
        console.error("Error inserting data:", error);
        const errorMessage = error?.message || JSON.stringify(error) || "Unknown error";
        await sendResponse(event, context, "FAILED", errorMessage);
    }
}