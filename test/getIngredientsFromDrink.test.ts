import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import * as AWS from 'aws-sdk';
import { getIngredients } from '../lambda';

// Mock the AWS SDK
jest.mock('aws-sdk', () => {
    const mockDynamoDB = {
        query: jest.fn(),
        batchGet: jest.fn(),
    };
    return {
        DynamoDB: {
            DocumentClient: jest.fn(() => mockDynamoDB),
        },
    };
});

// Cast the mocked DynamoDB instance
const mockDynamoDB = new AWS.DynamoDB.DocumentClient() as jest.Mocked<AWS.DynamoDB.DocumentClient>;

describe('getIngredients Lambda Handler', () => {
    beforeEach(() => {
        mockDynamoDB.query.mockClear();
        mockDynamoDB.batchGet.mockClear();
        process.env.DRINKS_TABLE_NAME = 'Drinks';
        process.env.INGREDIENTS_TABLE_NAME = 'Ingredients';
        process.env.RECIPES_TABLE_NAME = 'Recipes';
    });

    const createEvent = (drinkId?: string): APIGatewayProxyEvent => ({
        queryStringParameters: drinkId ? { drink_id: drinkId } : null,
        body: null,
        headers: {},
        multiValueHeaders: {},
        httpMethod: 'GET',
        isBase64Encoded: false,
        path: '/api/getIngredients',
        pathParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
    });

    const mockContext: Context = {} as Context;

    it('should return 400 if drink_id is missing', async () => {
        const event = createEvent();
        const result = await getIngredients(event, mockContext);

        expect(result.statusCode).toBe(400);
        expect(result.body).toBe('Invalid or missing drink_id');
    });

    it('should return 400 if drink_id is invalid (not a number)', async () => {
        const event = createEvent('abc');
        const result = await getIngredients(event, mockContext);

        expect(result.statusCode).toBe(400);
        expect(result.body).toBe('Invalid or missing drink_id');
    });

    it('should return 404 if no recipe is found for drink_id', async () => {
        mockDynamoDB.query.mockReturnValueOnce({
            promise: jest.fn().mockResolvedValue({ Items: [] }),
        } as any);

        const event = createEvent('1');
        const result = await getIngredients(event, mockContext);

        expect(result.statusCode).toBe(404);
        expect(result.body).toBe('No recipe found for this drink_id');
    });

    it('should return ingredients for a valid drink_id', async () => {
        mockDynamoDB.query.mockReturnValueOnce({
            promise: jest.fn().mockResolvedValue({
                Items: [
                    { drink_id: 1, ingredient_id: 1, quantity: '2 oz' },
                    { drink_id: 1, ingredient_id: 2, quantity: '1 oz' },
                ],
            }),
        } as any);

        mockDynamoDB.batchGet.mockReturnValueOnce({
            promise: jest.fn().mockResolvedValue({
                Responses: {
                    Ingredients: [
                        { ingredient_id: 1, name: 'Vodka' },
                        { ingredient_id: 2, name: 'Rum' },
                    ],
                },
            }),
        } as any);

        const event = createEvent('1');
        const result = await getIngredients(event, mockContext);

        expect(result.statusCode).toBe(200);
        const body = JSON.parse(result.body);
        expect(body.drink_id).toBe(1);
        expect(body.ingredients).toEqual([
            { ingredient_id: 1, name: 'Vodka', quantity: '2 oz' },
            { ingredient_id: 2, name: 'Rum', quantity: '1 oz' },
        ]);
    });

    it('should handle missing ingredient names gracefully', async () => {
        mockDynamoDB.query.mockReturnValueOnce({
            promise: jest.fn().mockResolvedValue({
                Items: [{ drink_id: 1, ingredient_id: 103, quantity: '1.5 oz' }],
            }),
        } as any);

        mockDynamoDB.batchGet.mockReturnValueOnce({
            promise: jest.fn().mockResolvedValue({
                Responses: {
                    IngredientsTable: [],
                },
            }),
        } as any);

        const event = createEvent('1');
        const result = await getIngredients(event, mockContext);

        expect(result.statusCode).toBe(200);
        const body = JSON.parse(result.body);
        expect(body.ingredients).toEqual([
            { ingredient_id: 103, name: 'Unknown', quantity: '1.5 oz' },
        ]);
    });

    it('should return 500 on DynamoDB error', async () => {
        mockDynamoDB.query.mockReturnValueOnce({
            promise: jest.fn().mockRejectedValue(new Error('DynamoDB failure')),
        } as any);

        const event = createEvent('1');
        const result = await getIngredients(event, mockContext);

        expect(result.statusCode).toBe(500);
        expect(result.body).toBe('Internal Server Error');
    });
});