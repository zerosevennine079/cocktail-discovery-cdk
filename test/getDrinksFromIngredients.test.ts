import { getDrinks } from '../lambda';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import * as AWS from 'aws-sdk';

// Mock AWS SDK
jest.mock('aws-sdk', () => {
    const mockDocClient = {
        scan: jest.fn(),
        batchGet: jest.fn()
    };
    return {
        DynamoDB: {
            DocumentClient: jest.fn(() => mockDocClient)
        }
    };
});

const mockDynamoDB = new AWS.DynamoDB.DocumentClient();

describe('getDrinks Lambda Handler', () => {
    const mockContext = {} as Context;

    beforeEach(() => {
        jest.clearAllMocks();
        // Set environment variables
        process.env.DRINKS_TABLE_NAME = 'Drinks';
        process.env.INGREDIENTS_TABLE_NAME = 'Ingredients';
        process.env.RECIPES_TABLE_NAME = 'Recipes';
    });

    it('returns 400 when ingredients parameter is missing', async () => {
        const event = {
            queryStringParameters: {}
        } as APIGatewayProxyEvent;

        const result = await getDrinks(event, mockContext);

        expect(result.statusCode).toBe(400);
        expect(result.body).toBe('Missing ingredients parameter');
    });

    it('returns empty array when no drinks match the ingredients', async () => {
        const event = {
            queryStringParameters: {ingredients: '1,2,3'}
        } as unknown as APIGatewayProxyEvent;

        (mockDynamoDB.scan as jest.Mock).mockReturnValueOnce({
            promise: () => Promise.resolve({
                Items: [
                    { drink_id: 1, ingredient_id: 4, quantity: '2 oz' },
                    { drink_id: 1, ingredient_id: 5, quantity: '1 oz' }
                ]
            })
        });

        const result = await getDrinks(event, mockContext);

        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual({ drinks: [] });
    });

    it('returns matching drinks with ingredients (Kamikaze)', async () => {
        const event = {
            queryStringParameters: { ingredients: '4,5,15' }
        } as unknown as APIGatewayProxyEvent;

        // Mock recipe scan
        (mockDynamoDB.scan as jest.Mock).mockReturnValueOnce({
            promise: () => Promise.resolve({
                Items: [
                    { drink_id: 1, ingredient_id: 4, quantity: '1 oz' },  // Vodka
                    { drink_id: 1, ingredient_id: 5, quantity: '1 oz' },  // Triple Sec
                    { drink_id: 1, ingredient_id: 15, quantity: '1 oz' }  // Lime Juice
                ]
            })
        });

        (mockDynamoDB.batchGet as jest.Mock).mockReturnValueOnce({
            promise: () => Promise.resolve({
                Responses: {
                    'Drinks': [  // Must match process.env.DRINKS_TABLE_NAME
                        { drink_id: 1, name: 'Kamikaze', instructions: 'Shake; Strain into chilled glass; Garnish with Lime' }
                    ]
                }
            })
        });

        (mockDynamoDB.batchGet as jest.Mock).mockReturnValueOnce({
            promise: () => Promise.resolve({
                Responses: {
                    'Ingredients': [  // Must match process.env.INGREDIENTS_TABLE_NAME
                        { ingredient_id: 4, name: 'Vodka' },
                        { ingredient_id: 5, name: 'Triple Sec' },
                        { ingredient_id: 15, name: 'Lime Juice' }
                    ]
                }
            })
        });

        const result = await getDrinks(event, mockContext);

        const parsedBody = JSON.parse(result.body);

        expect(result.statusCode).toBe(200);
        expect(parsedBody).toEqual({
            drinks: [{
                drink_id: 1,
                drink_name: 'Kamikaze',
                instructions: 'Shake; Strain into chilled glass; Garnish with Lime',
                ingredients: [
                    { ingredient_id: 4, name: 'Vodka', amount: '1 oz' },
                    { ingredient_id: 5, name: 'Triple Sec', amount: '1 oz' },
                    { ingredient_id: 15, name: 'Lime Juice', amount: '1 oz' }
                ]
            }]
        });
    });

    it('returns 500 when DynamoDB throws an error', async () => {
        const event = {
            queryStringParameters: { ingredients: '1,2,3' }
        } as unknown as APIGatewayProxyEvent;

        (mockDynamoDB.scan as jest.Mock).mockReturnValueOnce({
            promise: () => Promise.reject(new Error('DynamoDB error'))
        });

        const result = await getDrinks(event, mockContext);

        expect(result.statusCode).toBe(500);
        expect(result.body).toBe('Internal Server Error');
    });

    it('handles invalid ingredient parameters correctly', async () => {
        const event = {
            queryStringParameters: { ingredients: '1,abc,3' }
        } as unknown as APIGatewayProxyEvent;

        (mockDynamoDB.scan as jest.Mock).mockReturnValueOnce({
            promise: () => Promise.resolve({
                Items: [
                    { drink_id: 1, ingredient_id: 1, quantity: '2 oz' },
                    { drink_id: 1, ingredient_id: 3, quantity: '1 oz' }
                ]
            })
        });

        (mockDynamoDB.batchGet as jest.Mock).mockReturnValueOnce({
            promise: () => Promise.resolve({
                Responses: {
                    DrinksTable: [{ drink_id: 1, name: 'Test Drink' }]
                }
            })
        });

        (mockDynamoDB.batchGet as jest.Mock).mockReturnValueOnce({
            promise: () => Promise.resolve({
                Responses: {
                    IngredientsTable: [
                        { ingredient_id: 1, name: 'Ingredient 1' },
                        { ingredient_id: 3, name: 'Ingredient 3' }
                    ]
                }
            })
        });

        const result = await getDrinks(event, mockContext);

        expect(result.statusCode).toBe(200);
        const response = JSON.parse(result.body);
        expect(response.drinks).toHaveLength(1);
    });
});