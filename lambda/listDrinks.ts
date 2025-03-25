import { APIGatewayProxyEvent, Context, APIGatewayProxyResult } from 'aws-lambda';
import * as AWS from "aws-sdk";
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const drinksTableName = process.env.DRINKS_TABLE_NAME!;

export async function listDrinks(event: APIGatewayProxyEvent, context: Context) {

    try {
        // Scan the entire table
        const data = await dynamoDB.scan({ TableName: drinksTableName }).promise();

        // Format response
        const items = data.Items?.map(item => ({
            id: item.drink_id,
            name: item.name
        }));

        const response: APIGatewayProxyResult = {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*", // Enable CORS for frontend access
            },
            body: JSON.stringify(items),
        };
        return response;

    } catch (error) {
        console.error("Error fetching data:", error);

        const response: APIGatewayProxyResult = {
            statusCode: 500,
            body: JSON.stringify({ message: "Error fetching data", error }),
        };
        return response;
    }


}